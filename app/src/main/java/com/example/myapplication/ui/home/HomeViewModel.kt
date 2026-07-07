package com.example.myapplication.ui.home

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.myapplication.config.AlphaFeatureFlags
import com.example.myapplication.core.ui.UiState
import com.example.myapplication.data.remote.AuthApi
import com.example.myapplication.data.remote.RetrofitClient
import com.example.myapplication.data.remote.post.PostRepository
import com.example.myapplication.data.remote.post.PostResult
import com.example.myapplication.ui.create.CreateType
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class HomeViewModel(
    private val repository: PostRepository = PostRepository(),
    private val authApi: AuthApi = RetrofitClient.instance,
    private val ioDispatcher: CoroutineDispatcher = Dispatchers.IO
) : ViewModel() {

    var currentTab by mutableIntStateOf(0)
    var activeStoryProfileIndex by mutableStateOf<Int?>(null)
    var createFlowType by mutableStateOf<CreateType?>(null)
    var activeCommentsPostId by mutableStateOf<String?>(null)

    var isHomeRefreshing by mutableStateOf(false)
    var isSearchRefreshing by mutableStateOf(false)
    var isProfileRefreshing by mutableStateOf(false)

    var feedState by mutableStateOf<UiState<List<PostData>>>(UiState.Loading)
        private set
    var isLoadingMore by mutableStateOf(false)
        private set

    var storyProfiles by mutableStateOf(emptyList<StoryProfile>())
        private set
    var recommendedProfiles by mutableStateOf(emptyList<RecommendedProfile>())
        private set

    // Kept for the story viewer; populated by the story-insights endpoints later.
    var myStoryActivities by mutableStateOf(
        Triple(
            emptyList<StoryActivityUser>(),
            emptyList<StoryActivityUser>(),
            emptyList<StoryActivityUser>()
        )
    )
        private set

    private val loadedPosts = mutableListOf<PostData>()
    private var feedPage = 1
    private var feedTotalPages = 1

    val feedHasMore: Boolean get() = feedPage < feedTotalPages

    init {
        loadHomeFeed()
    }

    fun onTabSelected(index: Int) {
        currentTab = if (AlphaFeatureFlags.isHomeTabEnabled(index)) index else 0
    }

    fun openCreateFlow(type: CreateType) {
        if (AlphaFeatureFlags.canOpenCameraCreate()) createFlowType = type
    }

    fun closeCreateFlow() {
        createFlowType = null
    }

    fun openStory(index: Int) {
        if (AlphaFeatureFlags.canOpenStoryViewer()) activeStoryProfileIndex = index
    }

    fun closeStory() {
        activeStoryProfileIndex = null
    }

    fun openComments(postId: String) {
        activeCommentsPostId = postId
    }

    fun closeComments() {
        activeCommentsPostId = null
    }

    fun loadHomeFeed() {
        viewModelScope.launch {
            isHomeRefreshing = true
            feedPage = 1
            if (loadedPosts.isEmpty()) feedState = UiState.Loading

            when (val result = withContext(ioDispatcher) { repository.getFeed(feedPage, PAGE_SIZE) }) {
                is PostResult.Success -> {
                    loadedPosts.clear()
                    loadedPosts += result.value.items.mapNotNull { it.toPostDataOrNull() }
                    feedTotalPages = result.value.totalPages
                    feedState = if (loadedPosts.isEmpty()) UiState.Empty else UiState.Success(loadedPosts.toList())
                }
                is PostResult.Error -> {
                    feedState = if (loadedPosts.isEmpty()) UiState.Error(result.message)
                    else UiState.Success(loadedPosts.toList())
                }
            }

            loadStories()
            loadRecommendedProfiles()
            isHomeRefreshing = false
        }
    }

    fun loadNextPage() {
        if (isLoadingMore || feedPage >= feedTotalPages || feedState !is UiState.Success) return
        viewModelScope.launch {
            isLoadingMore = true
            feedPage += 1
            when (val result = withContext(ioDispatcher) { repository.getFeed(feedPage, PAGE_SIZE) }) {
                is PostResult.Success -> {
                    loadedPosts += result.value.items.mapNotNull { it.toPostDataOrNull() }
                    feedTotalPages = result.value.totalPages
                    feedState = UiState.Success(loadedPosts.toList())
                }
                // A failed "load more" is non-fatal: keep the current list, roll the page back.
                is PostResult.Error -> feedPage -= 1
            }
            isLoadingMore = false
        }
    }

    private suspend fun loadStories() {
        if (!AlphaFeatureFlags.STORIES_ENABLED) {
            storyProfiles = emptyList()
            return
        }
        when (val result = withContext(ioDispatcher) { repository.getStoriesFeed() }) {
            is PostResult.Success -> storyProfiles = result.value.toStoryProfiles()
            // Stories are supplementary — on error we simply hide the ring row.
            is PostResult.Error -> storyProfiles = emptyList()
        }
    }

    private suspend fun loadRecommendedProfiles() {
        if (!AlphaFeatureFlags.SEARCH_DISCOVERY_ENABLED) return
        when (val result = withContext(ioDispatcher) { repository.getCreatorSuggestions() }) {
            is PostResult.Success -> recommendedProfiles = result.value.toRecommendedProfiles()
            is PostResult.Error -> Unit // keep whatever we had; not blocking the feed
        }
    }

    /**
     * Toggles a like and returns whether it succeeded, so the caller can revert
     * its optimistic UI on failure (the error is surfaced by that revert).
     */
    suspend fun setLike(postId: String, like: Boolean): Boolean {
        val result = withContext(ioDispatcher) {
            if (like) repository.likePost(postId) else repository.unlikePost(postId)
        }
        return result is PostResult.Success
    }

    fun followSuggestedUser(userId: String) {
        if (userId.isBlank()) return
        viewModelScope.launch {
            runCatching { withContext(ioDispatcher) { authApi.followUser(userId) } }
        }
    }

    fun refreshHome() = loadHomeFeed()

    fun refreshSearch() {
        viewModelScope.launch {
            isSearchRefreshing = true
            withContext(ioDispatcher) { /* search screen owns its own reload */ }
            isSearchRefreshing = false
        }
    }

    fun refreshProfile() {
        viewModelScope.launch {
            isProfileRefreshing = true
            withContext(ioDispatcher) { /* profile screen owns its own reload */ }
            isProfileRefreshing = false
        }
    }

    private companion object {
        const val PAGE_SIZE = 15
    }
}
