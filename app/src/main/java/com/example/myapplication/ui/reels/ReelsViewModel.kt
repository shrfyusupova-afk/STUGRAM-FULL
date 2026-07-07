package com.example.myapplication.ui.reels

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.myapplication.core.ui.UiState
import com.example.myapplication.data.remote.post.PostRepository
import com.example.myapplication.data.remote.post.PostResult
import com.example.myapplication.ui.home.PostData
import com.example.myapplication.ui.home.toPostDataOrNull
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * Reels tab state. Reels are video posts served by GET /api/v1/reels/me
 * (recommendation surface "reels", media.type == "video"). Same UiState +
 * pagination pattern as HomeViewModel.
 */
class ReelsViewModel(
    private val repository: PostRepository = PostRepository(),
    private val ioDispatcher: CoroutineDispatcher = Dispatchers.IO
) : ViewModel() {

    var reelsState by mutableStateOf<UiState<List<PostData>>>(UiState.Loading)
        private set
    var isLoadingMore by mutableStateOf(false)
        private set
    var activeCommentsPostId by mutableStateOf<String?>(null)
        private set

    private val loaded = mutableListOf<PostData>()
    private var page = 1
    private var totalPages = 1

    init {
        reload()
    }

    fun reload() {
        viewModelScope.launch {
            page = 1
            totalPages = 1
            loaded.clear()
            reelsState = UiState.Loading
            fetchPage()
        }
    }

    fun loadMore() {
        if (isLoadingMore || page >= totalPages || reelsState !is UiState.Success) return
        viewModelScope.launch {
            isLoadingMore = true
            page += 1
            fetchPage(isMore = true)
            isLoadingMore = false
        }
    }

    private suspend fun fetchPage(isMore: Boolean = false) {
        when (val result = withContext(ioDispatcher) { repository.getReels(page, PAGE_SIZE) }) {
            is PostResult.Success -> {
                // Only playable items: a reel without a video URL can't render.
                loaded += result.value.items.mapNotNull { it.toPostDataOrNull() }
                    .filter { !it.videoUrl.isNullOrBlank() }
                totalPages = result.value.totalPages
                reelsState = if (loaded.isEmpty()) UiState.Empty else UiState.Success(loaded.toList())
            }
            is PostResult.Error -> {
                if (isMore) {
                    // Non-fatal: keep the current list, roll the page back.
                    page -= 1
                } else {
                    reelsState = UiState.Error(result.message)
                }
            }
        }
    }

    /** Returns whether the like/unlike succeeded so the UI can revert optimistically. */
    suspend fun setLike(postId: String, like: Boolean): Boolean {
        val result = withContext(ioDispatcher) {
            if (like) repository.likePost(postId) else repository.unlikePost(postId)
        }
        return result is PostResult.Success
    }

    fun openComments(postId: String) {
        activeCommentsPostId = postId
    }

    fun closeComments() {
        activeCommentsPostId = null
    }

    private companion object {
        const val PAGE_SIZE = 10
    }
}
