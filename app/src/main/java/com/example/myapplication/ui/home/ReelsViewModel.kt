package com.example.myapplication.ui.home

import androidx.compose.runtime.*
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.myapplication.data.remote.AuthApi
import com.example.myapplication.data.remote.RetrofitClient
import com.google.gson.JsonObject
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class ReelsViewModel(
    private val authApi: AuthApi = RetrofitClient.instance,
    private val ioDispatcher: CoroutineDispatcher = Dispatchers.IO
) : ViewModel() {

    var reels by mutableStateOf(emptyList<ReelItem>())
    var isLoading by mutableStateOf(false)
    var error by mutableStateOf<String?>(null)

    init {
        loadReels()
    }

    fun loadReels() {
        viewModelScope.launch {
            isLoading = true
            error = null
            try {
                val resp = withContext(ioDispatcher) { authApi.getRecommendedReels(page = 1, limit = 15) }
                if (resp.isSuccessful) {
                    reels = parseReels(resp.body())
                } else {
                    error = "Reels yuklanmadi (${resp.code()})"
                }
            } catch (e: Exception) {
                error = "Tarmoq xatosi: ${e.message}"
            } finally {
                isLoading = false
            }
        }
    }

    private fun parseReels(body: JsonObject?): List<ReelItem> {
        val data = body?.getAsJsonArray("data") ?: return emptyList()
        return data.mapIndexedNotNull { _, el ->
            runCatching {
                val obj = el.asJsonObject
                val id = if (obj.has("_id") && !obj.get("_id").isJsonNull) obj.get("_id").asString else ""
                if (id.isBlank()) return@runCatching null
                val author = if (obj.has("author") && !obj.get("author").isJsonNull) obj.getAsJsonObject("author") else null
                val media = if (obj.has("media") && obj.get("media").isJsonArray) obj.getAsJsonArray("media") else null
                val firstMedia = media?.firstOrNull()?.asJsonObject
                val mediaUrl = firstMedia?.let {
                    when {
                        it.has("url") && !it.get("url").isJsonNull -> it.get("url").asString
                        it.has("secureUrl") && !it.get("secureUrl").isJsonNull -> it.get("secureUrl").asString
                        else -> null
                    }
                }
                ReelItem(
                    id = id,
                    authorUsername = author?.let {
                        if (it.has("username") && !it.get("username").isJsonNull) it.get("username").asString else "user"
                    } ?: "user",
                    authorAvatar = author?.let {
                        if (it.has("avatar") && !it.get("avatar").isJsonNull) it.get("avatar").asString else ""
                    } ?: "",
                    mediaUrl = mediaUrl,
                    caption = if (obj.has("caption") && !obj.get("caption").isJsonNull) obj.get("caption").asString else "",
                    likes = if (obj.has("likesCount") && !obj.get("likesCount").isJsonNull) obj.get("likesCount").asInt else 0,
                    comments = if (obj.has("commentsCount") && !obj.get("commentsCount").isJsonNull) obj.get("commentsCount").asInt else 0,
                    isVideo = firstMedia?.let {
                        it.has("type") && !it.get("type").isJsonNull && it.get("type").asString == "video"
                    } ?: false
                )
            }.getOrNull()
        }
    }
}
