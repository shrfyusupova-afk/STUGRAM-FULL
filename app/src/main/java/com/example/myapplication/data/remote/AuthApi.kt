package com.example.myapplication.data.remote

import retrofit2.Response
import retrofit2.http.*
import com.google.gson.JsonObject

interface AuthApi {
    @POST("api/v1/auth/refresh")
    suspend fun refreshToken(@Body request: RefreshTokenRequest): Response<JsonObject>

    @POST("api/v1/auth/send-otp")
    suspend fun sendOtp(@Body request: OtpRequest): Response<JsonObject>

    @POST("api/v1/auth/verify-otp")
    suspend fun verifyOtp(@Body request: VerifyOtpRequest): Response<JsonObject>

    @POST("api/v1/auth/register")
    suspend fun register(@Body request: FullRegisterRequest): Response<JsonObject>

    @POST("api/v1/auth/login")
    suspend fun login(@Body request: LoginRequest): Response<JsonObject>

    @POST("api/v1/auth/google")
    suspend fun googleLogin(@Body request: GoogleLoginRequest): Response<JsonObject>

    @GET("api/v1/posts/feed/me")
    suspend fun getPostFeed(
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 10
    ): Response<JsonObject>

    @GET("api/v1/stories/feed/me")
    suspend fun getStoryFeed(
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 20
    ): Response<JsonObject>

    @GET("api/v1/profiles/me")
    suspend fun getMyProfile(): Response<JsonObject>

    @PATCH("api/v1/profiles/me")
    suspend fun updateMyProfile(@Body request: UpdateProfileRequest): Response<JsonObject>

    @GET("api/v1/profiles/{username}")
    suspend fun getProfileByUsername(@Path("username") username: String): Response<JsonObject>

    @GET("api/v1/search/users")
    suspend fun searchUsers(
        @Query("q") query: String,
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 20
    ): Response<JsonObject>

    @POST("api/v1/follows/{userId}")
    suspend fun followUser(@Path("userId") userId: String): Response<JsonObject>

    @DELETE("api/v1/follows/{userId}")
    suspend fun unfollowUser(@Path("userId") userId: String): Response<JsonObject>

    @POST("api/v1/posts")
    suspend fun createPost(@Body request: CreatePostRequest): Response<JsonObject>

    @GET("api/v1/posts/user/{username}")
    suspend fun getUserPosts(
        @Path("username") username: String,
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 20
    ): Response<JsonObject>
}

data class RefreshTokenRequest(val refreshToken: String)

data class GoogleLoginRequest(val idToken: String)

data class OtpRequest(val identity: String, val purpose: String = "register")

data class VerifyOtpRequest(val identity: String, val otp: String, val purpose: String = "register")

data class LoginRequest(val identityOrUsername: String, val password: String)

data class AuthResponse(
    val token: String,
    val user: UserDto
)

data class UserDto(
    val fullName: String,
    val username: String,
    val identity: String
)

data class FullRegisterRequest(
    val identity: String,
    val otp: String,
    val password: String,
    val fullName: String,
    val username: String,
    val region: String,
    val district: String,
    val school: String,
    val grade: String,
    val group: String,
    val type: String = "student"
)

data class UpdateProfileRequest(
    val fullName: String? = null,
    val username: String? = null,
    val bio: String? = null,
    val location: String? = null,
    val school: String? = null
)

data class CreatePostRequest(
    val caption: String
)
