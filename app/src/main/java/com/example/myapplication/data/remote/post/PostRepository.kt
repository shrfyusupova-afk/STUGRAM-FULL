package com.example.myapplication.data.remote.post

import com.example.myapplication.data.remote.RetrofitClient
import com.google.gson.JsonObject
import java.io.File
import java.io.IOException
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.toRequestBody
import retrofit2.Response

/**
 * Post/story creation, following the same result/error-mapping shape as
 * ChatRepository. Media files are streamed with a shared progress callback so
 * the UI can render a single determinate bar across all files.
 */
sealed class PostResult<out T> {
    data class Success<T>(val value: T) : PostResult<T>()
    data class Error(val code: Int? = null, val message: String) : PostResult<Nothing>()
}

class PostRepository(
    private val api: PostApi = RetrofitClient.createService(PostApi::class.java)
) {
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
        return runCreate(idempotencyKey, caption) { key, captionBody ->
            api.createPost(key, parts, captionBody)
        }
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
        return runCreate(idempotencyKey, caption) { key, captionBody ->
            api.createStory(key, part, captionBody)
        }
    }

    private suspend fun runCreate(
        idempotencyKey: String,
        caption: String?,
        call: suspend (String, okhttp3.RequestBody?) -> Response<JsonObject>
    ): PostResult<Unit> {
        return try {
            val captionBody = caption?.takeIf { it.isNotBlank() }
                ?.toRequestBody("text/plain".toMediaTypeOrNull())
            val response = call(idempotencyKey, captionBody)
            if (response.isSuccessful) {
                PostResult.Success(Unit)
            } else {
                PostResult.Error(code = response.code(), message = mapError(response.code()))
            }
        } catch (_: IOException) {
            PostResult.Error(message = "Tarmoq xatosi. Qayta urinib ko'ring.")
        }
    }

    private fun mapError(code: Int): String = when (code) {
        401 -> "Sessiya tugadi. Qayta kiring."
        403 -> "Ruxsat yo'q."
        413 -> "Fayl juda katta."
        in 500..599 -> "Server xatosi. Keyinroq urinib ko'ring."
        else -> "Yuklab bo'lmadi ($code)."
    }
}
