package com.example.myapplication.data.remote.post

import com.example.myapplication.data.remote.RetrofitClient
import com.google.gson.JsonObject
import java.io.File
import java.io.IOException
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.asRequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import retrofit2.Response

/**
 * Post/story/like/comment data access, mirroring ChatRepository: every call
 * returns a typed [PostResult]; failures are mapped to a message and surfaced,
 * never swallowed. All parsing is via typed DTOs — no JsonObject walking.
 */
sealed class PostResult<out T> {
    data class Success<T>(val value: T) : PostResult<T>()
    data class Error(val code: Int? = null, val message: String) : PostResult<Nothing>()
}

data class PagedResult<T>(
    val items: List<T>,
    val page: Int,
    val totalPages: Int
) {
    val hasNext: Boolean get() = page < totalPages
}

class PostRepository(
    private val api: PostApi = RetrofitClient.createService(PostApi::class.java)
) {
    // --- Reads ---

    suspend fun getFeed(page: Int, limit: Int): PostResult<PagedResult<PostDto>> =
        safePaged { api.getFeed(page, limit) }

    suspend fun getUserPosts(username: String, page: Int, limit: Int): PostResult<PagedResult<PostDto>> =
        safePaged { api.getUserPosts(username, page, limit) }

    suspend fun getStoriesFeed(page: Int = 1, limit: Int = 30): PostResult<List<StoryDto>> =
        safeCall {
            val response = api.getStoriesFeed(page, limit)
            if (response.isSuccessful) PostResult.Success(response.body()?.data.orEmpty())
            else PostResult.Error(response.code(), mapError(response.code()))
        }

    suspend fun getCreatorSuggestions(page: Int = 1, limit: Int = 10): PostResult<List<UserPreviewDto>> =
        safeCall {
            val response = api.getCreatorSuggestions(page, limit)
            if (response.isSuccessful) PostResult.Success(response.body()?.data.orEmpty())
            else PostResult.Error(response.code(), mapError(response.code()))
        }

    suspend fun getReels(page: Int, limit: Int): PostResult<PagedResult<PostDto>> =
        safePaged { api.getReels(page, limit) }

    suspend fun searchUsers(query: String, page: Int = 1, limit: Int = 20): PostResult<List<SearchUserDto>> =
        safeCall {
            val response = api.searchUsers(query, page, limit)
            if (response.isSuccessful) PostResult.Success(response.body()?.data.orEmpty())
            else PostResult.Error(response.code(), mapError(response.code()))
        }

    suspend fun getComments(postId: String, page: Int, limit: Int): PostResult<PagedResult<CommentDto>> =
        safePaged { api.getComments(postId, page, limit) }

    suspend fun getMyProfile(): PostResult<ProfileDto> = safeCall {
        val response = api.getMyProfile()
        val dto = response.body()?.data
        if (response.isSuccessful && dto != null) PostResult.Success(dto)
        else PostResult.Error(response.code(), mapError(response.code()))
    }

    suspend fun getProfileByUsername(username: String): PostResult<ProfileDto> = safeCall {
        val response = api.getProfileByUsername(username)
        val dto = response.body()?.data
        if (response.isSuccessful && dto != null) PostResult.Success(dto)
        else PostResult.Error(response.code(), mapError(response.code()))
    }

    suspend fun getMyHighlights(): PostResult<List<HighlightDto>> = safeCall {
        val response = api.getMyHighlights()
        if (response.isSuccessful) PostResult.Success(response.body()?.data.orEmpty())
        else PostResult.Error(response.code(), mapError(response.code()))
    }

    suspend fun getHighlightsByUsername(username: String): PostResult<List<HighlightDto>> = safeCall {
        val response = api.getHighlightsByUsername(username)
        if (response.isSuccessful) PostResult.Success(response.body()?.data.orEmpty())
        else PostResult.Error(response.code(), mapError(response.code()))
    }

    // --- Mutations ---

    suspend fun likePost(postId: String): PostResult<Unit> = safeUnit { api.likePost(postId) }

    suspend fun unlikePost(postId: String): PostResult<Unit> = safeUnit { api.unlikePost(postId) }

    suspend fun addComment(postId: String, content: String, parentCommentId: String?): PostResult<CommentDto> =
        safeCall {
            val response = api.addComment(postId, AddCommentRequest(content.trim(), parentCommentId))
            val dto = response.body()?.data
            if (response.isSuccessful && dto != null) PostResult.Success(dto)
            else PostResult.Error(response.code(), mapError(response.code()))
        }

    // --- Create (multipart, streamed with progress) ---

    suspend fun createPost(
        files: List<File>,
        isVideo: Boolean,
        caption: String?,
        idempotencyKey: String,
        onProgress: (Float) -> Unit
    ): PostResult<Unit> {
        if (files.isEmpty()) return PostResult.Error(message = "Media tanlanmagan")
        val totalBytes = files.sumOf { it.length() }.coerceAtLeast(1)
        var written = 0L
        val parts = files.map { file ->
            val type = if (isVideo) "video/mp4" else "image/jpeg"
            val body = ProgressRequestBody(file, type.toMediaTypeOrNull()) { chunk ->
                written += chunk
                onProgress((written.toFloat() / totalBytes).coerceIn(0f, 1f))
            }
            MultipartBody.Part.createFormData("media", file.name, body)
        }
        return runCreate(idempotencyKey, caption) { key, captionBody -> api.createPost(key, parts, captionBody) }
    }

    suspend fun createStory(
        file: File,
        isVideo: Boolean,
        caption: String?,
        idempotencyKey: String,
        onProgress: (Float) -> Unit
    ): PostResult<Unit> {
        val total = file.length().coerceAtLeast(1)
        var written = 0L
        val type = if (isVideo) "video/mp4" else "image/jpeg"
        val body = ProgressRequestBody(file, type.toMediaTypeOrNull()) { chunk ->
            written += chunk
            onProgress((written.toFloat() / total).coerceIn(0f, 1f))
        }
        val part = MultipartBody.Part.createFormData("media", file.name, body)
        return runCreate(idempotencyKey, caption) { key, captionBody -> api.createStory(key, part, captionBody) }
    }

    suspend fun uploadAvatar(file: File): PostResult<ProfileDto> = safeCall {
        val body = file.asRequestBody("image/jpeg".toMediaTypeOrNull())
        val part = MultipartBody.Part.createFormData("avatar", file.name, body)
        val response = api.uploadAvatar(part)
        val dto = response.body()?.data
        if (response.isSuccessful && dto != null) PostResult.Success(dto)
        else PostResult.Error(response.code(), mapError(response.code()))
    }

    suspend fun uploadBanner(file: File): PostResult<ProfileDto> = safeCall {
        val body = file.asRequestBody("image/jpeg".toMediaTypeOrNull())
        val part = MultipartBody.Part.createFormData("banner", file.name, body)
        val response = api.uploadBanner(part)
        val dto = response.body()?.data
        if (response.isSuccessful && dto != null) PostResult.Success(dto)
        else PostResult.Error(response.code(), mapError(response.code()))
    }

    // --- Helpers ---

    private suspend fun <T> safePaged(
        call: suspend () -> Response<ApiEnvelope<List<T>>>
    ): PostResult<PagedResult<T>> = safeCall {
        val response = call()
        if (!response.isSuccessful) {
            return@safeCall PostResult.Error(response.code(), mapError(response.code()))
        }
        val body = response.body()
        val items = body?.data.orEmpty()
        PostResult.Success(
            PagedResult(
                items = items,
                page = body?.meta?.page ?: 1,
                totalPages = body?.meta?.totalPages ?: 1
            )
        )
    }

    private suspend fun safeUnit(call: suspend () -> Response<Unit>): PostResult<Unit> = safeCall {
        val response = call()
        if (response.isSuccessful) PostResult.Success(Unit)
        else PostResult.Error(response.code(), mapError(response.code()))
    }

    private suspend fun runCreate(
        idempotencyKey: String,
        caption: String?,
        call: suspend (String, okhttp3.RequestBody?) -> Response<JsonObject>
    ): PostResult<Unit> = safeCall {
        val captionBody = caption?.takeIf { it.isNotBlank() }
            ?.toRequestBody("text/plain".toMediaTypeOrNull())
        val response = call(idempotencyKey, captionBody)
        if (response.isSuccessful) PostResult.Success(Unit)
        else PostResult.Error(response.code(), mapError(response.code()))
    }

    // Converts every failure into a visible Error (surfaced to the UI), never an
    // empty catch. IOException is treated as a retriable network error.
    private suspend fun <T> safeCall(block: suspend () -> PostResult<T>): PostResult<T> =
        try {
            block()
        } catch (_: IOException) {
            PostResult.Error(message = "Tarmoq xatosi. Qayta urinib ko'ring.")
        } catch (e: Exception) {
            PostResult.Error(message = "Kutilmagan xatolik: ${e.message ?: "noma'lum"}")
        }

    private fun mapError(code: Int): String = when (code) {
        401 -> "Sessiya tugadi. Qayta kiring."
        403 -> "Ruxsat yo'q."
        404 -> "Topilmadi."
        413 -> "Fayl juda katta."
        429 -> "Juda ko'p so'rov. Biroz kuting."
        in 500..599 -> "Server xatosi. Keyinroq urinib ko'ring."
        else -> "Xatolik ($code)."
    }
}
