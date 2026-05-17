package com.example.myapplication.data.remote.requests

import retrofit2.Response
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path

data class RequestsEnvelope<T>(
    val success: Boolean,
    val message: String?,
    val data: T?,
    val meta: RequestsMeta?,
    val error: RequestsError?
)

data class RequestsMeta(
    val requestId: String? = null,
    val timestamp: String? = null
)

data class RequestsError(
    val code: String? = null
)

data class RequestsData(
    val requests: List<RequestDto> = emptyList()
)

data class RequestDto(
    val id: String,
    val type: String? = null,
    val fromUser: RequestFromUserDto? = null,
    val createdAt: String? = null
)

data class RequestFromUserDto(
    val id: String? = null,
    val name: String? = null,
    val username: String? = null,
    val avatarUrl: String? = null
)

data class AddToChatData(
    val requestId: String? = null,
    val conversation: RequestConversationDto? = null
)

data class RequestConversationDto(
    val _id: String? = null
)

interface RequestsApi {
    @GET("api/v1/requests")
    suspend fun getRequests(): Response<RequestsEnvelope<RequestsData>>

    @POST("api/v1/requests/{requestId}/add-to-chat")
    suspend fun addToChat(@Path("requestId") requestId: String): Response<RequestsEnvelope<AddToChatData>>

    @POST("api/v1/requests/{requestId}/block")
    suspend fun blockRequestUser(@Path("requestId") requestId: String): Response<RequestsEnvelope<Map<String, Any?>>>

    @DELETE("api/v1/requests/{requestId}")
    suspend fun deleteRequest(@Path("requestId") requestId: String): Response<RequestsEnvelope<Map<String, Any?>>>
}
