package com.example.myapplication.data.local.chat

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

@Dao
interface ChatMessageDao {
    @Query("SELECT * FROM chat_messages WHERE conversationId = :conversationId ORDER BY createdAt DESC")
    fun observeMessages(conversationId: String): Flow<List<ChatMessageEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertMessages(messages: List<ChatMessageEntity>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertMessage(message: ChatMessageEntity)

    @Query("DELETE FROM chat_messages WHERE stableId = :stableId")
    suspend fun deleteByStableId(stableId: String)

    @Query("SELECT * FROM chat_messages WHERE conversationId = :conversationId AND clientId = :clientId LIMIT 1")
    suspend fun findByClientId(conversationId: String, clientId: String): ChatMessageEntity?

    @Query("SELECT * FROM chat_messages WHERE clientId = :clientId AND backendId IS NOT NULL LIMIT 1")
    suspend fun findConfirmedByClientId(clientId: String): ChatMessageEntity?

    @Query("SELECT * FROM chat_messages WHERE conversationId = :conversationId AND backendId = :backendId LIMIT 1")
    suspend fun findByBackendId(conversationId: String, backendId: String): ChatMessageEntity?

    @Query("UPDATE chat_messages SET status = :status, updatedAt = :updatedAt WHERE backendId = :backendId")
    suspend fun updateStatusByBackendId(
        backendId: String,
        status: String,
        updatedAt: Long = System.currentTimeMillis()
    )

    @Query("SELECT backendId FROM chat_messages WHERE conversationId = :conversationId AND status = :status AND backendId IS NOT NULL ORDER BY createdAt DESC LIMIT :limit")
    suspend fun getBackendIdsByStatus(
        conversationId: String,
        status: String,
        limit: Int
    ): List<String>

    @Query("DELETE FROM chat_messages WHERE conversationId = :conversationId")
    suspend fun clearConversation(conversationId: String)
}
