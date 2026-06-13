package com.example.myapplication.ui.home

import androidx.compose.runtime.*
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.myapplication.config.AlphaFeatureFlags
import com.example.myapplication.data.remote.AuthApi
import com.example.myapplication.data.remote.CreatePostRequest
import com.example.myapplication.data.remote.RetrofitClient
import com.google.gson.JsonArray
import com.google.gson.JsonObject
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class HomeViewModel(
    private val authApi: AuthApi = RetrofitClient.instance,
    private val ioDispatcher: CoroutineDispatcher = Dispatchers.IO
) : ViewModel() {
    var currentTab by mutableIntStateOf(0)
    var showCreatePostModal by mutableStateOf(false)
    var showCommentsSheet by mutableStateOf(false)
    var activeStoryProfileIndex by mutableStateOf<Int?>(null)
    var showCameraView by mutableStateOf(false)

    var isHomeRefreshing by mutableStateOf(false)
    var isSearchRefreshing by mutableStateOf(false)
    var isProfileRefreshing by mutableStateOf(false)

    var posts by mutableStateOf(emptyList<PostData>())
    var isLoadingMore by mutableStateOf(false)
    var hasMorePosts by mutableStateOf(true)
    private var currentPage = 1
    private var useRecommended = true
    var storyProfiles by mutableStateOf(emptyList<StoryProfile>())
    var myStoryActivities by mutableStateOf(
        Triple(
            emptyList<StoryActivityUser>(),
            emptyList<StoryActivityUser>(),
            emptyList<StoryActivityUser>()
        )
    )
    var recommendedProfiles by mutableStateOf(emptyList<RecommendedProfile>())
    var createPostError by mutableStateOf<String?>(null)
    var isCreatingPost by mutableStateOf(false)
    var myAvatar by mutableStateOf("")
    var myUsername by mutableStateOf("")

    init {
        loadHomeFeed()
        loadMyAvatar()
    }

    private fun loadMyAvatar() {
        viewModelScope.launch {
            try {
                val resp = withContext(ioDispatcher) { authApi.getMyProfile() }
                if (resp.isSuccessful) {
                    val data = resp.body()?.getAsJsonObject("data")
                    val avatar = data?.get("avatar")?.let { if (it.isJsonNull) "" else it.asString } ?: ""
                    val username = data?.get("username")?.let { if (it.isJsonNull) "" else it.asString } ?: ""
                    myAvatar = avatar
                    myUsername = username
                }
            } catch (_: Exception) { }
        }
    }

    fun onTabSelected(index: Int) {
        currentTab = if (AlphaFeatureFlags.isHomeTabEnabled(index)) index else 0
    }

    fun openCreatePostModal() {
        showCreatePostModal = true
        createPostError = null
    }

    fun closeCreatePostModal() {
        showCreatePostModal = false
        createPostError = null
    }

    fun openStory(index: Int) {
        if (AlphaFeatureFlags.canOpenStoryViewer()) {
            activeStoryProfileIndex = index
        }
    }

    fun closeStory() {
        activeStoryProfileIndex = null
    }

    fun toggleComments(show: Boolean) {
        showCommentsSheet = show && AlphaFeatureFlags.canUseFeedInteractions()
    }

    private fun stringOr(obj: JsonObject, key: String, fallback: String = ""): String {
        return if (obj.has(key) && !obj.get(key).isJsonNull) obj.get(key).asString else fallback
    }

    private fun intOr(obj: JsonObject, key: String, fallback: Int = 0): Int {
        return if (obj.has(key) && !obj.get(key).isJsonNull) obj.get(key).asInt else fallback
    }

    private fun parsePosts(data: JsonArray): List<PostData> {
        return data.mapIndexedNotNull { _, element ->
            runCatching {
                val post = element.asJsonObject
                val author = if (post.has("author") && !post.get("author").isJsonNull) post.getAsJsonObject("author") else null
                val mediaArray = if (post.has("media") && post.get("media").isJsonArray) post.getAsJsonArray("media") else null

                val mediaList = mediaArray?.mapNotNull { el ->
                    runCatching {
                        val obj = el.asJsonObject
                        val url = obj.get("url")?.takeIf { !it.isJsonNull }?.asString
                            ?: obj.get("secureUrl")?.takeIf { !it.isJsonNull }?.asString
                        if (url.isNullOrBlank()) null
                        else PostMedia(
                            url = url,
                            isVideo = obj.get("type")?.takeIf { !it.isJsonNull }?.asString == "video"
                        )
                    }.getOrNull()
                } ?: emptyList()

                val postId = stringOr(post, "_id", "")
                if (postId.isBlank()) return@runCatching null

                PostData(
                    id = postId,
                    user = author?.let { stringOr(it, "username", "user") } ?: "user",
                    image = mediaList.firstOrNull()?.url,
                    caption = stringOr(post, "caption", ""),
                    likes = intOr(post, "likesCount", 0),
                    comments = intOr(post, "commentsCount", 0),
                    reposts = 0,
                    isVideo = mediaList.firstOrNull()?.isVideo == true,
                    media = mediaList,
                    authorAvatar = author?.let { stringOr(it, "avatar", "") } ?: ""
                )
            }.getOrNull()
        }
    }

    private fun parseStories(data: JsonArray): List<StoryProfile> {
        return data.mapIndexedNotNull { idx, element ->
            runCatching {
                val item = element.asJsonObject
                val user = item.getAsJsonObject("user")
                val storiesJson = if (item.has("stories") && item.get("stories").isJsonArray) item.getAsJsonArray("stories") else JsonArray()
                val stories = storiesJson.mapIndexedNotNull { sIdx, sEl ->
                    runCatching {
                        val sObj = sEl.asJsonObject
                        val mediaUrl = if (sObj.has("mediaUrl") && !sObj.get("mediaUrl").isJsonNull) sObj.get("mediaUrl").asString else ""
                        if (mediaUrl.isBlank()) null else StoryMedia(id = sIdx + 1, mediaUrl = mediaUrl)
                    }.getOrNull()
                }
                if (stories.isEmpty()) return@runCatching null

                StoryProfile(
                    id = idx + 1,
                    name = user?.let { stringOr(it, "fullName", stringOr(it, "username", "User")) } ?: "User",
                    avatar = user?.let { stringOr(it, "avatar", "") } ?: "",
                    stories = stories,
                    isLive = false,
                    isSeen = false,
                    isMine = false
                )
            }.getOrNull()
        }
    }

    fun loadHomeFeed() {
        viewModelScope.launch {
            isHomeRefreshing = true
            currentPage = 1
            hasMorePosts = true
            try {
                // Try recommended discovery feed first; fall back to regular followed-only feed
                var postFetched = false
                try {
                    val recResp = withContext(ioDispatcher) { authApi.getRecommendedFeed(page = 1, limit = 10) }
                    if (recResp.isSuccessful) {
                        val dataArray = recResp.body()?.getAsJsonArray("data")
                        posts = if (dataArray != null) parsePosts(dataArray) else emptyList()
                        useRecommended = true
                        hasMorePosts = (dataArray?.size() ?: 0) >= 10
                        postFetched = true
                    }
                } catch (_: Exception) { }

                if (!postFetched) {
                    val postResponse = withContext(ioDispatcher) { authApi.getPostFeed(page = 1, limit = 10) }
                    if (postResponse.isSuccessful) {
                        val dataArray = postResponse.body()?.getAsJsonArray("data")
                        posts = if (dataArray != null) parsePosts(dataArray) else emptyList()
                        useRecommended = false
                        hasMorePosts = (dataArray?.size() ?: 0) >= 10
                    }
                }

                // Load "who to follow" suggestions alongside the feed
                try {
                    val sugResp = withContext(ioDispatcher) { authApi.getProfileSuggestions(limit = 10) }
                    if (sugResp.isSuccessful) {
                        val dataArray = sugResp.body()?.getAsJsonArray("data")
                        recommendedProfiles = if (dataArray != null) parseProfiles(dataArray) else emptyList()
                    }
                } catch (_: Exception) { }

                if (AlphaFeatureFlags.STORIES_ENABLED) {
                    val storyResponse = withContext(ioDispatcher) { authApi.getStoryFeed(page = 1, limit = 20) }
                    if (storyResponse.isSuccessful) {
                        val dataArray = storyResponse.body()?.getAsJsonArray("data")
                        storyProfiles = if (dataArray != null) parseStories(dataArray) else emptyList()
                    }
                } else {
                    storyProfiles = emptyList()
                }
            } catch (_: Exception) {
                posts = emptyList()
                storyProfiles = emptyList()
            } finally {
                isHomeRefreshing = false
            }
        }
    }

    private fun parseProfiles(data: com.google.gson.JsonArray): List<RecommendedProfile> {
        return data.mapIndexedNotNull { _, element ->
            runCatching {
                val obj = element.asJsonObject
                val id = stringOr(obj, "_id")
                if (id.isBlank()) return@runCatching null
                RecommendedProfile(
                    id = id,
                    name = stringOr(obj, "fullName").ifBlank { stringOr(obj, "username", "User") },
                    username = stringOr(obj, "username"),
                    avatar = stringOr(obj, "avatar").ifBlank { stringOr(obj, "profileImage") },
                    bio = stringOr(obj, "bio"),
                    followersCount = intOr(obj, "followersCount"),
                    followStatus = stringOr(obj, "followStatus", "not_following")
                )
            }.getOrNull()
        }
    }

    fun createTextPost(caption: String) {
        val normalizedCaption = caption.trim()
        if (normalizedCaption.length < 1) {
            createPostError = "Caption is required"
            return
        }
        viewModelScope.launch {
            isCreatingPost = true
            createPostError = null
            try {
                val response = withContext(ioDispatcher) {
                    authApi.createPost(CreatePostRequest(caption = normalizedCaption))
                }
                if (!response.isSuccessful) {
                    createPostError = "Post yaratilmadi (${response.code()})"
                    return@launch
                }
                closeCreatePostModal()
                loadHomeFeed()
            } catch (e: Exception) {
                createPostError = "Tarmoq xatosi: ${e.message}"
            } finally {
                isCreatingPost = false
            }
        }
    }

    fun loadMoreIfNeeded() {
        if (isLoadingMore || !hasMorePosts || isHomeRefreshing) return
        viewModelScope.launch {
            isLoadingMore = true
            try {
                val nextPage = currentPage + 1
                val resp = withContext(ioDispatcher) {
                    if (useRecommended) authApi.getRecommendedFeed(page = nextPage, limit = 10)
                    else authApi.getPostFeed(page = nextPage, limit = 10)
                }
                if (resp.isSuccessful) {
                    val dataArray = resp.body()?.getAsJsonArray("data")
                    val newItems = if (dataArray != null) parsePosts(dataArray) else emptyList()
                    if (newItems.isEmpty()) {
                        hasMorePosts = false
                    } else {
                        // Dedupe by id
                        val existingIds = posts.map { it.id }.toHashSet()
                        posts = posts + newItems.filter { it.id !in existingIds }
                        currentPage = nextPage
                        if (newItems.size < 10) hasMorePosts = false
                    }
                }
            } catch (_: Exception) {
            } finally {
                isLoadingMore = false
            }
        }
    }

    fun blockUserOfPost(post: PostData) {
        viewModelScope.launch {
            // Block requires userId — fetch profile by username first
            try {
                val resp = withContext(ioDispatcher) { authApi.getProfileByUsername(post.user) }
                if (resp.isSuccessful) {
                    val data = resp.body()?.getAsJsonObject("data")
                    val userId = data?.get("_id")?.takeIf { !it.isJsonNull }?.asString
                    if (!userId.isNullOrBlank()) {
                        withContext(ioDispatcher) { authApi.blockUser(userId) }
                        // Bloklangan foydalanuvchi postlarini olib tashlash
                        posts = posts.filterNot { it.user.equals(post.user, ignoreCase = true) }
                    }
                }
            } catch (_: Exception) { }
        }
    }

    fun deletePost(postId: String) {
        viewModelScope.launch {
            val previous = posts
            posts = posts.filterNot { it.id == postId }
            try {
                val resp = withContext(ioDispatcher) { authApi.deletePost(postId) }
                if (!resp.isSuccessful) posts = previous
            } catch (_: Exception) {
                posts = previous
            }
        }
    }

    fun updatePostCaption(postId: String, newCaption: String) {
        viewModelScope.launch {
            val previous = posts
            posts = posts.map { if (it.id == postId) it.copy(caption = newCaption) else it }
            try {
                val resp = withContext(ioDispatcher) {
                    authApi.updatePost(postId, com.example.myapplication.data.remote.UpdatePostRequest(caption = newCaption))
                }
                if (!resp.isSuccessful) posts = previous
            } catch (_: Exception) {
                posts = previous
            }
        }
    }

    fun refreshHome() {
        viewModelScope.launch {
            isHomeRefreshing = true
            delay(300)
            loadHomeFeed()
        }
    }

    fun refreshSearch() {
        viewModelScope.launch {
            isSearchRefreshing = true
            delay(800)
            isSearchRefreshing = false
        }
    }

    fun refreshProfile() {
        viewModelScope.launch {
            isProfileRefreshing = true
            delay(800)
            isProfileRefreshing = false
        }
    }
}
