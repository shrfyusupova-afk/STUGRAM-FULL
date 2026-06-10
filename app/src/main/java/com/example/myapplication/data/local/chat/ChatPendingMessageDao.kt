package com.example.myapplication.data.local.chat

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query

@Dao
interface ChatPendingMessageDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertOrReplace(entity: ChatPendingMessageEntity)

    @Query("SELECT * FROM chat_pending_messages WHERE status = :statusPending AND nextAttemptAt <= :now ORDER BY createdAt ASC")
    suspend fun getDuePending(now: Long, statusPending: String = ChatPendingStatus.PENDING): List<ChatPendingMessageEntity>

    @Query("SELECT * FROM chat_pending_messages WHERE clientId = :clientId LIMIT 1")
    suspend fun getByClientId(clientId: String): ChatPendingMessageEntity?

    @Query("UPDATE chat_pending_messages SET status = :statusSending, updatedAt = :updatedAt WHERE localId = :localId")
    suspend fun markSending(localId: String, statusSending: String = ChatPendingStatus.SENDING, updatedAt: Long = System.currentTimeMillis())

    @Query("UPDATE chat_pending_messages SET status = :statusPending, retryCount = :retryCount, nextAttemptAt = :nextAttemptAt, lastError = :lastError, updatedAt = :updatedAt WHERE localId = :localId")
    suspend fun markPending(
        localId: String,
        retryCount: Int,
        nextAttemptAt: Long,
        lastError: String?,
        statusPending: String = ChatPendingStatus.PENDING,
        updatedAt: Long = System.currentTimeMillis()
    )

    @Query("UPDATE chat_pending_messages SET status = :statusTerminal, lastError = :lastError, updatedAt = :updatedAt WHERE localId = :localId")
    suspend fun markTerminalFailed(
        localId: String,
        lastError: String?,
        statusTerminal: String = ChatPendingStatus.FAILED_TERMINAL,
        updatedAt: Long = System.currentTimeMillis()
    )

    @Query("DELETE FROM chat_pending_messages WHERE localId = :localId")
    suspend fun deleteByLocalId(localId: String)

    @Query("DELETE FROM chat_pending_messages WHERE clientId = :clientId")
    suspend fun deleteByClientId(clientId: String)

    @Query("SELECT EXISTS(SELECT 1 FROM chat_pending_messages WHERE status IN (:pending, :sending))")
    suspend fun hasPending(
        pending: String = ChatPendingStatus.PENDING,
        sending: String = ChatPendingStatus.SENDING
    ): Boolean

    @Query("SELECT MIN(nextAttemptAt) FROM chat_pending_messages WHERE status = :statusPending")
    suspend fun getNextPendingAttemptAt(statusPending: String = ChatPendingStatus.PENDING): Long?
}
