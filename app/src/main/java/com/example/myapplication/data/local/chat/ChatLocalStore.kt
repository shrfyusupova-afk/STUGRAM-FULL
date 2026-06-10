package com.example.myapplication.data.local.chat

import android.util.Log
import com.example.myapplication.data.remote.AuthSession
import com.example.myapplication.data.remote.chat.ChatEventDto
import com.example.myapplication.data.remote.chat.ChatEventsDataDto
import com.example.myapplication.data.remote.chat.UiChatMessage
import com.example.myapplication.data.remote.chat.UiMessageStatus
import com.example.myapplication.data.remote.chat.UiReaction
import com.example.myapplication.data.remote.chat.UiReplyPreview
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import org.json.JSONArray
import org.json.JSONObject
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
        nowMillis: Long,
        replyTo: UiReplyPreview? = null
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
            rawJson = null,
            replyToId = replyTo?.id,
            replyToText = replyTo?.text,
            replyToSenderName = replyTo?.senderName,
            replyToMine = replyTo?.mine ?: false
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
        val replyTo = serverMessage.replyTo ?: existing?.let {
            it.replyToId?.let { id ->
                UiReplyPreview(id = id, text = it.replyToText.orEmpty(), senderName = it.replyToSenderName, mine = it.replyToMine)
            }
        }
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
                rawJson = null,
                reactionsJson = serializeReactions(serverMessage.reactions),
                replyToId = replyTo?.id,
                replyToText = replyTo?.text,
                replyToSenderName = replyTo?.senderName,
                replyToMine = replyTo?.mine ?: false
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
        serverSequence: Long = 0L,
        replyTo: UiReplyPreview? = null
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
        val effectiveReplyTo = replyTo ?: base?.replyToId?.let { id ->
            UiReplyPreview(id = id, text = base.replyToText.orEmpty(), senderName = base.replyToSenderName, mine = base.replyToMine)
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
                rawJson = null,
                reactionsJson = base?.reactionsJson,
                replyToId = effectiveReplyTo?.id,
                replyToText = effectiveReplyTo?.text,
                replyToSenderName = effectiveReplyTo?.senderName,
                replyToMine = effectiveReplyTo?.mine ?: false
            )
        )
    }

    suspend fun markMessageReadByBackendId(backendId: String) {
        dao.updateStatusByBackendId(backendId, UiMessageStatus.READ.name, System.currentTimeMillis())
    }

    /** Deletes a message for the local user only ("delete for me"). */
    suspend fun deleteMessageForMe(conversationId: String, messageId: String, clientId: String?) {
        val existing = dao.findByBackendId(conversationId, messageId)
            ?: clientId?.let { dao.findByClientId(conversationId, it) }
        if (existing != null) dao.deleteByStableId(existing.stableId)
    }

    /** Marks a message as deleted-for-everyone, mirroring the live socket/event behavior. */
    suspend fun markDeletedForEveryone(conversationId: String, messageId: String) {
        val existing = dao.findByBackendId(conversationId, messageId) ?: return
        dao.upsertMessage(
            existing.copy(
                text = "Bu xabar o'chirilgan",
                isDeleted = true,
                updatedAt = System.currentTimeMillis()
            )
        )
    }

    /** Applies an updated reaction list (from API response or live socket event) to a cached message. */
    suspend fun updateReactions(conversationId: String, messageId: String, reactions: List<UiReaction>) {
        val existing = dao.findByBackendId(conversationId, messageId) ?: return
        dao.upsertMessage(
            existing.copy(
                reactionsJson = serializeReactions(reactions),
                updatedAt = System.currentTimeMillis()
            )
        )
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
                val replyToMessage = messagePayload["replyToMessage"] as? Map<*, *>
                val replyTo = replyToMessage?.let { reply ->
                    val replySender = reply["sender"] as? Map<*, *>
                    val myId = AuthSession.currentUserId
                    UiReplyPreview(
                        id = mapString(reply, "_id").orEmpty(),
                        text = mapString(reply, "text")?.takeIf { it.isNotBlank() } ?: "Xabar",
                        senderName = mapString(replySender, "fullName") ?: mapString(replySender, "username"),
                        mine = myId != null && mapString(replySender, "_id") == myId
                    )
                }
                upsertIncomingSocketMessage(
                    conversationId = conversationId,
                    backendId = backendId,
                    clientId = mapString(messagePayload, "clientId"),
                    senderId = mapString(sender, "_id") ?: "unknown",
                    senderName = mapString(sender, "fullName") ?: mapString(sender, "username"),
                    text = mapString(messagePayload, "text").orEmpty(),
                    createdAtMillis = parseIsoMillis(mapString(messagePayload, "createdAt")),
                    read = mapString(messagePayload, "readAt").isNullOrBlank().not(),
                    serverSequence = seq,
                    replyTo = replyTo
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

            "reaction_updated" -> {
                val backendId = event.messageId ?: (payload?.get("messageId") as? String) ?: return false
                val existing = dao.findByBackendId(conversationId, backendId) ?: return false
                if (existing.serverSequence > seq) return true
                val rawReactions = payload?.get("reactions")
                    ?: (payload?.get("message") as? Map<*, *>)?.get("reactions")
                dao.upsertMessage(
                    existing.copy(
                        reactionsJson = serializeReactions(parseReactionsFromRaw(rawReactions)),
                        serverSequence = seq,
                        updatedAt = System.currentTimeMillis()
                    )
                )
                true
            }

            "seen_updated" -> {
                val backendId = event.messageId ?: (payload?.get("messageId") as? String) ?: return false
                val existing = dao.findByBackendId(conversationId, backendId) ?: return false
                if (existing.serverSequence > seq) return true
                dao.upsertMessage(
                    existing.copy(
                        status = UiMessageStatus.READ.name,
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
            rawJson = null,
            reactionsJson = serializeReactions(reactions),
            replyToId = replyTo?.id,
            replyToText = replyTo?.text,
            replyToSenderName = replyTo?.senderName,
            replyToMine = replyTo?.mine ?: false
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
            isDeleted = isDeleted,
            reactions = deserializeReactions(reactionsJson),
            replyTo = replyToId?.let { id ->
                UiReplyPreview(id = id, text = replyToText.orEmpty(), senderName = replyToSenderName, mine = replyToMine)
            }
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

    private fun serializeReactions(reactions: List<UiReaction>): String? {
        if (reactions.isEmpty()) return null
        val array = JSONArray()
        for (reaction in reactions) {
            val obj = JSONObject()
            obj.put("emoji", reaction.emoji)
            obj.put("count", reaction.count)
            obj.put("mine", reaction.mine)
            array.put(obj)
        }
        return array.toString()
    }

    private fun deserializeReactions(json: String?): List<UiReaction> {
        if (json.isNullOrBlank()) return emptyList()
        return runCatching {
            val array = JSONArray(json)
            (0 until array.length()).map { index ->
                val obj = array.getJSONObject(index)
                UiReaction(
                    emoji = obj.getString("emoji"),
                    count = obj.optInt("count", 1),
                    mine = obj.optBoolean("mine", false)
                )
            }
        }.getOrDefault(emptyList())
    }

    private fun parseReactionsFromRaw(raw: Any?): List<UiReaction> {
        val list = raw as? List<*> ?: return emptyList()
        val myId = AuthSession.currentUserId
        return list.mapNotNull { entry ->
            val map = entry as? Map<*, *> ?: return@mapNotNull null
            val emoji = mapString(map, "emoji")?.takeIf { it.isNotBlank() } ?: return@mapNotNull null
            val user = map["user"] as? Map<*, *>
            emoji to mapString(user, "_id")
        }
            .groupBy({ it.first }, { it.second })
            .map { (emoji, userIds) ->
                UiReaction(emoji = emoji, count = userIds.size, mine = myId != null && userIds.contains(myId))
            }
    }

    companion object {
        internal fun normalizeEventTypeForSync(type: String?): String {
            val raw = type.orEmpty().trim().lowercase()
            return when (raw) {
                "message.created", "message_created" -> "message_created"
                "message.edited", "message_edited" -> "message_edited"
                "message.deleted", "message_deleted" -> "message_deleted"
                "message.deleted_for_everyone", "message_deleted_for_everyone" -> "message_deleted"
                "message.reactions", "reaction_updated", "reactions_updated" -> "reaction_updated"
                "message.seen", "seen_updated" -> "seen_updated"
                else -> raw
            }
        }

        internal fun nextCursorValue(current: Long, candidate: Long): Long = maxOf(current, candidate)
    }
}
