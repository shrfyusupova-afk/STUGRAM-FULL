package com.example.myapplication.data.local.chat

import androidx.room.Room
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Instrumented migration tests for ChatDatabase.
 * Run with: ./gradlew connectedDebugAndroidTest
 *   -Pandroid.testInstrumentationRunnerArguments.class=com.example.myapplication.data.local.chat.ChatDatabaseMigrationTest
 */
@RunWith(AndroidJUnit4::class)
class ChatDatabaseMigrationTest {

    @Test
    fun migrationObjects_haveCorrectVersionBounds() {
        assertEquals(1, ChatDatabase.MIGRATION_1_2.startVersion)
        assertEquals(2, ChatDatabase.MIGRATION_1_2.endVersion)
        assertEquals(2, ChatDatabase.MIGRATION_2_3.startVersion)
        assertEquals(3, ChatDatabase.MIGRATION_2_3.endVersion)
        // Migration chain must be contiguous from v1 to v3.
        assertEquals(
            ChatDatabase.MIGRATION_1_2.endVersion,
            ChatDatabase.MIGRATION_2_3.startVersion
        )
    }

    @Test
    fun freshDatabase_version3_hasAllRequiredTables() = runBlocking {
        val ctx = InstrumentationRegistry.getInstrumentation().targetContext
        val db = Room.inMemoryDatabaseBuilder(ctx, ChatDatabase::class.java).build()

        val cursor = db.openHelper.writableDatabase.query(
            "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
            emptyArray()
        )
        val tables = mutableSetOf<String>()
        while (cursor.moveToNext()) {
            tables.add(cursor.getString(0))
        }
        cursor.close()
        db.close()

        assertTrue("chat_messages table must exist", "chat_messages" in tables)
        assertTrue("chat_pending_messages table must exist", "chat_pending_messages" in tables)
        assertTrue("chat_event_cursor table must exist", "chat_event_cursor" in tables)
    }

    @Test
    fun freshDatabase_version3_chatMessagesHasRequiredColumns() = runBlocking {
        val ctx = InstrumentationRegistry.getInstrumentation().targetContext
        val db = Room.inMemoryDatabaseBuilder(ctx, ChatDatabase::class.java).build()

        val cursor = db.openHelper.writableDatabase.query(
            "PRAGMA table_info(chat_messages)",
            emptyArray()
        )
        val nameIdx = cursor.getColumnIndex("name")
        val columns = mutableSetOf<String>()
        while (cursor.moveToNext()) {
            columns.add(cursor.getString(nameIdx))
        }
        cursor.close()
        db.close()

        listOf("stableId", "conversationId", "backendId", "serverSequence", "isDeleted", "clientId")
            .forEach { col -> assertTrue("chat_messages.$col must exist", col in columns) }
    }

    @Test
    fun freshDatabase_version3_eventCursorTableHasRequiredColumns() = runBlocking {
        val ctx = InstrumentationRegistry.getInstrumentation().targetContext
        val db = Room.inMemoryDatabaseBuilder(ctx, ChatDatabase::class.java).build()

        val cursor = db.openHelper.writableDatabase.query(
            "PRAGMA table_info(chat_event_cursor)",
            emptyArray()
        )
        val nameIdx = cursor.getColumnIndex("name")
        val columns = mutableSetOf<String>()
        while (cursor.moveToNext()) {
            columns.add(cursor.getString(nameIdx))
        }
        cursor.close()
        db.close()

        listOf("conversationId", "latestSequence", "updatedAt")
            .forEach { col -> assertTrue("chat_event_cursor.$col must exist", col in columns) }
    }

    @Test
    fun freshDatabase_version3_pendingMessagesTableHasRequiredColumns() = runBlocking {
        val ctx = InstrumentationRegistry.getInstrumentation().targetContext
        val db = Room.inMemoryDatabaseBuilder(ctx, ChatDatabase::class.java).build()

        val cursor = db.openHelper.writableDatabase.query(
            "PRAGMA table_info(chat_pending_messages)",
            emptyArray()
        )
        val nameIdx = cursor.getColumnIndex("name")
        val columns = mutableSetOf<String>()
        while (cursor.moveToNext()) {
            columns.add(cursor.getString(nameIdx))
        }
        cursor.close()
        db.close()

        listOf("localId", "conversationId", "clientId", "text", "status", "retryCount")
            .forEach { col -> assertTrue("chat_pending_messages.$col must exist", col in columns) }
    }
}
