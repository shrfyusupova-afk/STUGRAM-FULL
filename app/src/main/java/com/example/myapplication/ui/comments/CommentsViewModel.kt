package com.example.myapplication.ui.comments

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.myapplication.core.ui.UiState
import com.example.myapplication.data.remote.post.CommentDto
import com.example.myapplication.data.remote.post.PostRepository
import com.example.myapplication.data.remote.post.PostResult
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class CommentsViewModel(
    private val repository: PostRepository = PostRepository(),
    private val ioDispatcher: CoroutineDispatcher = Dispatchers.IO
) : ViewModel() {

    var commentsState by mutableStateOf<UiState<List<CommentDto>>>(UiState.Loading)
        private set
    var input by mutableStateOf("")
        private set
    var isSending by mutableStateOf(false)
        private set
    var sendError by mutableStateOf<String?>(null)
        private set
    var replyingTo by mutableStateOf<CommentDto?>(null)
        private set
    var isLoadingMore by mutableStateOf(false)
        private set

    private var postId: String = ""
    private var page = 1
    private var totalPages = 1
    private val loaded = mutableListOf<CommentDto>()

    fun start(targetPostId: String) {
        if (postId == targetPostId && commentsState !is UiState.Error) return
        postId = targetPostId
        reload()
    }

    fun reload() {
        page = 1
        totalPages = 1
        loaded.clear()
        commentsState = UiState.Loading
        load()
    }

    fun loadMore() {
        if (isLoadingMore || page >= totalPages) return
        page += 1
        load(isMore = true)
    }

    private fun load(isMore: Boolean = false) {
        viewModelScope.launch {
            if (isMore) isLoadingMore = true
            val result = withContext(ioDispatcher) { repository.getComments(postId, page, PAGE_SIZE) }
            isLoadingMore = false
            when (result) {
                is PostResult.Success -> {
                    loaded += result.value.items
                    totalPages = result.value.totalPages
                    commentsState = if (loaded.isEmpty()) UiState.Empty else UiState.Success(loaded.toList())
                }
                is PostResult.Error -> {
                    // Only replace the screen with an error if we have nothing yet;
                    // a failed "load more" keeps the existing list visible.
                    if (loaded.isEmpty()) commentsState = UiState.Error(result.message)
                    else page -= 1
                }
            }
        }
    }

    fun onInputChange(value: String) {
        input = value
        sendError = null
    }

    fun setReplyTo(comment: CommentDto?) {
        replyingTo = comment
    }

    fun send() {
        val content = input.trim()
        if (content.isEmpty() || isSending) return
        viewModelScope.launch {
            isSending = true
            sendError = null
            val result = withContext(ioDispatcher) {
                repository.addComment(postId, content, replyingTo?.id)
            }
            isSending = false
            when (result) {
                is PostResult.Success -> {
                    input = ""
                    replyingTo = null
                    reload()
                }
                is PostResult.Error -> sendError = result.message
            }
        }
    }

    private companion object {
        const val PAGE_SIZE = 20
    }
}
