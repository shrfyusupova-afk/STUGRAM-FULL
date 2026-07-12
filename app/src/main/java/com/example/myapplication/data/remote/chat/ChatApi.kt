package com.example.myapplication.data.remote.chat

import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

interface ChatApi {
    @GET("api/v1/chats/conversations")
    suspend fun getConversations(
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 30
    ): Response<ApiEnvelope<List<ConversationDto>>>

    @POST("api/v1/chats/conversations")
    suspend fun createConversation(
        @Body body: CreateConversationRequest
    ): Response<ApiEnvelope<ConversationDto>>

    @GET("api/v1/chats/conversations/{conversationId}/messages")
    suspend fun getMessages(
        @Path("conversationId") conversationId: String,
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 50
    ): Response<PaginatedMessagesResponse>

    @POST("api/v1/chats/conversations/{conversationId}/messages")
    suspend fun sendMessage(
        @Path("conversationId") conversationId: String,
        @Body body: SendMessageRequest
    ): Response<SendMessageResponse>

    @PATCH("api/v1/chats/messages/{messageId}/seen")
    suspend fun markSeen(
        @Path("messageId") messageId: String
    ): Response<ApiEnvelope<MessageDto>>

    @GET("api/v1/chats/conversations/{conversationId}/events")
    suspend fun getConversationEvents(
        @Path("conversationId") conversationId: String,
        @Query("after") after: Long = 0,
        @Query("limit") limit: Int = 200
    ): Response<ChatEventsResponse>

    @GET("api/v1/group-chats/{groupId}/events")
    suspend fun getGroupEvents(
        @Path("groupId") groupId: String,
        @Query("after") after: Long = 0,
        @Query("limit") limit: Int = 200
    ): Response<ChatEventsResponse>
}
