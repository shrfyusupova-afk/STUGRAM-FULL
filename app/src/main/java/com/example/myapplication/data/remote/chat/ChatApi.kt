package com.example.myapplication.data.remote.chat

import com.google.gson.JsonObject
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.HTTP
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

    @GET("api/v1/chats/conversations/{conversationId}")
    suspend fun getConversationById(
        @Path("conversationId") conversationId: String
    ): Response<ConversationResponse>

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

    @HTTP(method = "DELETE", path = "api/v1/chats/messages/{messageId}", hasBody = true)
    suspend fun deleteMessage(
        @Path("messageId") messageId: String,
        @Body body: DeleteMessageRequest
    ): Response<ApiEnvelope<JsonObject>>

    @PATCH("api/v1/chats/messages/{messageId}/reaction")
    suspend fun setReaction(
        @Path("messageId") messageId: String,
        @Body body: ReactionRequest
    ): Response<MessageResponse>

    @DELETE("api/v1/chats/messages/{messageId}/reaction")
    suspend fun removeReaction(
        @Path("messageId") messageId: String
    ): Response<MessageResponse>

    @POST("api/v1/chats/conversations/{conversationId}/pin/{messageId}")
    suspend fun pinMessage(
        @Path("conversationId") conversationId: String,
        @Path("messageId") messageId: String
    ): Response<ConversationResponse>

    @DELETE("api/v1/chats/conversations/{conversationId}/pin")
    suspend fun unpinMessage(
        @Path("conversationId") conversationId: String
    ): Response<ConversationResponse>

    @GET("api/v1/chats/conversations/{conversationId}/events")
    suspend fun getConversationEvents(
        @Path("conversationId") conversationId: String,
        @Query("after") after: Long = 0,
        @Query("limit") limit: Int = 200
    ): Response<ChatEventsResponse>

    @GET("api/v1/groups/{groupId}/events")
    suspend fun getGroupEvents(
        @Path("groupId") groupId: String,
        @Query("after") after: Long = 0,
        @Query("limit") limit: Int = 200
    ): Response<ChatEventsResponse>
}
