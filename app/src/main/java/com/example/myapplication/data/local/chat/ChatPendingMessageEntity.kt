package com.example.myapplication.data.local.chat

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "chat_pending_messages",
    indices = [
        Index(value = ["clientId"], unique = true),
        Index(value = ["nextAttemptAt"]),
        Index(value = ["status"])
    ]
)
data class ChatPendingMessageEntity(
    @PrimaryKey
    val localId: String,
    val conversationId: String,
    val clientId: String,
    val text: String,
    val status: String,
    val retryCount: Int,
    val nextAttemptAt: Long,
    val lastError: String? = null,
    val createdAt: Long,
    val updatedAt: Long
)

object ChatPendingStatus {
    const val PENDING = "PENDING"
    const val SENDING = "SENDING"
    const val SENT = "SENT"
    const val FAILED_TERMINAL = "FAILED_TERMINAL"
}
