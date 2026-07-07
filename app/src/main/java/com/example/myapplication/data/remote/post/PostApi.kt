package com.example.myapplication.data.remote.post

import com.google.gson.JsonObject
import okhttp3.MultipartBody
import okhttp3.RequestBody
import retrofit2.Response
import retrofit2.http.Header
import retrofit2.http.Multipart
import retrofit2.http.POST
import retrofit2.http.Part

/**
 * Media creation endpoints. Confirmed backend contract:
 *  - POST /api/v1/posts   multipart, field "media" (array, up to 10, image|video),
 *    optional "caption". A "reel" is simply a post whose media is a video.
 *  - POST /api/v1/stories multipart, single "media", optional "caption".
 * The server uploads to Cloudinary itself, so the client sends raw files, not URLs.
 * Idempotency-Key is optional server-side; we send one to de-dupe retries.
 */
interface PostApi {
    @Multipart
    @POST("api/v1/posts")
    suspend fun createPost(
        @Header("Idempotency-Key") idempotencyKey: String,
        @Part media: List<MultipartBody.Part>,
        @Part("caption") caption: RequestBody?
    ): Response<JsonObject>

    @Multipart
    @POST("api/v1/stories")
    suspend fun createStory(
        @Header("Idempotency-Key") idempotencyKey: String,
        @Part media: MultipartBody.Part,
        @Part("caption") caption: RequestBody?
    ): Response<JsonObject>
}
