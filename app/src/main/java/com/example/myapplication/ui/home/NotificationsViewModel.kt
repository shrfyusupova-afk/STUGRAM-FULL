package com.example.myapplication.ui.home

import androidx.compose.runtime.Immutable
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
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
data class NotificationItem(
    val id: String,
    val type: String,                // like / comment / follow / reply / mention
    val actorUsername: String,
    val actorAvatar: String,
    val message: String,
    val timeAgo: String,
    val isRead: Boolean,
    val postId: String? = null,
    val postPreview: String? = null
)

data class NotificationsUiState(
    val isLoading: Boolean = false,
    val isRefreshing: Boolean = false,
    val error: String? = null,
    val items: List<NotificationItem> = emptyList(),
    val unreadCount: Int = 0
)

class NotificationsViewModel(
    private val authApi: AuthApi = RetrofitClient.instance,
    private val ioDispatcher: CoroutineDispatcher = Dispatchers.IO
) : ViewModel() {

    private val _uiState = MutableStateFlow(NotificationsUiState())
    val uiState: StateFlow<NotificationsUiState> = _uiState.asStateFlow()

    init {
        load()
    }

    fun load() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }
            try {
                val resp = withContext(ioDispatcher) { authApi.getNotifications(page = 1, limit = 30) }
                if (resp.isSuccessful) {
                    val items = parseNotifications(resp.body())
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            items = items,
                            unreadCount = items.count { n -> !n.isRead }
                        )
                    }
                } else {
                    _uiState.update { it.copy(isLoading = false, error = "Bildirishnomalar yuklanmadi (${resp.code()})") }
                }
            } catch (e: Exception) {
                _uiState.update { it.copy(isLoading = false, error = "Tarmoq xatosi") }
            }
        }
    }

    fun refresh() {
        viewModelScope.launch {
            _uiState.update { it.copy(isRefreshing = true) }
            try {
                val resp = withContext(ioDispatcher) { authApi.getNotifications(page = 1, limit = 30) }
                if (resp.isSuccessful) {
                    val items = parseNotifications(resp.body())
                    _uiState.update {
                        it.copy(
                            items = items,
                            unreadCount = items.count { n -> !n.isRead }
                        )
                    }
                }
            } catch (_: Exception) {
            } finally {
                _uiState.update { it.copy(isRefreshing = false) }
            }
        }
    }

    fun markAllRead() {
        viewModelScope.launch {
            try {
                withContext(ioDispatcher) { authApi.markAllNotificationsRead() }
                _uiState.update {
                    it.copy(
                        items = it.items.map { n -> n.copy(isRead = true) },
                        unreadCount = 0
                    )
                }
            } catch (_: Exception) {
            }
        }
    }

    fun markRead(id: String) {
        val current = _uiState.value
        val target = current.items.firstOrNull { it.id == id } ?: return
        if (target.isRead) return
        _uiState.update {
            it.copy(
                items = it.items.map { n -> if (n.id == id) n.copy(isRead = true) else n },
                unreadCount = (it.unreadCount - 1).coerceAtLeast(0)
            )
        }
        viewModelScope.launch {
            try { withContext(ioDispatcher) { authApi.markNotificationRead(id) } } catch (_: Exception) {}
        }
    }

    private fun parseNotifications(body: JsonObject?): List<NotificationItem> {
        val data = body?.getAsJsonArray("data") ?: return emptyList()
        return data.mapNotNull { el ->
            runCatching {
                val obj = el.asJsonObject
                val id = obj.get("_id")?.takeIf { !it.isJsonNull }?.asString ?: return@runCatching null
                val type = obj.get("type")?.takeIf { !it.isJsonNull }?.asString ?: "system"
                val actor = if (obj.has("actor") && !obj.get("actor").isJsonNull) obj.getAsJsonObject("actor") else null
                val actorUsername = actor?.get("username")?.takeIf { !it.isJsonNull }?.asString ?: "stugram"
                val actorAvatar = actor?.get("avatar")?.takeIf { !it.isJsonNull }?.asString ?: ""
                val message = obj.get("message")?.takeIf { !it.isJsonNull }?.asString ?: defaultMessage(type)
                val isRead = obj.get("isRead")?.takeIf { !it.isJsonNull }?.asBoolean ?: false
                val createdAt = obj.get("createdAt")?.takeIf { !it.isJsonNull }?.asString ?: ""
                val postId = obj.get("post")?.takeIf { !it.isJsonNull }?.let {
                    if (it.isJsonObject) it.asJsonObject.get("_id")?.takeIf { v -> !v.isJsonNull }?.asString
                    else it.asString
                }
                val postPreview = obj.get("post")?.takeIf { !it.isJsonNull && it.isJsonObject }?.asJsonObject
                    ?.let { p ->
                        val media = if (p.has("media") && p.get("media").isJsonArray) p.getAsJsonArray("media") else null
                        media?.firstOrNull()?.asJsonObject?.let { m ->
                            m.get("url")?.takeIf { !it.isJsonNull }?.asString
                        }
                    }

                NotificationItem(
                    id = id,
                    type = type,
                    actorUsername = actorUsername,
                    actorAvatar = actorAvatar,
                    message = message,
                    timeAgo = formatRelativeTime(createdAt),
                    isRead = isRead,
                    postId = postId,
                    postPreview = postPreview
                )
            }.getOrNull()
        }
    }

    private fun defaultMessage(type: String): String = when (type) {
        "like" -> "postingizni yoqtirdi"
        "comment" -> "postingizga izoh qoldirdi"
        "reply" -> "izohingizga javob berdi"
        "follow" -> "sizni kuzata boshladi"
        "mention" -> "sizni eslatdi"
        else -> "yangi faoliyat"
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
