package com.example.myapplication.data.local.chat

import com.example.myapplication.data.remote.chat.ChatEventDto
import com.example.myapplication.data.remote.chat.ChatEventsDataDto
import com.example.myapplication.data.remote.chat.UiChatMessage
import com.example.myapplication.data.remote.chat.UiMessageStatus
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ChatLocalStoreSyncTest {

    @Test
    fun cursorMovesOnlyForward() {
        assertEquals(10L, ChatLocalStore.nextCursorValue(current = 10L, candidate = 5L))
        assertEquals(10L, ChatLocalStore.nextCursorValue(current = 10L, candidate = 10L))
        assertEquals(12L, ChatLocalStore.nextCursorValue(current = 10L, candidate = 12L))
    }

    @Test
    fun eventTypeNormalizationSupportsDotAndUnderscore() {
        assertEquals("message_created", ChatLocalStore.normalizeEventTypeForSync("message.created"))
        assertEquals("message_created", ChatLocalStore.normalizeEventTypeForSync("message_created"))
        assertEquals("message_edited", ChatLocalStore.normalizeEventTypeForSync("message.edited"))
        assertEquals("message_deleted", ChatLocalStore.normalizeEventTypeForSync("message.deleted"))
        assertEquals("reaction_updated", ChatLocalStore.normalizeEventTypeForSync("message.reactions"))
        assertEquals("seen_updated", ChatLocalStore.normalizeEventTypeForSync("message.seen"))
    }

    @Test
    fun pendingMessageReconcilesWithServerByClientId_singleRow() = kotlinx.coroutines.runBlocking {
        val dao = InMemoryMessageDao()
        val store = ChatLocalStore(dao)

        val optimistic = store.saveOptimisticMessage(
            conversationId = "c1",
            clientId = "cid-1",
            senderId = "me",
            text = "hello",
            nowMillis = 1000L
        )
        assertEquals("client:cid-1", optimistic.id)

        store.replaceOptimisticWithServer(
            conversationId = "c1",
            clientId = "cid-1",
            serverMessage = UiChatMessage(
                id = "m1",
                text = "hello",
                senderName = "me",
                timestamp = 1001L,
                status = UiMessageStatus.SENT,
                clientId = "cid-1",
                serverSequence = 10L
            )
        )

        assertEquals(1, dao.rows.size)
        assertEquals("m1", dao.rows.first().backendId)
        assertEquals("cid-1", dao.rows.first().clientId)
    }

    @Test
    fun socketThenHttpRace_doesNotDuplicate() = kotlinx.coroutines.runBlocking {
        val dao = InMemoryMessageDao()
        val store = ChatLocalStore(dao)

        store.upsertIncomingSocketMessage(
            conversationId = "c1",
            backendId = "m-socket",
            clientId = "cid-race-1",
            senderId = "u1",
            senderName = "User One",
            text = "race",
            createdAtMillis = 2000L,
            read = false,
            serverSequence = 20L
        )
        store.replaceOptimisticWithServer(
            conversationId = "c1",
            clientId = "cid-race-1",
            serverMessage = UiChatMessage(
                id = "m-socket",
                text = "race",
                senderName = "User One",
                timestamp = 2000L,
                status = UiMessageStatus.SENT,
                clientId = "cid-race-1",
                serverSequence = 20L
            ),
            senderId = "u1"
        )

        assertEquals(1, dao.rows.size)
        assertEquals("cid-race-1", dao.rows.first().clientId)
        assertEquals("m-socket", dao.rows.first().backendId)
    }

    @Test
    fun duplicateReplayAndStaleSequence_areIgnored() = kotlinx.coroutines.runBlocking {
        val dao = InMemoryMessageDao()
        val cursorDao = InMemoryCursorDao()
        val store = ChatLocalStore(dao, cursorDao)
        val conversationId = "c1"

        val createdPayload = mapOf(
            "message" to mapOf(
                "_id" to "m100",
                "clientId" to "cid-100",
                "text" to "base",
                "createdAt" to "2026-05-15T10:00:00Z",
                "sender" to mapOf("_id" to "u1", "username" to "u1")
            )
        )
        store.applyConversationEvents(
            conversationId,
            ChatEventsDataDto(events = listOf(ChatEventDto(eventType = "message_created", serverSequence = 100L, payload = createdPayload)))
        )
        store.applyConversationEvents(
            conversationId,
            ChatEventsDataDto(events = listOf(ChatEventDto(eventType = "message_created", serverSequence = 100L, payload = createdPayload)))
        )
        assertEquals(1, dao.rows.size)
        assertEquals(100L, cursorDao.getCursor(conversationId)?.latestSequence)

        store.applyConversationEvents(
            conversationId,
            ChatEventsDataDto(
                events = listOf(
                    ChatEventDto(
                        eventType = "message_edited",
                        serverSequence = 101L,
                        messageId = "m100",
                        payload = mapOf("text" to "edited")
                    )
                )
            )
        )
        store.applyConversationEvents(
            conversationId,
            ChatEventsDataDto(
                events = listOf(
                    ChatEventDto(
                        eventType = "message_edited",
                        serverSequence = 99L,
                        messageId = "m100",
                        payload = mapOf("text" to "stale")
                    )
                )
            )
        )

        assertEquals("edited", dao.rows.first().text)
        assertEquals(101L, dao.rows.first().serverSequence)
        assertEquals(101L, cursorDao.getCursor(conversationId)?.latestSequence)
    }

    @Test
    fun tombstonePreventsResurrection_fromOlderEvent() = kotlinx.coroutines.runBlocking {
        val dao = InMemoryMessageDao()
        val cursorDao = InMemoryCursorDao()
        val store = ChatLocalStore(dao, cursorDao)
        val conversationId = "c1"

        val createdPayload = mapOf(
            "message" to mapOf(
                "_id" to "m200",
                "clientId" to "cid-200",
                "text" to "alive",
                "createdAt" to "2026-05-15T10:00:00Z",
                "sender" to mapOf("_id" to "u1")
            )
        )
        store.applyConversationEvents(
            conversationId,
            ChatEventsDataDto(events = listOf(ChatEventDto(eventType = "message_created", serverSequence = 200L, payload = createdPayload)))
        )
        store.applyConversationEvents(
            conversationId,
            ChatEventsDataDto(events = listOf(ChatEventDto(eventType = "message_deleted", serverSequence = 201L, messageId = "m200")))
        )
        assertTrue(dao.rows.first().isDeleted)

        store.saveBackendMessages(
            conversationId,
            listOf(
                UiChatMessage(
                    id = "m200",
                    text = "old-alive",
                    senderName = "u1",
                    timestamp = 1000L,
                    status = UiMessageStatus.SENT,
                    clientId = "cid-200",
                    serverSequence = 200L,
                    isDeleted = false
                )
            )
        )
        assertTrue(dao.rows.first().isDeleted)
        assertFalse(dao.rows.first().text == "old-alive")
    }

    private class InMemoryMessageDao : ChatMessageDao {
        val rows = mutableListOf<ChatMessageEntity>()
        private val flow = MutableStateFlow<List<ChatMessageEntity>>(emptyList())

        override fun observeMessages(conversationId: String): Flow<List<ChatMessageEntity>> = flow

        override suspend fun upsertMessages(messages: List<ChatMessageEntity>) {
            messages.forEach { upsertMessage(it) }
        }

        override suspend fun upsertMessage(message: ChatMessageEntity) {
            rows.removeAll { it.stableId == message.stableId }
            rows.add(message)
            flow.value = rows.toList()
        }

        override suspend fun deleteByStableId(stableId: String) {
            rows.removeAll { it.stableId == stableId }
            flow.value = rows.toList()
        }

        override suspend fun findByClientId(conversationId: String, clientId: String): ChatMessageEntity? {
            return rows.firstOrNull { it.conversationId == conversationId && it.clientId == clientId }
        }

        override suspend fun findConfirmedByClientId(clientId: String): ChatMessageEntity? {
            return rows.firstOrNull { it.clientId == clientId && it.backendId != null }
        }

        override suspend fun findByBackendId(conversationId: String, backendId: String): ChatMessageEntity? {
            return rows.firstOrNull { it.conversationId == conversationId && it.backendId == backendId }
        }

        override suspend fun updateStatusByBackendId(backendId: String, status: String, updatedAt: Long) {
            val existing = rows.firstOrNull { it.backendId == backendId } ?: return
            upsertMessage(existing.copy(status = status, updatedAt = updatedAt))
        }

        override suspend fun getBackendIdsByStatus(conversationId: String, status: String, limit: Int): List<String> {
            return rows.filter { it.conversationId == conversationId && it.status == status && it.backendId != null }
                .take(limit)
                .mapNotNull { it.backendId }
        }

        override suspend fun clearConversation(conversationId: String) {
            rows.removeAll { it.conversationId == conversationId }
            flow.value = rows.toList()
        }
    }

    private class InMemoryCursorDao : ChatEventCursorDao {
        private val data = LinkedHashMap<String, ChatEventCursorEntity>()
        private val flow = MutableStateFlow<ChatEventCursorEntity?>(null)

        override suspend fun getCursor(conversationId: String): ChatEventCursorEntity? = data[conversationId]

        override suspend fun upsertCursor(entity: ChatEventCursorEntity) {
            data[entity.conversationId] = entity
            flow.value = entity
        }

        override fun observeCursor(conversationId: String): Flow<ChatEventCursorEntity?> = flow
    }
}
