package com.example.myapplication.data.remote

import retrofit2.Response
import retrofit2.http.*

interface AuthApi {
    @POST("api/auth/send-otp")
    suspend fun sendOtp(@Body request: OtpRequest): Response<OtpResponse>

    @POST("api/auth/verify-otp")
    suspend fun verifyOtp(@Body request: VerifyOtpRequest): Response<MessageResponse>

    @POST("api/auth/register")
    suspend fun register(@Body request: FullRegisterRequest): Response<AuthResponse>

    @POST("api/auth/login")
    suspend fun login(@Body request: LoginRequest): Response<AuthResponse>

    @POST("api/auth/google")
    suspend fun googleLogin(@Body request: GoogleLoginRequest): Response<AuthResponse>
}

data class GoogleLoginRequest(val idToken: String)

data class OtpRequest(val identity: String)
data class OtpResponse(val message: String, val debugOtp: String?)

data class VerifyOtpRequest(val identity: String, val otp: String)
data class MessageResponse(val message: String, val error: String?)

data class LoginRequest(val username: String, val password: String)

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
    val password: String,
    val fullName: String,
    val username: String,
    val region: String,
    val district: String,
    val school: String,
    val grade: String,
    val group: String
)
