package com.example.myapplication.data.local.chat

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "chat_event_cursor")
data class ChatEventCursorEntity(
    @PrimaryKey
    val conversationId: String,
    val latestSequence: Long,
    val updatedAt: Long
)
