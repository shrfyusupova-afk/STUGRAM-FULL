package com.example.myapplication.data.remote.chat

import com.example.myapplication.data.remote.RetrofitClient
import com.example.myapplication.data.remote.post.PostApi
import retrofit2.Response
import java.io.IOException
import java.time.Instant
import java.net.SocketTimeoutException

sealed class ChatResult<out T> {
    data class Success<T>(val value: T) : ChatResult<T>()
    data class Error(
        val code: Int? = null,
        val message: String,
        val retryAfterSeconds: Long? = null
    ) : ChatResult<Nothing>()
}

data class UiChatMessage(
    val id: String,
    val text: String,
    val senderName: String?,
    val timestamp: Long,
    val status: UiMessageStatus,
    val clientId: String? = null,
    val serverSequence: Long = 0L,
    val isDeleted: Boolean = false
)

enum class UiMessageStatus {
    SENT,
    READ,
    FAILED,
    SENDING
}

class ChatRepository(
    private val api: ChatApi = RetrofitClient.createService(ChatApi::class.java),
    private val postApi: PostApi = RetrofitClient.createService(PostApi::class.java)
) {
    suspend fun findOrCreateConversationWithUserName(userName: String): ChatResult<ConversationDto> {
        val conversationsResponse = api.getConversations()
        val conversations = unwrap(conversationsResponse) ?: return mapError(conversationsResponse)

        val target = conversations.firstOrNull {
            val other = it.otherParticipant
            listOfNotNull(other?.fullName, other?.username).any { value ->
                value.equals(userName, ignoreCase = true)
            }
        }
        if (target != null) return ChatResult.Success(target)

        // No existing conversation with this person yet -- look their username up
        // directly instead of re-searching the same (empty) match, which could
        // never succeed and made starting a first-time chat impossible.
        val profileResponse = postApi.getProfileByUsername(userName)
        if (!profileResponse.isSuccessful) {
            return ChatResult.Error(
                code = profileResponse.code(),
                message = "User not found."
            )
        }
        val participantId = profileResponse.body()?.data?.id
        if (participantId.isNullOrBlank()) {
            return ChatResult.Error(
                code = 404,
                message = "User not found."
            )
        }

        val createResponse = api.createConversation(CreateConversationRequest(participantId))
        val conversation = unwrap(createResponse) ?: return mapError(createResponse)
        return ChatResult.Success(conversation)
    }

    suspend fun getMessages(conversationId: String): ChatResult<List<UiChatMessage>> {
        val response = api.getMessages(conversationId = conversationId)
        val messages = unwrap(response) ?: return mapError(response)
        return ChatResult.Success(messages.map { it.toUiMessage() })
    }

    suspend fun sendTextMessage(conversationId: String, text: String, clientId: String): ChatResult<UiChatMessage> {
        return try {
            val response = api.sendMessage(
                conversationId = conversationId,
                body = SendMessageRequest(text = text, clientId = clientId)
            )
            val message = unwrap(response) ?: return mapError(response)
            ChatResult.Success(message.toUiMessage())
        } catch (ex: SocketTimeoutException) {
            ChatResult.Error(code = null, message = "Network timeout. Will retry.")
        } catch (ex: IOException) {
            ChatResult.Error(code = null, message = "Network error. Will retry.")
        }
    }

    suspend fun markSeen(messageId: String): ChatResult<Unit> {
        if (messageId.isBlank()) return ChatResult.Error(code = 400, message = "Invalid message id")
        val response = api.markSeen(messageId)
        return if (response.isSuccessful) {
            ChatResult.Success(Unit)
        } else {
            mapError(response)
        }
    }

    suspend fun getConversationEvents(conversationId: String, after: Long, limit: Int = 200): ChatResult<ChatEventsDataDto> {
        val response = api.getConversationEvents(conversationId = conversationId, after = after, limit = limit)
        val data = unwrap(response) ?: return mapError(response)
        return ChatResult.Success(data)
    }

    suspend fun getGroupEvents(groupId: String, after: Long, limit: Int = 200): ChatResult<ChatEventsDataDto> {
        val response = api.getGroupEvents(groupId = groupId, after = after, limit = limit)
        val data = unwrap(response) ?: return mapError(response)
        return ChatResult.Success(data)
    }

    private fun <T> unwrap(response: Response<ApiEnvelope<T>>): T? {
        if (!response.isSuccessful) return null
        return response.body()?.data
    }

    private fun <T> mapError(response: Response<ApiEnvelope<T>>): ChatResult.Error {
        val retryAfter = response.headers()["Retry-After"]?.toLongOrNull()
        val errorMessage = when (response.code()) {
            401 -> "Session expired. Please login again."
            403 -> "You do not have permission for this chat."
            429 -> "Too many requests. Please wait and try again."
            in 500..599 -> "Server error. Try again later."
            else -> response.body()?.message ?: "Request failed (${response.code()})."
        }
        return ChatResult.Error(code = response.code(), message = errorMessage, retryAfterSeconds = retryAfter)
    }
}

private fun MessageDto.toUiMessage(): UiChatMessage {
    val time = createdAt?.let { value ->
        runCatching { Instant.parse(value).toEpochMilli() }.getOrNull()
    } ?: System.currentTimeMillis()
    return UiChatMessage(
        id = _id,
        text = if (isDeletedForEveryone == true) "This message was deleted" else text.orEmpty(),
        senderName = sender?.fullName ?: sender?.username,
        timestamp = time,
        status = if (readAt.isNullOrBlank()) UiMessageStatus.SENT else UiMessageStatus.READ,
        clientId = clientId,
        serverSequence = serverSequence ?: 0L,
        isDeleted = isDeletedForEveryone == true
    )
}
