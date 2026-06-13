package com.example.myapplication.ui.home

import androidx.compose.runtime.Immutable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector

// --- GLOBAL KONSTANTALAR ---
val GlobalBackgroundColor = Color(0xFF0F0F0F)

// --- MA'LUMOT MODELLARI ---
@Immutable
data class PostMedia(
    val url: String,
    val isVideo: Boolean
)

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
    val media: List<PostMedia> = emptyList(),
    val authorAvatar: String = ""
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
data class TabItem(val name: String, val icon: ImageVector)

@Immutable
data class RecommendedProfile(
    val id: String,
    val name: String,
    val username: String,
    val avatar: String = "",
    val banner: String = "",
    val bio: String = "",
    val followersCount: Int = 0,
    val followStatus: String = "not_following"
)

@Immutable
data class ReelItem(
    val id: String,
    val authorUsername: String,
    val authorAvatar: String = "",
    val mediaUrl: String?,
    val caption: String,
    val likes: Int = 0,
    val comments: Int = 0,
    val isVideo: Boolean = true
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

@Immutable
data class StoryHighlight(
    val id: String,
    val title: String,
    val coverUrl: String?
)
