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
        val serverSequence: Long = 0L
    ) : ChatSocketEvent()

    data class MessageSeen(
        val messageId: String,
        val conversationId: String?
    ) : ChatSocketEvent()

    data class Typing(
        val conversationId: String,
        val userId: String?
    ) : ChatSocketEvent()

    data class Unknown(val event: String) : ChatSocketEvent()
    data object Reconnected : ChatSocketEvent()
}
