package com.example.myapplication.data.remote.chat

import com.example.myapplication.data.remote.AuthApi
import com.example.myapplication.data.remote.RetrofitClient
import com.google.gson.JsonParser
import retrofit2.Response
import java.io.IOException
import java.net.SocketTimeoutException
import java.time.Instant

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
    private val authApi: AuthApi = RetrofitClient.createService(AuthApi::class.java)
) {

    suspend fun findOrCreateConversationWithUserName(userName: String): ChatResult<ConversationDto> {
        return try {
            // 1. Search existing conversations (up to 100 to avoid pagination gaps)
            val conversationsResponse = api.getConversations(page = 1, limit = 100)
            val conversations = unwrap(conversationsResponse) ?: return mapError(conversationsResponse)

            val existing = conversations.firstOrNull { conv ->
                val other = conv.otherParticipant
                listOfNotNull(other?.fullName, other?.username).any { v ->
                    v.equals(userName, ignoreCase = true)
                }
            }
            if (existing != null) return ChatResult.Success(existing)

            // 2. Look up user by username to get their _id
            val participantId = resolveParticipantId(userName)
                ?: return ChatResult.Error(
                    code = 404,
                    message = "\"$userName\" topilmadi. Username to'g'ri ekanini tekshiring."
                )

            // 3. Create new conversation
            val createResponse = api.createConversation(CreateConversationRequest(participantId))
            val conversation = unwrap(createResponse) ?: return mapError(createResponse)
            ChatResult.Success(conversation)

        } catch (ex: SocketTimeoutException) {
            ChatResult.Error(code = null, message = "Server javob bermadi. Qayta urinilmoqda...")
        } catch (ex: IOException) {
            ChatResult.Error(code = null, message = "Tarmoq xatosi. Qayta urinilmoqda...")
        }
    }

    /**
     * Resolves a username/fullName to a backend user _id.
     * Tries profile lookup first, then falls back to search.
     */
    private suspend fun resolveParticipantId(userName: String): String? {
        return try {
            // Try exact profile lookup by username
            val profileResponse = authApi.getProfileByUsername(userName)
            if (profileResponse.isSuccessful) {
                val id = profileResponse.body()
                    ?.getAsJsonObject("data")
                    ?.get("_id")?.asString
                    ?.takeIf { it.isNotBlank() }
                if (id != null) return id
            }

            // Fall back to search
            val searchResponse = authApi.searchUsers(query = userName, limit = 10)
            if (!searchResponse.isSuccessful) return null
            val arr = searchResponse.body()?.getAsJsonArray("data") ?: return null
            arr.firstOrNull { el ->
                val obj = el.asJsonObject
                listOfNotNull(
                    obj.get("fullName")?.asString,
                    obj.get("username")?.asString
                ).any { it.equals(userName, ignoreCase = true) }
            }?.asJsonObject?.get("_id")?.asString?.takeIf { it.isNotBlank() }
        } catch (_: Exception) {
            null
        }
    }

    suspend fun getMessages(conversationId: String): ChatResult<List<UiChatMessage>> {
        return try {
            val response = api.getMessages(conversationId = conversationId)
            val messages = unwrap(response) ?: return mapError(response)
            ChatResult.Success(messages.map { it.toUiMessage() })
        } catch (ex: SocketTimeoutException) {
            ChatResult.Error(code = null, message = "Xabarlarni yuklashda timeout.")
        } catch (ex: IOException) {
            ChatResult.Error(code = null, message = "Tarmoq xatosi.")
        }
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
        return try {
            val response = api.markSeen(messageId)
            if (response.isSuccessful) ChatResult.Success(Unit) else mapError(response)
        } catch (_: IOException) {
            ChatResult.Error(code = null, message = "Network error.")
        }
    }

    suspend fun getConversationEvents(conversationId: String, after: Long, limit: Int = 200): ChatResult<ChatEventsDataDto> {
        return try {
            val response = api.getConversationEvents(conversationId = conversationId, after = after, limit = limit)
            val data = unwrap(response) ?: return mapError(response)
            ChatResult.Success(data)
        } catch (ex: SocketTimeoutException) {
            ChatResult.Error(code = null, message = "Event sync timeout.")
        } catch (ex: IOException) {
            ChatResult.Error(code = null, message = "Event sync error.")
        }
    }

    suspend fun getGroupEvents(groupId: String, after: Long, limit: Int = 200): ChatResult<ChatEventsDataDto> {
        return try {
            val response = api.getGroupEvents(groupId = groupId, after = after, limit = limit)
            val data = unwrap(response) ?: return mapError(response)
            ChatResult.Success(data)
        } catch (ex: SocketTimeoutException) {
            ChatResult.Error(code = null, message = "Group event sync timeout.")
        } catch (ex: IOException) {
            ChatResult.Error(code = null, message = "Group event sync error.")
        }
    }

    private fun <T> unwrap(response: Response<ApiEnvelope<T>>): T? {
        if (!response.isSuccessful) return null
        return response.body()?.data
    }

    private fun <T> mapError(response: Response<ApiEnvelope<T>>): ChatResult.Error {
        val retryAfter = response.headers()["Retry-After"]?.toLongOrNull()

        // For error responses, Retrofit puts the body in errorBody(), not body()
        val serverMessage: String? = if (response.isSuccessful) {
            response.body()?.message
        } else {
            try {
                response.errorBody()?.string()?.let { raw ->
                    JsonParser.parseString(raw)
                        ?.asJsonObject
                        ?.get("message")
                        ?.asString
                }
            } catch (_: Exception) {
                null
            }
        }

        val errorMessage = when (response.code()) {
            401 -> "Sessiya tugagan. Qayta kiring."
            403 -> "Sizda bu chat uchun ruxsat yo'q."
            404 -> serverMessage ?: "Topilmadi (404)."
            429 -> "Juda ko'p so'rov. Biroz kutib turing."
            in 500..599 -> "Server xatosi. Keyinroq urinib ko'ring."
            else -> serverMessage ?: "So'rov xatosi (${response.code()})."
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
        text = if (isDeletedForEveryone == true) "Bu xabar o'chirilgan" else text.orEmpty(),
        senderName = sender?.fullName ?: sender?.username,
        timestamp = time,
        status = if (readAt.isNullOrBlank()) UiMessageStatus.SENT else UiMessageStatus.READ,
        clientId = clientId,
        serverSequence = serverSequence ?: 0L,
        isDeleted = isDeletedForEveryone == true
    )
}
