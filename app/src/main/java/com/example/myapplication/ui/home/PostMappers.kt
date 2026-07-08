package com.example.myapplication.ui.home

import com.example.myapplication.data.remote.post.PostDto
import com.example.myapplication.data.remote.post.StoryDto
import com.example.myapplication.data.remote.post.UserPreviewDto
import java.time.Instant

/**
 * Pure DTO -> presentation-model mappers. No network, no error handling — the
 * repository already surfaced failures; here we only shape valid data.
 */

fun PostDto.toPostDataOrNull(): PostData? {
    val postId = id ?: return null
    val first = media?.firstOrNull()
    val isVideo = first?.type == "video"
    val displayImage = if (isVideo) (first?.thumbnailUrl ?: first?.url) else first?.url
    return PostData(
        id = postId,
        user = author?.username?.takeIf { it.isNotBlank() } ?: author?.fullName ?: "user",
        image = displayImage,
        caption = caption.orEmpty(),
        likes = likesCount ?: 0,
        comments = commentsCount ?: 0,
        isVideo = isVideo,
        avatar = author?.avatar,
        videoUrl = if (isVideo) first?.url else null
    )
}

/** Groups a flat story feed (one item per story) into per-author story rings. */
fun List<StoryDto>.toStoryProfiles(): List<StoryProfile> {
    return this
        .filter { it.author?.id != null && !it.media?.url.isNullOrBlank() }
        .groupBy { it.author!!.id!! }
        .entries
        .mapIndexed { index, entry ->
            val stories = entry.value
            val author = stories.first().author!!
            StoryProfile(
                id = index + 1,
                name = author.fullName?.takeIf { it.isNotBlank() } ?: author.username ?: "User",
                avatar = author.avatar.orEmpty(),
                stories = stories.mapIndexed { sIdx, s ->
                    StoryMedia(id = sIdx + 1, mediaUrl = s.media!!.url!!, isVideo = s.media.type == "video")
                },
                isSeen = stories.all { it.isViewedByMe == true },
                isMine = false
            )
        }
}

fun List<UserPreviewDto>.toRecommendedProfiles(): List<RecommendedProfile> =
    mapIndexedNotNull { index, user ->
        val username = user.username ?: return@mapIndexedNotNull null
        RecommendedProfile(
            id = index + 1,
            name = user.fullName?.takeIf { it.isNotBlank() } ?: username,
            image = user.avatar.orEmpty(),
            username = username,
            userId = user.id.orEmpty()
        )
    }

/** "just now" / "5m" / "3h" / "2d" / "5w" from an ISO-8601 timestamp. */
fun formatRelativeTime(iso: String?): String {
    if (iso.isNullOrBlank()) return ""
    val epoch = runCatching { Instant.parse(iso).toEpochMilli() }.getOrNull() ?: return ""
    val diff = (System.currentTimeMillis() - epoch).coerceAtLeast(0)
    val minutes = diff / 60_000
    val hours = minutes / 60
    val days = hours / 24
    return when {
        minutes < 1 -> "hozir"
        minutes < 60 -> "${minutes}m"
        hours < 24 -> "${hours}h"
        days < 7 -> "${days}d"
        else -> "${days / 7}w"
    }
}
