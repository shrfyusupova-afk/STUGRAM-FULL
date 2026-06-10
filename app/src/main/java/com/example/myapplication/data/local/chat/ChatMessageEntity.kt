package com.example.myapplication.data.local.chat

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "chat_messages",
    indices = [
        Index(value = ["conversationId", "createdAt"]),
        Index(value = ["conversationId", "clientId"]),
        Index(value = ["conversationId", "backendId"])
    ]
)
data class ChatMessageEntity(
    @PrimaryKey
    val stableId: String,
    val conversationId: String,
    val backendId: String? = null,
    val clientId: String? = null,
    val senderId: String,
    val text: String,
    val status: String,
    val isDeleted: Boolean = false,
    val serverSequence: Long = 0L,
    val createdAt: Long,
    val updatedAt: Long,
    val rawJson: String? = null,
    val reactionsJson: String? = null,
    val replyToId: String? = null,
    val replyToText: String? = null,
    val replyToSenderName: String? = null,
    val replyToMine: Boolean = false
)
