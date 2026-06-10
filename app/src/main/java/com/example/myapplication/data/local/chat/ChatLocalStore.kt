package com.example.myapplication.data.local.chat

import android.util.Log
import com.example.myapplication.data.remote.chat.ChatEventDto
import com.example.myapplication.data.remote.chat.ChatEventsDataDto
import com.example.myapplication.data.remote.chat.UiChatMessage
import com.example.myapplication.data.remote.chat.UiMessageStatus
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import java.time.Instant

class ChatLocalStore(
    private val dao: ChatMessageDao,
    private val cursorDao: ChatEventCursorDao? = null
) {
    fun observeMessages(conversationId: String): Flow<List<UiChatMessage>> {
        return dao.observeMessages(conversationId).map { rows -> rows.map { it.toUi() } }
    }

    suspend fun saveBackendMessages(conversationId: String, messages: List<UiChatMessage>) {
        if (messages.isEmpty()) return
        val merged = mutableListOf<ChatMessageEntity>()
        for (message in messages) {
            val incoming = message.toEntity(conversationId)
            val existingByClientId = incoming.clientId?.let { dao.findByClientId(conversationId, it) }
            val existingByBackendId = incoming.backendId?.let { dao.findByBackendId(conversationId, it) }
            val existing = existingByClientId ?: existingByBackendId
            if (existing != null && existing.serverSequence > incoming.serverSequence) {
                continue
            }
            if (existing?.isDeleted == true && existing.serverSequence >= incoming.serverSequence) {
                continue
            }
            merged.add(
                incoming.copy(
                    stableId = existing?.stableId ?: incoming.stableId,
                    senderId = if (existing?.senderId == "me") "me" else incoming.senderId,
                    isDeleted = existing?.isDeleted == true && incoming.serverSequence <= existing.serverSequence,
                    serverSequence = maxOf(existing?.serverSequence ?: 0L, incoming.serverSequence)
                )
            )
        }
        if (merged.isNotEmpty()) dao.upsertMessages(merged)
    }

    suspend fun saveOptimisticMessage(
        conversationId: String,
        clientId: String,
        senderId: String,
        text: String,
        nowMillis: Long
    ): UiChatMessage {
        val stableId = "client:$clientId"
        val entity = ChatMessageEntity(
            stableId = stableId,
            conversationId = conversationId,
            backendId = null,
            clientId = clientId,
            senderId = senderId,
            text = text,
            status = UiMessageStatus.SENDING.name,
            isDeleted = false,
            serverSequence = 0L,
            createdAt = nowMillis,
            updatedAt = nowMillis,
            rawJson = null
        )
        dao.upsertMessage(entity)
        return entity.toUi()
    }

    suspend fun replaceOptimisticWithServer(
        conversationId: String,
        clientId: String,
        serverMessage: UiChatMessage,
        senderId: String = "me"
    ) {
        val existing = dao.findByClientId(conversationId, clientId)
        val stableId = existing?.stableId ?: buildStableId(serverMessage, clientId)
        dao.upsertMessage(
            ChatMessageEntity(
                stableId = stableId,
                conversationId = conversationId,
                backendId = serverMessage.id,
                clientId = clientId,
                senderId = senderId,
                text = serverMessage.text,
                status = serverMessage.status.name,
                isDeleted = serverMessage.isDeleted,
                serverSequence = maxOf(existing?.serverSequence ?: 0L, serverMessage.serverSequence),
                createdAt = serverMessage.timestamp,
                updatedAt = System.currentTimeMillis(),
                rawJson = null
            )
        )
    }

    suspend fun markFailed(conversationId: String, clientId: String) {
        val existing = dao.findByClientId(conversationId, clientId) ?: return
        dao.upsertMessage(existing.copy(status = UiMessageStatus.FAILED.name, updatedAt = System.currentTimeMillis()))
    }

    suspend fun hasConfirmedMessage(clientId: String): Boolean {
        return dao.findConfirmedByClientId(clientId) != null
    }

    suspend fun upsertIncomingSocketMessage(
        conversationId: String,
        backendId: String,
        clientId: String?,
        senderId: String,
        senderName: String?,
        text: String,
        createdAtMillis: Long,
        read: Boolean,
        serverSequence: Long = 0L
    ) {
        val existingByClientId = clientId?.let { dao.findByClientId(conversationId, it) }
        val existingByBackendId = dao.findByBackendId(conversationId, backendId)
        val base = existingByClientId ?: existingByBackendId
        // Tombstone protection: a new_message socket event must never resurrect a deleted
        // message, regardless of the incoming serverSequence (including seq=0 from old/malformed
        // server payloads, or a sequence that looks "newer"). Once deleted locally, it stays deleted.
        if (base?.isDeleted == true) return
        // Stale update protection: skip if existing record has a strictly higher known sequence.
        if (base != null && base.serverSequence > serverSequence && serverSequence > 0L) return
        val stableId = when {
            !clientId.isNullOrBlank() -> "client:$clientId"
            else -> "backend:$backendId"
        }
        dao.upsertMessage(
            ChatMessageEntity(
                stableId = base?.stableId ?: stableId,
                conversationId = conversationId,
                backendId = backendId,
                clientId = clientId ?: base?.clientId,
                senderId = if (base?.senderId == "me") "me" else (senderName ?: senderId),
                text = text,
                status = if (read) UiMessageStatus.READ.name else UiMessageStatus.SENT.name,
                isDeleted = false,
                serverSequence = maxOf(base?.serverSequence ?: 0L, serverSequence),
                createdAt = createdAtMillis,
                updatedAt = System.currentTimeMillis(),
                rawJson = null
            )
        )
    }

    suspend fun markMessageReadByBackendId(backendId: String) {
        dao.updateStatusByBackendId(backendId, UiMessageStatus.READ.name, System.currentTimeMillis())
    }

    suspend fun getCandidateMessageIdsForSeen(conversationId: String, limit: Int = 10): List<String> {
        return dao.getBackendIdsByStatus(
            conversationId = conversationId,
            status = UiMessageStatus.SENT.name,
            limit = limit
        )
    }

    suspend fun getLatestCursor(conversationId: String): Long {
        return cursorDao?.getCursor(conversationId)?.latestSequence ?: 0L
    }

    suspend fun syncCursorForward(conversationId: String, latestSequence: Long) {
        if (latestSequence <= 0L) return
        val current = getLatestCursor(conversationId)
        val next = nextCursorValue(current, latestSequence)
        if (next <= current) return
        cursorDao?.upsertCursor(
            ChatEventCursorEntity(
                conversationId = conversationId,
                latestSequence = next,
                updatedAt = System.currentTimeMillis()
            )
        )
    }

    suspend fun applyConversationEvents(conversationId: String, response: ChatEventsDataDto): Long {
        val sorted = response.events.sortedBy { it.serverSequence ?: 0L }
        var maxSequence = getLatestCursor(conversationId)
        for (event in sorted) {
            val seq = event.serverSequence ?: continue
            if (seq <= maxSequence) continue
            val recognized = applySingleConversationEvent(conversationId, event)
            if (!recognized) {
                Log.w("ChatLocalStore", "Skipping unknown event ${event.eventType} seq=$seq")
            }
            maxSequence = seq
            syncCursorForward(conversationId, maxSequence)
        }
        return maxSequence
    }

    private suspend fun applySingleConversationEvent(conversationId: String, event: ChatEventDto): Boolean {
        val normalizedType = normalizeEventTypeForSync(event.eventType)
        val seq = event.serverSequence ?: 0L
        val payload = event.payload

        return when (normalizedType) {
            "message_created" -> {
                val messagePayloadAny = payload?.get("message")
                val messagePayload = (messagePayloadAny as? Map<*, *>) ?: payload.orEmpty()
                val backendId = mapString(messagePayload, "_id")
                    ?: mapString(messagePayload, "id")
                    ?: event.messageId
                    ?: return false
                val sender = messagePayload["sender"] as? Map<*, *>
                upsertIncomingSocketMessage(
                    conversationId = conversationId,
                    backendId = backendId,
                    clientId = mapString(messagePayload, "clientId"),
                    senderId = mapString(sender, "_id") ?: "unknown",
                    senderName = mapString(sender, "fullName") ?: mapString(sender, "username"),
                    text = mapString(messagePayload, "text").orEmpty(),
                    createdAtMillis = parseIsoMillis(mapString(messagePayload, "createdAt")),
                    read = mapString(messagePayload, "readAt").isNullOrBlank().not(),
                    serverSequence = seq
                )
                true
            }

            "message_edited" -> {
                val backendId = event.messageId ?: (payload?.get("messageId") as? String) ?: return false
                val existing = dao.findByBackendId(conversationId, backendId) ?: return false
                if (existing.serverSequence > seq) return true
                val nextText = (payload?.get("text") as? String)
                    ?: ((payload?.get("message") as? Map<*, *>)?.get("text") as? String)
                    ?: existing.text
                dao.upsertMessage(
                    existing.copy(
                        text = nextText,
                        serverSequence = seq,
                        updatedAt = System.currentTimeMillis()
                    )
                )
                true
            }

            "message_deleted" -> {
                val backendId = event.messageId ?: (payload?.get("messageId") as? String) ?: return false
                val existing = dao.findByBackendId(conversationId, backendId) ?: return false
                if (existing.serverSequence > seq) return true
                dao.upsertMessage(
                    existing.copy(
                        text = "This message was deleted",
                        isDeleted = true,
                        serverSequence = seq,
                        updatedAt = System.currentTimeMillis()
                    )
                )
                true
            }

            "reaction_updated", "seen_updated" -> {
                val backendId = event.messageId ?: (payload?.get("messageId") as? String) ?: return false
                val existing = dao.findByBackendId(conversationId, backendId) ?: return false
                if (existing.serverSequence > seq) return true
                val nextStatus = if (normalizedType == "seen_updated") UiMessageStatus.READ.name else existing.status
                dao.upsertMessage(
                    existing.copy(
                        status = nextStatus,
                        serverSequence = seq,
                        updatedAt = System.currentTimeMillis()
                    )
                )
                true
            }

            else -> false
        }
    }

    private fun UiChatMessage.toEntity(conversationId: String): ChatMessageEntity {
        val stableId = buildStableId(this, clientId)
        return ChatMessageEntity(
            stableId = stableId,
            conversationId = conversationId,
            backendId = id,
            clientId = clientId,
            senderId = senderName ?: "unknown",
            text = text,
            status = status.name,
            isDeleted = isDeleted,
            serverSequence = serverSequence,
            createdAt = timestamp,
            updatedAt = System.currentTimeMillis(),
            rawJson = null
        )
    }

    private fun ChatMessageEntity.toUi(): UiChatMessage {
        return UiChatMessage(
            id = backendId ?: stableId,
            text = text,
            senderName = senderId,
            timestamp = createdAt,
            status = runCatching { UiMessageStatus.valueOf(status) }.getOrDefault(UiMessageStatus.SENT),
            clientId = clientId,
            serverSequence = serverSequence,
            isDeleted = isDeleted
        )
    }

    private fun buildStableId(message: UiChatMessage, clientId: String?): String {
        return when {
            !clientId.isNullOrBlank() -> "client:$clientId"
            message.id.isNotBlank() -> "backend:${message.id}"
            else -> "time:${message.timestamp}"
        }
    }

    private fun parseIsoMillis(value: String?): Long {
        if (value.isNullOrBlank()) return System.currentTimeMillis()
        return runCatching { Instant.parse(value).toEpochMilli() }.getOrDefault(System.currentTimeMillis())
    }

    private fun mapString(map: Map<*, *>?, key: String): String? {
        return map?.get(key) as? String
    }

    companion object {
        internal fun normalizeEventTypeForSync(type: String?): String {
            val raw = type.orEmpty().trim().lowercase()
            return when (raw) {
                "message.created", "message_created" -> "message_created"
                "message.edited", "message_edited" -> "message_edited"
                "message.deleted", "message_deleted" -> "message_deleted"
                "message.reactions", "reaction_updated", "reactions_updated" -> "reaction_updated"
                "message.seen", "seen_updated" -> "seen_updated"
                else -> raw
            }
        }

        internal fun nextCursorValue(current: Long, candidate: Long): Long = maxOf(current, candidate)
    }
}
