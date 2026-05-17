package com.example.myapplication.ui.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.myapplication.data.remote.chat.ChatApi
import com.example.myapplication.data.remote.chat.ConversationDto
import com.example.myapplication.data.remote.requests.RequestDto
import com.example.myapplication.data.remote.requests.RequestsApi
import com.example.myapplication.data.remote.RetrofitClient as RootRetrofitClient
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

data class AlphaConversationItem(
    val conversationId: String,
    val title: String,
    val subtitle: String,
    val timeLabel: String
)

data class MessagesUiState(
    val isLoading: Boolean = true,
    val error: String? = null,
    val query: String = "",
    val conversations: List<AlphaConversationItem> = emptyList(),
    val requests: List<AlphaRequestItem> = emptyList(),
    val requestsLoading: Boolean = false,
    val requestsError: String? = null,
    val requestActionInProgressId: String? = null
)

data class AlphaRequestItem(
    val id: String,
    val fromUserId: String,
    val fullName: String,
    val username: String
)

class MessagesViewModel(
    private val chatApi: ChatApi = RootRetrofitClient.createService(ChatApi::class.java),
    private val requestsApi: RequestsApi = RootRetrofitClient.createService(RequestsApi::class.java),
    private val ioDispatcher: CoroutineDispatcher = Dispatchers.IO
) : ViewModel() {

    private val _uiState = MutableStateFlow(MessagesUiState())
    val uiState: StateFlow<MessagesUiState> = _uiState.asStateFlow()

    init {
        refresh()
        refreshRequests()
    }

    fun onQueryChange(value: String) {
        _uiState.update { it.copy(query = value) }
    }

    fun refresh() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }
            try {
                val response = withContext(ioDispatcher) { chatApi.getConversations() }
                if (!response.isSuccessful) {
                    _uiState.update {
                        it.copy(isLoading = false, error = "Chatlar yuklanmadi (${response.code()})")
                    }
                    return@launch
                }

                val rows = response.body()?.data.orEmpty().map { dto -> dto.toUi() }
                _uiState.update { it.copy(isLoading = false, conversations = rows, error = null) }
            } catch (e: Exception) {
                _uiState.update { it.copy(isLoading = false, error = "Tarmoq xatosi: ${e.message}") }
            }
        }
    }

    fun refreshRequests() {
        viewModelScope.launch {
            _uiState.update { it.copy(requestsLoading = true, requestsError = null) }
            try {
                val response = withContext(ioDispatcher) { requestsApi.getRequests() }
                if (!response.isSuccessful) {
                    _uiState.update {
                        it.copy(requestsLoading = false, requestsError = "So'rovlar yuklanmadi (${response.code()})")
                    }
                    return@launch
                }
                val items = response.body()?.data?.requests.orEmpty().map { it.toUi() }
                _uiState.update { it.copy(requestsLoading = false, requests = items, requestsError = null) }
            } catch (e: Exception) {
                _uiState.update { it.copy(requestsLoading = false, requestsError = "Tarmoq xatosi: ${e.message}") }
            }
        }
    }

    fun addRequestToChat(requestId: String, onSuccessNavigate: (String) -> Unit) {
        viewModelScope.launch {
            _uiState.update { it.copy(requestActionInProgressId = requestId, requestsError = null) }
            try {
                val response = withContext(ioDispatcher) { requestsApi.addToChat(requestId) }
                if (!response.isSuccessful) {
                    _uiState.update { it.copy(requestActionInProgressId = null, requestsError = "Add to chat xatosi (${response.code()})") }
                    return@launch
                }
                val request = _uiState.value.requests.firstOrNull { it.id == requestId }
                _uiState.update {
                    it.copy(
                        requestActionInProgressId = null,
                        requests = it.requests.filterNot { req -> req.id == requestId }
                    )
                }
                refresh()
                request?.username?.let { uname -> onSuccessNavigate(uname) }
            } catch (e: Exception) {
                _uiState.update { it.copy(requestActionInProgressId = null, requestsError = "Tarmoq xatosi: ${e.message}") }
            }
        }
    }

    fun blockRequestUser(requestId: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(requestActionInProgressId = requestId, requestsError = null) }
            try {
                val response = withContext(ioDispatcher) { requestsApi.blockRequestUser(requestId) }
                if (!response.isSuccessful) {
                    _uiState.update { it.copy(requestActionInProgressId = null, requestsError = "Block xatosi (${response.code()})") }
                    return@launch
                }
                _uiState.update {
                    it.copy(
                        requestActionInProgressId = null,
                        requests = it.requests.filterNot { req -> req.id == requestId }
                    )
                }
            } catch (e: Exception) {
                _uiState.update { it.copy(requestActionInProgressId = null, requestsError = "Tarmoq xatosi: ${e.message}") }
            }
        }
    }

    fun removeRequest(requestId: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(requestActionInProgressId = requestId, requestsError = null) }
            try {
                val response = withContext(ioDispatcher) { requestsApi.deleteRequest(requestId) }
                if (!response.isSuccessful) {
                    _uiState.update { it.copy(requestActionInProgressId = null, requestsError = "Delete xatosi (${response.code()})") }
                    return@launch
                }
                _uiState.update {
                    it.copy(
                        requestActionInProgressId = null,
                        requests = it.requests.filterNot { req -> req.id == requestId }
                    )
                }
            } catch (e: Exception) {
                _uiState.update { it.copy(requestActionInProgressId = null, requestsError = "Tarmoq xatosi: ${e.message}") }
            }
        }
    }

    private fun ConversationDto.toUi(): AlphaConversationItem {
        val other = otherParticipant
        val title = when {
            !other?.fullName.isNullOrBlank() -> other?.fullName.orEmpty()
            !other?.username.isNullOrBlank() -> other?.username.orEmpty()
            else -> "Unknown user"
        }
        return AlphaConversationItem(
            conversationId = _id,
            title = title,
            subtitle = lastMessage ?: "No messages yet",
            timeLabel = ""
        )
    }

    private fun RequestDto.toUi(): AlphaRequestItem {
        return AlphaRequestItem(
            id = id,
            fromUserId = fromUser?.id.orEmpty(),
            fullName = fromUser?.name?.ifBlank { "Unknown user" } ?: "Unknown user",
            username = fromUser?.username.orEmpty()
        )
    }
}
