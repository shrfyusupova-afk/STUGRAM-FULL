package com.example.myapplication.data.remote.post

import com.google.gson.annotations.SerializedName

/**
 * Typed mirrors of the real backend JSON. Every field is nullable because the
 * server omits defaults; the mappers (not the DTOs) decide fallbacks. This
 * replaces all hand-rolled JsonObject walking.
 *
 * Envelope: { success, message, data, meta } (see utils/apiResponse.js).
 */
data class ApiEnvelope<T>(
    val success: Boolean? = null,
    val message: String? = null,
    val data: T? = null,
    val meta: PaginationMeta? = null
)

data class PaginationMeta(
    val page: Int? = null,
    val limit: Int? = null,
    val total: Int? = null,
    val totalPages: Int? = null
)

data class UserPreviewDto(
    @SerializedName("_id") val id: String? = null,
    val username: String? = null,
    val fullName: String? = null,
    val avatar: String? = null
)

data class MediaDto(
    val url: String? = null,
    val type: String? = null,          // "image" | "video"
    val thumbnailUrl: String? = null
)

data class PostDto(
    @SerializedName("_id") val id: String? = null,
    val author: UserPreviewDto? = null,
    val media: List<MediaDto>? = null,
    val caption: String? = null,
    val likesCount: Int? = null,
    val commentsCount: Int? = null,
    val createdAt: String? = null
)

data class StoryMediaDto(
    val url: String? = null,
    val type: String? = null
)

data class StoryDto(
    @SerializedName("_id") val id: String? = null,
    val author: UserPreviewDto? = null,
    val media: StoryMediaDto? = null,
    val caption: String? = null,
    val createdAt: String? = null,
    val isViewedByMe: Boolean? = null,
    val isLikedByMe: Boolean? = null
)

data class ParentCommentRef(
    @SerializedName("_id") val id: String? = null,
    val content: String? = null
)

data class CommentDto(
    @SerializedName("_id") val id: String? = null,
    val author: UserPreviewDto? = null,
    val content: String? = null,
    val createdAt: String? = null,
    val parentComment: ParentCommentRef? = null,
    val repliesCount: Int? = null
)

data class AddCommentRequest(
    val content: String,
    val parentCommentId: String? = null
)

data class SearchUserDto(
    @SerializedName("_id") val id: String? = null,
    val username: String? = null,
    val fullName: String? = null,
    val avatar: String? = null,
    val bio: String? = null,
    val followStatus: String? = null
)

data class ProfileDto(
    @SerializedName("_id") val id: String? = null,
    val fullName: String? = null,
    val username: String? = null,
    val bio: String? = null,
    val avatar: String? = null,
    val banner: String? = null,
    val location: String? = null,
    val school: String? = null,
    val grade: String? = null,
    val group: String? = null,
    val followersCount: Int? = null,
    val followingCount: Int? = null,
    val postsCount: Int? = null,
    val followStatus: String? = null
)

data class HighlightDto(
    @SerializedName("_id") val id: String? = null,
    val title: String? = null,
    val coverImageUrl: String? = null
)
