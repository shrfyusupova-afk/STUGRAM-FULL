package com.example.myapplication.data.local.chat

import android.content.Context
import androidx.room.withTransaction
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.example.myapplication.data.remote.chat.ChatFailureClassifier
import com.example.myapplication.data.remote.chat.ChatFailureType
import com.example.myapplication.data.remote.chat.ChatRepository
import com.example.myapplication.data.remote.chat.ChatResult
import kotlin.math.pow

class ChatOutboxWorker(
    appContext: Context,
    params: WorkerParameters
) : CoroutineWorker(appContext, params) {

    private val database = ChatDatabase.getInstance(appContext)
    private val pendingDao = database.chatPendingMessageDao()
    private val localStore = ChatLocalStore(database.chatMessageDao(), database.chatEventCursorDao())
    private val repository = ChatRepository()

    override suspend fun doWork(): Result {
        val now = System.currentTimeMillis()
        val due = pendingDao.getDuePending(now)
        if (due.isEmpty()) return Result.success()

        var hasFuturePending = false

        for (pending in due) {
            if (localStore.hasConfirmedMessage(pending.clientId)) {
                pendingDao.deleteByLocalId(pending.localId)
                continue
            }

            pendingDao.markSending(pending.localId)

            when (val result = repository.sendTextMessage(pending.conversationId, pending.text, pending.clientId)) {
                is ChatResult.Success -> {
                    database.withTransaction {
                        localStore.replaceOptimisticWithServer(
                            conversationId = pending.conversationId,
                            clientId = pending.clientId,
                            serverMessage = result.value,
                            senderId = "me"
                        )
                        pendingDao.deleteByLocalId(pending.localId)
                    }
                }

                is ChatResult.Error -> {
                    when (ChatFailureClassifier.classify(result)) {
                        ChatFailureType.RETRYABLE -> {
                            val nextRetryCount = pending.retryCount + 1
                            val nextAttemptAt = computeNextAttemptMillis(
                                now = System.currentTimeMillis(),
                                retryCount = nextRetryCount,
                                retryAfterSeconds = result.retryAfterSeconds
                            )
                            pendingDao.markPending(
                                localId = pending.localId,
                                retryCount = nextRetryCount,
                                nextAttemptAt = nextAttemptAt,
                                lastError = result.message
                            )
                            hasFuturePending = true
                        }

                        ChatFailureType.TERMINAL -> {
                            pendingDao.markTerminalFailed(pending.localId, result.message)
                            localStore.markFailed(pending.conversationId, pending.clientId)
                        }
                    }
                }
            }
        }

        if (hasFuturePending || pendingDao.hasPending()) {
            ChatOutboxScheduler.schedule(applicationContext)
        }

        return Result.success()
    }

    private fun computeNextAttemptMillis(now: Long, retryCount: Int, retryAfterSeconds: Long?): Long {
        val retryAfterDelayMs = retryAfterSeconds?.coerceAtLeast(1L)?.times(1000L)
        if (retryAfterDelayMs != null) return now + retryAfterDelayMs

        val baseSeconds = 5.0
        val maxDelaySeconds = 15 * 60.0
        val expSeconds = (baseSeconds * 2.0.pow((retryCount - 1).coerceAtLeast(0))).coerceAtMost(maxDelaySeconds)
        return now + (expSeconds * 1000.0).toLong()
    }
}
