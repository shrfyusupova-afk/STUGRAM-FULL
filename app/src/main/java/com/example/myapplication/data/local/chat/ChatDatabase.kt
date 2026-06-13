package com.example.myapplication.data.local.chat

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

@Database(
    entities = [ChatMessageEntity::class, ChatPendingMessageEntity::class, ChatEventCursorEntity::class],
    version = 5,
    exportSchema = false
)
abstract class ChatDatabase : RoomDatabase() {
    abstract fun chatMessageDao(): ChatMessageDao
    abstract fun chatPendingMessageDao(): ChatPendingMessageDao
    abstract fun chatEventCursorDao(): ChatEventCursorDao

    companion object {
        @Volatile
        private var INSTANCE: ChatDatabase? = null

        // Migration 1 → 2: adds the outbox table for reliable message delivery.
        // Uses IF NOT EXISTS so it is safe to run even if the table already exists
        // (e.g., a developer re-runs from a partial state).
        val MIGRATION_1_2 = object : Migration(1, 2) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL(
                    """
                    CREATE TABLE IF NOT EXISTS `chat_pending_messages` (
                        `localId` TEXT NOT NULL,
                        `conversationId` TEXT NOT NULL,
                        `clientId` TEXT NOT NULL,
                        `text` TEXT NOT NULL,
                        `status` TEXT NOT NULL,
                        `retryCount` INTEGER NOT NULL,
                        `nextAttemptAt` INTEGER NOT NULL,
                        `lastError` TEXT,
                        `createdAt` INTEGER NOT NULL,
                        `updatedAt` INTEGER NOT NULL,
                        PRIMARY KEY(`localId`)
                    )
                    """.trimIndent()
                )
                db.execSQL(
                    "CREATE UNIQUE INDEX IF NOT EXISTS `index_chat_pending_messages_clientId` " +
                    "ON `chat_pending_messages` (`clientId`)"
                )
                db.execSQL(
                    "CREATE INDEX IF NOT EXISTS `index_chat_pending_messages_nextAttemptAt` " +
                    "ON `chat_pending_messages` (`nextAttemptAt`)"
                )
                db.execSQL(
                    "CREATE INDEX IF NOT EXISTS `index_chat_pending_messages_status` " +
                    "ON `chat_pending_messages` (`status`)"
                )
            }
        }

        // Migration 2 → 3: adds the event-cursor table used for reconnect sync.
        val MIGRATION_2_3 = object : Migration(2, 3) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL(
                    """
                    CREATE TABLE IF NOT EXISTS `chat_event_cursor` (
                        `conversationId` TEXT NOT NULL,
                        `latestSequence` INTEGER NOT NULL,
                        `updatedAt` INTEGER NOT NULL,
                        PRIMARY KEY(`conversationId`)
                    )
                    """.trimIndent()
                )
            }
        }

        // Migration 3 → 4: adds reaction and reply-preview columns to chat_messages
        // for message reactions and reply-to-message support.
        val MIGRATION_3_4 = object : Migration(3, 4) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE `chat_messages` ADD COLUMN `reactionsJson` TEXT")
                db.execSQL("ALTER TABLE `chat_messages` ADD COLUMN `replyToId` TEXT")
                db.execSQL("ALTER TABLE `chat_messages` ADD COLUMN `replyToText` TEXT")
                db.execSQL("ALTER TABLE `chat_messages` ADD COLUMN `replyToSenderName` TEXT")
                db.execSQL("ALTER TABLE `chat_messages` ADD COLUMN `replyToMine` INTEGER NOT NULL DEFAULT 0")
            }
        }

        // Migration 4 → 5: adds media attachment, edit, and forward columns to chat_messages
        // for media messages, message editing, and message forwarding support.
        val MIGRATION_4_5 = object : Migration(4, 5) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE `chat_messages` ADD COLUMN `replyToMessageType` TEXT")
                db.execSQL("ALTER TABLE `chat_messages` ADD COLUMN `messageType` TEXT NOT NULL DEFAULT 'text'")
                db.execSQL("ALTER TABLE `chat_messages` ADD COLUMN `mediaUrl` TEXT")
                db.execSQL("ALTER TABLE `chat_messages` ADD COLUMN `mediaType` TEXT")
                db.execSQL("ALTER TABLE `chat_messages` ADD COLUMN `mediaFileName` TEXT")
                db.execSQL("ALTER TABLE `chat_messages` ADD COLUMN `mediaFileSize` INTEGER")
                db.execSQL("ALTER TABLE `chat_messages` ADD COLUMN `mediaMimeType` TEXT")
                db.execSQL("ALTER TABLE `chat_messages` ADD COLUMN `mediaDurationSeconds` INTEGER")
                db.execSQL("ALTER TABLE `chat_messages` ADD COLUMN `editedAt` INTEGER")
                db.execSQL("ALTER TABLE `chat_messages` ADD COLUMN `forwardedFromSenderId` TEXT")
            }
        }

        fun getInstance(context: Context): ChatDatabase {
            return INSTANCE ?: synchronized(this) {
                INSTANCE ?: Room.databaseBuilder(
                    context.applicationContext,
                    ChatDatabase::class.java,
                    "stugram-chat.db"
                )
                .addMigrations(MIGRATION_1_2, MIGRATION_2_3, MIGRATION_3_4, MIGRATION_4_5)
                .build()
                .also { INSTANCE = it }
            }
        }

        // Called on logout: closes the open connection and deletes the DB file so
        // private chat messages are not readable by the next device user or by an
        // attacker with physical access. The DB is re-created from scratch on the
        // next login.
        fun clearAndWipe(context: Context) {
            synchronized(this) {
                INSTANCE?.close()
                INSTANCE = null
            }
            context.applicationContext.deleteDatabase("stugram-chat.db")
        }
    }
}
