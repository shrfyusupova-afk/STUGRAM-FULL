package com.example.myapplication.ui.home

import androidx.compose.runtime.Immutable
import androidx.compose.ui.graphics.Color

// --- GLOBAL KONSTANTALAR ---
val GlobalBackgroundColor = Color(0xFF0F0F0F)

// --- MA'LUMOT MODELLARI ---
@Immutable
data class PostData(
    val id: String,
    val user: String,
    val image: String? = null,
    val caption: String = "",
    val likes: Int = 0,
    val comments: Int = 0,
    val reposts: Int = 0,
    val isVideo: Boolean = false,
    val avatar: String? = null,
    val videoUrl: String? = null
)

@Immutable
data class StoryMedia(val id: Int, val mediaUrl: String, val isVideo: Boolean = false)

@Immutable
data class StoryProfile(
    val id: Int,
    val name: String,
    val avatar: String,
    val stories: List<StoryMedia>,
    val isLive: Boolean = false,
    val isSeen: Boolean = false,
    val isMine: Boolean = false
)

@Immutable
data class StoryActivityUser(
    val name: String,
    val avatar: String,
    val subtitle: String
)

@Immutable
data class RecommendedProfile(
    val id: Int,
    val name: String,
    val image: String,
    val username: String,
    val userId: String = ""
)

@Immutable
data class CommentData(
    val id: Int,
    val user: String,
    val avatar: String,
    val text: String,
    val time: String,
    val likes: Int = 0,
    val replies: List<CommentData> = emptyList()
)
