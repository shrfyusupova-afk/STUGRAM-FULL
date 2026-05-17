package com.example.myapplication.data.local.chat

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

@Dao
interface ChatEventCursorDao {
    @Query("SELECT * FROM chat_event_cursor WHERE conversationId = :conversationId LIMIT 1")
    suspend fun getCursor(conversationId: String): ChatEventCursorEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertCursor(entity: ChatEventCursorEntity)

    @Query("SELECT * FROM chat_event_cursor WHERE conversationId = :conversationId LIMIT 1")
    fun observeCursor(conversationId: String): Flow<ChatEventCursorEntity?>
}
