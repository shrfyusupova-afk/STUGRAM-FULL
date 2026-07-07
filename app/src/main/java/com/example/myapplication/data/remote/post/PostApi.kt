package com.example.myapplication.data.remote.post

import com.google.gson.JsonObject
import okhttp3.MultipartBody
import okhttp3.RequestBody
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.Multipart
import retrofit2.http.POST
import retrofit2.http.Part
import retrofit2.http.Path
import retrofit2.http.Query

/**
 * Post / story / like / comment endpoints. All confirmed against the backend:
 *  - Media create is MULTIPART (server uploads to Cloudinary); field "media".
 *  - Feed / user-posts / comments return { data: [...], meta: {page,limit,total,totalPages} }.
 *  - A reel is simply a post whose media is a video.
 */
interface PostApi {
    // --- Create (multipart) ---
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

    // --- Read ---
    @GET("api/v1/posts/feed/me")
    suspend fun getFeed(
        @Query("page") page: Int,
        @Query("limit") limit: Int
    ): Response<ApiEnvelope<List<PostDto>>>

    @GET("api/v1/posts/user/{username}")
    suspend fun getUserPosts(
        @Path("username") username: String,
        @Query("page") page: Int,
        @Query("limit") limit: Int
    ): Response<ApiEnvelope<List<PostDto>>>

    @GET("api/v1/stories/feed/me")
    suspend fun getStoriesFeed(
        @Query("page") page: Int,
        @Query("limit") limit: Int
    ): Response<ApiEnvelope<List<StoryDto>>>

    @GET("api/v1/explore/creators")
    suspend fun getCreatorSuggestions(
        @Query("page") page: Int,
        @Query("limit") limit: Int
    ): Response<ApiEnvelope<List<UserPreviewDto>>>

    // --- Profiles ---
    @GET("api/v1/profiles/me")
    suspend fun getMyProfile(): Response<ApiEnvelope<ProfileDto>>

    @GET("api/v1/profiles/{username}")
    suspend fun getProfileByUsername(@Path("username") username: String): Response<ApiEnvelope<ProfileDto>>

    // --- Likes ---
    @POST("api/v1/likes/posts/{postId}")
    suspend fun likePost(@Path("postId") postId: String): Response<Unit>

    @DELETE("api/v1/likes/posts/{postId}")
    suspend fun unlikePost(@Path("postId") postId: String): Response<Unit>

    // --- Comments ---
    @GET("api/v1/comments/posts/{postId}")
    suspend fun getComments(
        @Path("postId") postId: String,
        @Query("page") page: Int,
        @Query("limit") limit: Int
    ): Response<ApiEnvelope<List<CommentDto>>>

    @POST("api/v1/comments/posts/{postId}")
    suspend fun addComment(
        @Path("postId") postId: String,
        @Body body: AddCommentRequest
    ): Response<ApiEnvelope<CommentDto>>
}
