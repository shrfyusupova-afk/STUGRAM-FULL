package com.example.myapplication.data.remote.chat

data class ApiEnvelope<T>(
    val success: Boolean? = null,
    val message: String? = null,
    val data: T? = null,
    val meta: ApiMeta? = null
)

data class ApiMeta(
    val page: Int? = null,
    val limit: Int? = null,
    val total: Int? = null,
    val totalPages: Int? = null
)

data class ConversationDto(
    val _id: String,
    val participants: List<ChatUserDto> = emptyList(),
    val otherParticipant: ChatUserDto? = null,
    val lastMessage: String? = null,
    val lastMessageAt: String? = null
)

data class ChatUserDto(
    val _id: String,
    val username: String? = null,
    val fullName: String? = null
)

data class MessageDto(
    val _id: String,
    val conversation: String,
    val sender: ChatUserDto? = null,
    val text: String? = null,
    val createdAt: String? = null,
    val readAt: String? = null,
    val clientId: String? = null,
    val serverSequence: Long? = null,
    val isDeletedForEveryone: Boolean? = null
)

data class ChatEventDto(
    val eventId: String? = null,
    val eventType: String? = null,
    val serverSequence: Long? = null,
    val messageId: String? = null,
    val conversationId: String? = null,
    val groupId: String? = null,
    val createdAt: String? = null,
    val payload: Map<String, Any?>? = null
)

data class ChatEventsDataDto(
    val targetId: String? = null,
    val targetType: String? = null,
    val fromSequence: Long? = null,
    val toSequence: Long? = null,
    val events: List<ChatEventDto> = emptyList(),
    val hasMore: Boolean = false
)

data class CreateConversationRequest(
    val participantId: String
)

data class SendMessageRequest(
    val text: String,
    val messageType: String = "text",
    val clientId: String
)

typealias SendMessageResponse = ApiEnvelope<MessageDto>
typealias PaginatedMessagesResponse = ApiEnvelope<List<MessageDto>>
typealias ChatEventsResponse = ApiEnvelope<ChatEventsDataDto>
