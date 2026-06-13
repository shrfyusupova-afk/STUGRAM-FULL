package com.example.myapplication.ui.home

import androidx.compose.runtime.Immutable
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.myapplication.data.remote.AddCommentRequest
import com.example.myapplication.data.remote.AuthApi
import com.example.myapplication.data.remote.RetrofitClient
import com.google.gson.JsonObject
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

@Immutable
data class CommentItem(
    val id: String,
    val author: String,
    val avatar: String,
    val text: String,
    val createdAt: String
)

data class CommentsUiState(
    val isLoading: Boolean = false,
    val isPosting: Boolean = false,
    val error: String? = null,
    val items: List<CommentItem> = emptyList(),
    val totalCount: Int = 0
)

class CommentsViewModel(
    private val authApi: AuthApi = RetrofitClient.instance,
    private val ioDispatcher: CoroutineDispatcher = Dispatchers.IO
) : ViewModel() {

    private val _uiState = MutableStateFlow(CommentsUiState())
    val uiState: StateFlow<CommentsUiState> = _uiState.asStateFlow()

    private var activePostId: String? = null

    fun open(postId: String, initialCount: Int) {
        if (postId.isBlank()) return
        if (activePostId == postId && _uiState.value.items.isNotEmpty()) return
        activePostId = postId
        _uiState.update { it.copy(totalCount = initialCount) }
        load()
    }

    fun load() {
        val postId = activePostId ?: return
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }
            try {
                val resp = withContext(ioDispatcher) {
                    authApi.getPostComments(postId = postId, page = 1, limit = 30)
                }
                if (resp.isSuccessful) {
                    val items = parseComments(resp.body())
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            items = items,
                            totalCount = maxOf(it.totalCount, items.size)
                        )
                    }
                } else {
                    _uiState.update { it.copy(isLoading = false, error = "Izohlar yuklanmadi (${resp.code()})") }
                }
            } catch (e: Exception) {
                _uiState.update { it.copy(isLoading = false, error = "Tarmoq xatosi") }
            }
        }
    }

    fun postComment(content: String, onSuccess: () -> Unit = {}) {
        val postId = activePostId ?: return
        val trimmed = content.trim()
        if (trimmed.isEmpty()) return

        viewModelScope.launch {
            _uiState.update { it.copy(isPosting = true) }
            try {
                val resp = withContext(ioDispatcher) {
                    authApi.addPostComment(postId, AddCommentRequest(content = trimmed))
                }
                if (resp.isSuccessful) {
                    onSuccess()
                    load()
                    _uiState.update { it.copy(totalCount = it.totalCount + 1) }
                } else {
                    _uiState.update { it.copy(error = "Izoh yuborilmadi (${resp.code()})") }
                }
            } catch (e: Exception) {
                _uiState.update { it.copy(error = "Tarmoq xatosi") }
            } finally {
                _uiState.update { it.copy(isPosting = false) }
            }
        }
    }

    fun close() {
        activePostId = null
        _uiState.value = CommentsUiState()
    }

    private fun parseComments(body: JsonObject?): List<CommentItem> {
        val data = body?.getAsJsonArray("data") ?: return emptyList()
        return data.mapNotNull { el ->
            runCatching {
                val obj = el.asJsonObject
                val id = obj.get("_id")?.takeIf { !it.isJsonNull }?.asString ?: return@runCatching null
                val author = if (obj.has("author") && !obj.get("author").isJsonNull) obj.getAsJsonObject("author") else null
                val username = author?.get("username")?.takeIf { !it.isJsonNull }?.asString ?: "user"
                val avatar = author?.get("avatar")?.takeIf { !it.isJsonNull }?.asString ?: ""
                val content = obj.get("content")?.takeIf { !it.isJsonNull }?.asString ?: ""
                val createdAt = obj.get("createdAt")?.takeIf { !it.isJsonNull }?.asString ?: ""
                CommentItem(
                    id = id,
                    author = username,
                    avatar = avatar,
                    text = content,
                    createdAt = formatRelativeTime(createdAt)
                )
            }.getOrNull()
        }
    }

    private fun formatRelativeTime(iso: String): String {
        if (iso.isBlank()) return ""
        return try {
            val parsed = java.time.Instant.parse(iso)
            val now = java.time.Instant.now()
            val sec = java.time.Duration.between(parsed, now).seconds
            when {
                sec < 60 -> "hozir"
                sec < 3600 -> "${sec / 60}d"
                sec < 86400 -> "${sec / 3600}s"
                sec < 2592000 -> "${sec / 86400}k"
                else -> "${sec / 2592000}o"
            }
        } catch (_: Exception) { "" }
    }
}
