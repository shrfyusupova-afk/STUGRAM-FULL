package com.example.myapplication.data.local.chat

import com.example.myapplication.data.remote.chat.ChatEventDto
import com.example.myapplication.data.remote.chat.ChatEventsDataDto
import com.example.myapplication.data.remote.chat.UiMessageStatus
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class ChatLocalStoreTest {

    // ---- in-memory fake DAO implementations ----

    private class FakeChatMessageDao : ChatMessageDao {
        val rows = mutableMapOf<String, ChatMessageEntity>()

        override fun observeMessages(conversationId: String): Flow<List<ChatMessageEntity>> =
            MutableStateFlow(rows.values.filter { it.conversationId == conversationId })

        override suspend fun upsertMessages(messages: List<ChatMessageEntity>) {
            messages.forEach { rows[it.stableId] = it }
        }
        override suspend fun upsertMessage(message: ChatMessageEntity) { rows[message.stableId] = message }
        override suspend fun deleteByStableId(stableId: String) { rows.remove(stableId) }
        override suspend fun findByClientId(conversationId: String, clientId: String): ChatMessageEntity? =
            rows.values.firstOrNull { it.conversationId == conversationId && it.clientId == clientId }
        override suspend fun findConfirmedByClientId(clientId: String): ChatMessageEntity? =
            rows.values.firstOrNull { it.clientId == clientId && it.backendId != null }
        override suspend fun findByBackendId(conversationId: String, backendId: String): ChatMessageEntity? =
            rows.values.firstOrNull { it.conversationId == conversationId && it.backendId == backendId }
        override suspend fun updateStatusByBackendId(backendId: String, status: String, updatedAt: Long) {
            val entity = rows.values.firstOrNull { it.backendId == backendId } ?: return
            rows[entity.stableId] = entity.copy(status = status, updatedAt = updatedAt)
        }
        override suspend fun getBackendIdsByStatus(conversationId: String, status: String, limit: Int): List<String> =
            rows.values.filter { it.conversationId == conversationId && it.status == status }
                .take(limit).mapNotNull { it.backendId }
        override suspend fun clearConversation(conversationId: String) {
            rows.keys.removeAll(rows.values.filter { it.conversationId == conversationId }.map { it.stableId }.toSet())
        }
    }

    private class FakeChatEventCursorDao : ChatEventCursorDao {
        val rows = mutableMapOf<String, ChatEventCursorEntity>()
        override suspend fun getCursor(conversationId: String): ChatEventCursorEntity? = rows[conversationId]
        override suspend fun upsertCursor(entity: ChatEventCursorEntity) { rows[entity.conversationId] = entity }
        override fun observeCursor(conversationId: String): Flow<ChatEventCursorEntity?> =
            MutableStateFlow(rows[conversationId])
    }

    // ---- helpers ----

    private lateinit var msgDao: FakeChatMessageDao
    private lateinit var cursorDao: FakeChatEventCursorDao
    private lateinit var store: ChatLocalStore

    private val CONV = "conv-1"

    @Before
    fun setUp() {
        msgDao = FakeChatMessageDao()
        cursorDao = FakeChatEventCursorDao()
        store = ChatLocalStore(msgDao, cursorDao)
    }

    private fun entity(
        stableId: String,
        backendId: String? = null,
        clientId: String? = null,
        text: String = "hello",
        isDeleted: Boolean = false,
        serverSequence: Long = 0L,
        status: String = UiMessageStatus.SENT.name
    ) = ChatMessageEntity(
        stableId = stableId,
        conversationId = CONV,
        backendId = backendId,
        clientId = clientId,
        senderId = "user-a",
        text = text,
        status = status,
        isDeleted = isDeleted,
        serverSequence = serverSequence,
        createdAt = System.currentTimeMillis(),
        updatedAt = System.currentTimeMillis()
    )

    private fun event(
        type: String,
        messageId: String? = null,
        seq: Long,
        payload: Map<String, Any?>? = null
    ) = ChatEventDto(
        eventType = type,
        serverSequence = seq,
        messageId = messageId,
        payload = payload
    )

    // ---- static helper tests (no suspend, no DAO) ----

    @Test
    fun normalizeEventType_handlesAllKnownFormats() {
        assertEquals("message_created", ChatLocalStore.normalizeEventTypeForSync("message.created"))
        assertEquals("message_created", ChatLocalStore.normalizeEventTypeForSync("message_created"))
        assertEquals("message_deleted", ChatLocalStore.normalizeEventTypeForSync("message.deleted"))
        assertEquals("message_deleted", ChatLocalStore.normalizeEventTypeForSync("message_deleted"))
        assertEquals("message_edited",  ChatLocalStore.normalizeEventTypeForSync("message.edited"))
        assertEquals("message_edited",  ChatLocalStore.normalizeEventTypeForSync("message_edited"))
        assertEquals("reaction_updated",ChatLocalStore.normalizeEventTypeForSync("message.reactions"))
        assertEquals("seen_updated",    ChatLocalStore.normalizeEventTypeForSync("message.seen"))
    }

    @Test
    fun nextCursorValue_advancesOnlyForward() {
        assertEquals(10L, ChatLocalStore.nextCursorValue(10L, 5L))   // current wins
        assertEquals(10L, ChatLocalStore.nextCursorValue(5L, 10L))   // candidate wins
        assertEquals(7L,  ChatLocalStore.nextCursorValue(7L, 7L))    // tie
        assertEquals(0L,  ChatLocalStore.nextCursorValue(0L, 0L))    // both zero
    }

    // ---- upsertIncomingSocketMessage tests ----

    @Test
    fun olderServerSequence_doesNotOverwriteNewerMessage() = runTest {
        // Seed a message at seq=10.
        msgDao.upsertMessage(entity("backend:msg-1", backendId = "msg-1", serverSequence = 10L))

        // Apply an older event for the same backendId.
        store.upsertIncomingSocketMessage(
            conversationId = CONV, backendId = "msg-1", clientId = null,
            senderId = "u", senderName = null, text = "stale text",
            createdAtMillis = 1000L, read = false, serverSequence = 5L
        )

        val stored = msgDao.findByBackendId(CONV, "msg-1")!!
        assertEquals(10L, stored.serverSequence)      // sequence unchanged
        assertFalse(stored.text == "stale text")       // text not overwritten
    }

    @Test
    fun newerServerSequence_overwritesOlderMessage() = runTest {
        msgDao.upsertMessage(entity("backend:msg-2", backendId = "msg-2", text = "old text", serverSequence = 3L))

        store.upsertIncomingSocketMessage(
            conversationId = CONV, backendId = "msg-2", clientId = null,
            senderId = "u", senderName = "Alice", text = "new text",
            createdAtMillis = 2000L, read = false, serverSequence = 8L
        )

        val stored = msgDao.findByBackendId(CONV, "msg-2")!!
        assertEquals(8L, stored.serverSequence)
        assertEquals("new text", stored.text)
    }

    @Test
    fun deletedTombstone_isNotResurrectedByOlderEvent() = runTest {
        // A delete was applied at seq=10 — tombstone in DB.
        msgDao.upsertMessage(
            entity("backend:msg-3", backendId = "msg-3", isDeleted = true, serverSequence = 10L)
        )

        // Late-arriving socket event for the same message at seq=5 (message_created race).
        store.upsertIncomingSocketMessage(
            conversationId = CONV, backendId = "msg-3", clientId = null,
            senderId = "u", senderName = null, text = "resurrected",
            createdAtMillis = 500L, read = false, serverSequence = 5L
        )

        val stored = msgDao.findByBackendId(CONV, "msg-3")!!
        assertTrue("tombstone must not be resurrected", stored.isDeleted)
        assertFalse("deleted text must not be overwritten", stored.text == "resurrected")
    }

    @Test
    fun duplicateSocketEvent_doesNotCreateSecondRow() = runTest {
        store.upsertIncomingSocketMessage(
            conversationId = CONV, backendId = "msg-4", clientId = null,
            senderId = "u", senderName = null, text = "hello",
            createdAtMillis = 1000L, read = false, serverSequence = 1L
        )
        store.upsertIncomingSocketMessage(
            conversationId = CONV, backendId = "msg-4", clientId = null,
            senderId = "u", senderName = null, text = "hello",
            createdAtMillis = 1000L, read = false, serverSequence = 1L
        )

        val count = msgDao.rows.values.count { it.backendId == "msg-4" }
        assertEquals(1, count)
    }

    // ---- applyConversationEvents tests ----

    @Test
    fun applyConversationEvents_processesEventsInSequenceOrder() = runTest {
        val eventsDto = ChatEventsDataDto(
            events = listOf(
                event("message_created", seq = 3L, payload = mapOf(
                    "_id" to "msg-b", "text" to "third", "sender" to mapOf("_id" to "u")
                )),
                event("message_created", seq = 1L, payload = mapOf(
                    "_id" to "msg-a", "text" to "first", "sender" to mapOf("_id" to "u")
                )),
                event("message_created", seq = 2L, payload = mapOf(
                    "_id" to "msg-c", "text" to "second", "sender" to mapOf("_id" to "u")
                )),
            )
        )

        val maxSeq = store.applyConversationEvents(CONV, eventsDto)

        assertEquals(3L, maxSeq)
        assertNotNull(msgDao.findByBackendId(CONV, "msg-a"))
        assertNotNull(msgDao.findByBackendId(CONV, "msg-b"))
        assertNotNull(msgDao.findByBackendId(CONV, "msg-c"))
    }

    @Test
    fun applyConversationEvents_skipsAlreadySeenSequences() = runTest {
        // Prime cursor at seq=5.
        cursorDao.upsertCursor(ChatEventCursorEntity(CONV, 5L, System.currentTimeMillis()))

        val eventsDto = ChatEventsDataDto(
            events = listOf(
                event("message_created", seq = 3L, payload = mapOf(
                    "_id" to "old-msg", "text" to "old", "sender" to mapOf("_id" to "u")
                )),
                event("message_created", seq = 6L, payload = mapOf(
                    "_id" to "new-msg", "text" to "new", "sender" to mapOf("_id" to "u")
                )),
            )
        )

        store.applyConversationEvents(CONV, eventsDto)

        assertNull("seq<=cursor must be skipped", msgDao.findByBackendId(CONV, "old-msg"))
        assertNotNull("seq>cursor must be applied", msgDao.findByBackendId(CONV, "new-msg"))
    }

    @Test
    fun applyConversationEvents_messageDeleted_setsTombstone() = runTest {
        msgDao.upsertMessage(entity("backend:del-msg", backendId = "del-msg", text = "visible", serverSequence = 1L))

        val eventsDto = ChatEventsDataDto(
            events = listOf(
                event("message_deleted", messageId = "del-msg", seq = 5L)
            )
        )
        store.applyConversationEvents(CONV, eventsDto)

        val stored = msgDao.findByBackendId(CONV, "del-msg")!!
        assertTrue(stored.isDeleted)
    }

    @Test
    fun cursorDoesNotDecreaseAfterSync() = runTest {
        cursorDao.upsertCursor(ChatEventCursorEntity(CONV, 20L, System.currentTimeMillis()))

        // Apply event with lower sequence — cursor must stay at 20.
        store.syncCursorForward(CONV, 10L)

        val cursor = cursorDao.getCursor(CONV)!!
        assertEquals(20L, cursor.latestSequence)
    }
}
