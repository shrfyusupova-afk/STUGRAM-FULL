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

enum class ReelsTab { FOR_YOU, FOLLOWING }

class ReelsViewModel(
    private val authApi: AuthApi = RetrofitClient.instance,
    private val ioDispatcher: CoroutineDispatcher = Dispatchers.IO
) : ViewModel() {

    var reels by mutableStateOf(emptyList<ReelItem>())
        private set
    var isLoading by mutableStateOf(false)
        private set
    var error by mutableStateOf<String?>(null)
        private set

    // UI-only state that survives across scrolls
    var isMuted by mutableStateOf(true)
        private set
    var savedIds by mutableStateOf(setOf<String>())
        private set
    var dismissedIds by mutableStateOf(setOf<String>())
        private set

    var selectedTab by mutableStateOf(ReelsTab.FOR_YOU)
        private set

    private var rawReels: List<ReelItem> = emptyList()

    init {
        loadReels()
    }

    fun selectTab(tab: ReelsTab) {
        if (tab == selectedTab) return
        selectedTab = tab
        loadReels()
    }

    fun loadReels() {
        viewModelScope.launch {
            isLoading = true
            error = null
            try {
                val resp = withContext(ioDispatcher) {
                    when (selectedTab) {
                        ReelsTab.FOR_YOU -> authApi.getRecommendedReels(page = 1, limit = 15)
                        ReelsTab.FOLLOWING -> authApi.getPostFeed(page = 1, limit = 15)
                    }
                }
                if (resp.isSuccessful) {
                    val parsed = parseReels(resp.body())
                    rawReels = if (selectedTab == ReelsTab.FOLLOWING) {
                        // Following tab: only show video posts
                        parsed.filter { it.isVideo }
                    } else parsed
                    reels = rankReels(rawReels, dismissedIds)
                    if (reels.isEmpty()) {
                        error = if (selectedTab == ReelsTab.FOLLOWING)
                            "Kuzatayotgan odamlarda hozircha reels yo'q"
                        else "Hech qanday reel topilmadi"
                    }
                } else {
                    error = "Reels yuklanmadi (${resp.code()})"
                    reels = emptyList()
                }
            } catch (e: Exception) {
                error = "Tarmoq xatosi: ${e.message}"
                reels = emptyList()
            } finally {
                isLoading = false
            }
        }
    }

    fun toggleMute() { isMuted = !isMuted }

    fun toggleSave(id: String) {
        val wasSaved = id in savedIds
        savedIds = if (wasSaved) savedIds - id else savedIds + id
        viewModelScope.launch {
            try {
                withContext(ioDispatcher) {
                    if (wasSaved) authApi.unsavePost(id) else authApi.savePost(id)
                }
            } catch (_: Exception) {
                savedIds = if (wasSaved) savedIds + id else savedIds - id
            }
        }
    }

    fun isSaved(id: String): Boolean = id in savedIds

    fun markNotInterested(id: String) {
        dismissedIds = dismissedIds + id
        reels = rankReels(rawReels, dismissedIds)
    }

    /**
     * Stugram Reels ranking algorithm.
     * Score = engagement signals + content boosts. Higher score → appears earlier.
     *
     * - log-dampened engagement so a viral post doesn't bury everything
     * - video reels get a strong boost (this IS the reels tab)
     * - reels with captions are more engaging — small boost
     * - dismissed reels are filtered out entirely
     */
    private fun rankReels(items: List<ReelItem>, dismissed: Set<String>): List<ReelItem> {
        return items
            .filter { it.id !in dismissed }
            .sortedByDescending { reel ->
                val likeSignal = kotlin.math.ln((reel.likes + 1).toDouble()) * 18.0
                val commentSignal = kotlin.math.ln((reel.comments + 1).toDouble()) * 32.0
                val videoBoost = if (reel.isVideo) 40.0 else 0.0
                val captionBoost = if (reel.caption.isNotBlank()) 12.0 else 0.0
                val mediaBoost = if (!reel.mediaUrl.isNullOrBlank()) 20.0 else 0.0
                likeSignal + commentSignal + videoBoost + captionBoost + mediaBoost
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
