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

    init {
        loadHomeFeed()
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
                val author = post.getAsJsonObject("author")
                val media = if (post.has("media") && post.get("media").isJsonArray) post.getAsJsonArray("media") else null
                val firstMedia = media?.firstOrNull()?.asJsonObject
                val image = when {
                    firstMedia != null && firstMedia.has("url") -> firstMedia.get("url").asString
                    firstMedia != null && firstMedia.has("secureUrl") -> firstMedia.get("secureUrl").asString
                    else -> null
                }
                val postId = stringOr(post, "_id", "")
                if (postId.isBlank()) return@runCatching null

                PostData(
                    id = postId,
                    user = author?.let { stringOr(it, "username", "user") } ?: "user",
                    image = image,
                    caption = stringOr(post, "caption", ""),
                    likes = intOr(post, "likesCount", 0),
                    comments = intOr(post, "commentsCount", 0),
                    reposts = 0,
                    isVideo = false
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
            try {
                // Try recommended discovery feed first; fall back to regular followed-only feed
                var postFetched = false
                try {
                    val recResp = withContext(ioDispatcher) { authApi.getRecommendedFeed(page = 1, limit = 10) }
                    if (recResp.isSuccessful) {
                        val dataArray = recResp.body()?.getAsJsonArray("data")
                        posts = if (dataArray != null) parsePosts(dataArray) else emptyList()
                        postFetched = true
                    }
                } catch (_: Exception) { }

                if (!postFetched) {
                    val postResponse = withContext(ioDispatcher) { authApi.getPostFeed(page = 1, limit = 10) }
                    if (postResponse.isSuccessful) {
                        val dataArray = postResponse.body()?.getAsJsonArray("data")
                        posts = if (dataArray != null) parsePosts(dataArray) else emptyList()
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
