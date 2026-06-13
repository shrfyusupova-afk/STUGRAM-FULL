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
    val lastMessageAt: String? = null,
    val pinnedMessage: MessageDto? = null,
    val pinnedAt: String? = null
)

data class ChatUserDto(
    val _id: String,
    val username: String? = null,
    val fullName: String? = null
)

data class ReactionDto(
    val user: ChatUserDto? = null,
    val emoji: String? = null
)

data class MediaDto(
    val url: String? = null,
    val publicId: String? = null,
    val type: String? = null,
    val fileName: String? = null,
    val fileSize: Long? = null,
    val mimeType: String? = null,
    val durationSeconds: Int? = null
)

data class ReplyPreviewDto(
    val _id: String? = null,
    val text: String? = null,
    val messageType: String? = null,
    val media: MediaDto? = null,
    val sender: ChatUserDto? = null,
    val createdAt: String? = null
)

data class MessageDto(
    val _id: String,
    val conversation: String,
    val sender: ChatUserDto? = null,
    val text: String? = null,
    val messageType: String? = null,
    val media: MediaDto? = null,
    val createdAt: String? = null,
    val readAt: String? = null,
    val clientId: String? = null,
    val serverSequence: Long? = null,
    val isDeletedForEveryone: Boolean? = null,
    val replyToMessage: ReplyPreviewDto? = null,
    val reactions: List<ReactionDto> = emptyList(),
    val editedAt: String? = null,
    val forwardedFromMessageId: String? = null,
    val forwardedFromSenderId: String? = null,
    val forwardedFromConversationId: String? = null,
    val forwardedAt: String? = null
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
    val clientId: String,
    val replyToMessageId: String? = null
)

data class ReactionRequest(
    val emoji: String
)

data class DeleteMessageRequest(
    val scope: String = "self"
)

data class EditMessageRequest(
    val text: String
)

data class ForwardMessageRequest(
    val sourceMessageId: String,
    val comment: String? = null
)

typealias SendMessageResponse = ApiEnvelope<MessageDto>
typealias PaginatedMessagesResponse = ApiEnvelope<List<MessageDto>>
typealias SearchMessagesResponse = ApiEnvelope<List<MessageDto>>
typealias ChatEventsResponse = ApiEnvelope<ChatEventsDataDto>
typealias ConversationResponse = ApiEnvelope<ConversationDto>
typealias MessageResponse = ApiEnvelope<MessageDto>
