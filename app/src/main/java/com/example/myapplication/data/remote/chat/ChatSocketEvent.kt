package com.example.myapplication.data.remote.chat

sealed class ChatSocketEvent {
    data class NewMessage(
        val conversationId: String,
        val backendId: String,
        val clientId: String?,
        val senderId: String,
        val senderName: String?,
        val text: String,
        val createdAtMillis: Long,
        val read: Boolean,
        val serverSequence: Long = 0L,
        val replyTo: UiReplyPreview? = null,
        val messageType: String = "text",
        val media: UiMedia? = null,
        val editedAt: Long? = null,
        val forwardedFromSenderId: String? = null
    ) : ChatSocketEvent()

    data class MessageEdited(
        val conversationId: String?,
        val messageId: String,
        val text: String,
        val editedAt: Long
    ) : ChatSocketEvent()

    data class MessageSeen(
        val messageId: String,
        val conversationId: String?
    ) : ChatSocketEvent()

    data class Typing(
        val conversationId: String,
        val userId: String?,
        val isTyping: Boolean
    ) : ChatSocketEvent()

    data class MessageDeleted(
        val conversationId: String?,
        val messageId: String
    ) : ChatSocketEvent()

    data class MessageDeletedForEveryone(
        val conversationId: String?,
        val messageId: String
    ) : ChatSocketEvent()

    data class ReactionUpdated(
        val conversationId: String?,
        val messageId: String,
        val reactions: List<UiReaction>
    ) : ChatSocketEvent()

    data class ConversationPinned(
        val conversationId: String,
        val pinnedMessage: UiPinnedMessage?
    ) : ChatSocketEvent()

    data class ConversationUnpinned(
        val conversationId: String
    ) : ChatSocketEvent()

    data class Unknown(val event: String) : ChatSocketEvent()
    data object Reconnected : ChatSocketEvent()
}
