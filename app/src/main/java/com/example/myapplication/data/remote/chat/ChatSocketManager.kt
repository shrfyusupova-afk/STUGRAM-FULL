package com.example.myapplication.data.remote.chat

import com.example.myapplication.BuildConfig
import com.example.myapplication.data.remote.AuthSession
import io.socket.client.IO
import io.socket.client.Socket
import io.socket.emitter.Emitter
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import org.json.JSONArray
import org.json.JSONObject
import java.time.Instant

object ChatSocketManager {
    private val SOCKET_URL: String get() = BuildConfig.SOCKET_URL

    private var socket: Socket? = null
    private var listenersAttached = false
    private var activeToken: String? = null
    private var hasConnectedOnce = false

    private val activeRooms = linkedSetOf<String>()

    private val _events = MutableSharedFlow<ChatSocketEvent>(extraBufferCapacity = 64)
    val events: SharedFlow<ChatSocketEvent> = _events

    @Synchronized
    fun updateAccessToken(token: String?) {
        val normalized = token?.takeIf { it.isNotBlank() }
        if (activeToken == normalized) return

        activeToken = normalized
        if (normalized == null) {
            disconnect()
            return
        }

        reconnectWithCurrentToken()
    }

    @Synchronized
    fun ensureConnected() {
        if (activeToken.isNullOrBlank()) {
            activeToken = AuthSession.accessToken?.takeIf { it.isNotBlank() }
        }
        if (activeToken.isNullOrBlank()) return

        val existing = socket
        if (existing == null) {
            reconnectWithCurrentToken()
        } else if (!existing.connected()) {
            existing.connect()
        }
    }

    @Synchronized
    fun joinConversation(conversationId: String) {
        if (conversationId.isBlank()) return
        ensureConnected()
        val isNewRoom = activeRooms.add(conversationId)
        val current = socket
        if (current?.connected() == true) {
            // If this room is already active and the socket is connected, it has already
            // been joined (either here or via the EVENT_CONNECT rejoin loop) - skip the
            // duplicate emit. If the socket isn't connected yet, EVENT_CONNECT will join
            // every room in activeRooms once it comes up, so no emit is needed here either.
            if (isNewRoom) {
                current.emit("join_conversation", conversationId)
                current.emit("join_room", conversationId)
            }
        }
    }

    @Synchronized
    fun leaveConversation(conversationId: String) {
        if (conversationId.isBlank()) return
        if (!activeRooms.remove(conversationId)) return
        val current = socket
        if (current?.connected() == true) {
            current.emit("leave_conversation", conversationId)
            current.emit("leave_room", conversationId)
        }
    }

    @Synchronized
    fun disconnect() {
        activeRooms.clear()
        listenersAttached = false
        hasConnectedOnce = false
        socket?.disconnect()
        socket?.off()
        socket = null
    }

    @Synchronized
    private fun reconnectWithCurrentToken() {
        val token = activeToken ?: return

        socket?.disconnect()
        socket?.off()

        val options = IO.Options.builder()
            .setForceNew(false)
            .setReconnection(true)
            .setReconnectionAttempts(Int.MAX_VALUE)
            .setReconnectionDelay(1_000)
            .setReconnectionDelayMax(10_000)
            .build()

        options.auth = mapOf(
            "token" to token,
            "authorization" to "Bearer $token"
        )

        val created = IO.socket(SOCKET_URL, options)
        socket = created
        listenersAttached = false
        attachListeners(created)
        created.connect()
    }

    private fun attachListeners(target: Socket) {
        if (listenersAttached) return
        listenersAttached = true

        target.on(Socket.EVENT_CONNECT) {
            val emitReconnectEvent = synchronized(this) {
                val shouldEmit = hasConnectedOnce
                hasConnectedOnce = true
                shouldEmit
            }
            synchronized(this) {
                activeRooms.forEach { room ->
                    target.emit("join_conversation", room)
                    target.emit("join_room", room)
                }
            }
            if (emitReconnectEvent) {
                _events.tryEmit(ChatSocketEvent.Reconnected)
            }
        }

        val newMessageHandler = Emitter.Listener { args ->
            val payload = args.firstOrNull() ?: return@Listener
            val obj = payloadToObject(payload) ?: return@Listener
            parseSocketMessage(obj)?.let { _events.tryEmit(it) }
        }

        target.on("new_message", newMessageHandler)
        target.on("message_created", newMessageHandler)

        val seenHandler = Emitter.Listener { args ->
            val payload = args.firstOrNull() ?: return@Listener
            val obj = payloadToObject(payload) ?: return@Listener
            val messageId = obj.optString("messageId").ifBlank {
                obj.optString("_id")
            }
            if (messageId.isBlank()) return@Listener
            _events.tryEmit(
                ChatSocketEvent.MessageSeen(
                    messageId = messageId,
                    conversationId = obj.optString("conversationId").ifBlank { null }
                )
            )
        }
        target.on("message_seen", seenHandler)

        val typingStartHandler = Emitter.Listener { args ->
            val payload = args.firstOrNull() ?: return@Listener
            val obj = payloadToObject(payload) ?: return@Listener
            val conversationId = obj.optString("conversationId")
            if (conversationId.isBlank()) return@Listener
            val userId = obj.optJSONObject("user")?.optString("_id")?.ifBlank { null }
                ?: obj.optString("userId").ifBlank { null }
            _events.tryEmit(ChatSocketEvent.Typing(conversationId = conversationId, userId = userId, isTyping = true))
        }
        target.on("typing_start", typingStartHandler)

        val typingStopHandler = Emitter.Listener { args ->
            val payload = args.firstOrNull() ?: return@Listener
            val obj = payloadToObject(payload) ?: return@Listener
            val conversationId = obj.optString("conversationId")
            if (conversationId.isBlank()) return@Listener
            val userId = obj.optString("userId").ifBlank { null }
            _events.tryEmit(ChatSocketEvent.Typing(conversationId = conversationId, userId = userId, isTyping = false))
        }
        target.on("typing_stop", typingStopHandler)

        val deletedHandler = Emitter.Listener { args ->
            val payload = args.firstOrNull() ?: return@Listener
            val obj = payloadToObject(payload) ?: return@Listener
            val messageId = obj.optString("messageId").ifBlank { null } ?: return@Listener
            val conversationId = obj.optString("conversationId").ifBlank { null }
            val deletedForUserId = obj.optString("deletedForUserId").ifBlank { null }
            val myId = AuthSession.currentUserId
            if (deletedForUserId == null || myId == null || deletedForUserId == myId) {
                _events.tryEmit(ChatSocketEvent.MessageDeleted(conversationId = conversationId, messageId = messageId))
            }
        }
        target.on("message_deleted", deletedHandler)

        val deletedForEveryoneHandler = Emitter.Listener { args ->
            val payload = args.firstOrNull() ?: return@Listener
            val obj = payloadToObject(payload) ?: return@Listener
            val messageId = obj.optString("messageId").ifBlank { null } ?: return@Listener
            val conversationId = obj.optString("conversationId").ifBlank { null }
            _events.tryEmit(ChatSocketEvent.MessageDeletedForEveryone(conversationId = conversationId, messageId = messageId))
        }
        target.on("message_deleted_for_everyone", deletedForEveryoneHandler)

        val reactionUpdatedHandler = Emitter.Listener { args ->
            val payload = args.firstOrNull() ?: return@Listener
            val obj = payloadToObject(payload) ?: return@Listener
            val message = obj.optJSONObject("message")
            val messageId = message?.optString("_id")?.ifBlank { null } ?: return@Listener
            val conversationId = obj.optString("conversationId").ifBlank { null }
            _events.tryEmit(
                ChatSocketEvent.ReactionUpdated(
                    conversationId = conversationId,
                    messageId = messageId,
                    reactions = parseReactionsFromJson(message)
                )
            )
        }
        target.on("message_reaction_updated", reactionUpdatedHandler)

        val pinnedHandler = Emitter.Listener { args ->
            val payload = args.firstOrNull() ?: return@Listener
            val obj = payloadToObject(payload) ?: return@Listener
            val conversationId = obj.optString("conversationId").ifBlank { null } ?: return@Listener
            val conversation = obj.optJSONObject("conversation")
            _events.tryEmit(
                ChatSocketEvent.ConversationPinned(
                    conversationId = conversationId,
                    pinnedMessage = parsePinnedMessage(conversation)
                )
            )
        }
        target.on("message_pinned", pinnedHandler)

        val unpinnedHandler = Emitter.Listener { args ->
            val payload = args.firstOrNull() ?: return@Listener
            val obj = payloadToObject(payload) ?: return@Listener
            val conversationId = obj.optString("conversationId").ifBlank { null } ?: return@Listener
            _events.tryEmit(ChatSocketEvent.ConversationUnpinned(conversationId = conversationId))
        }
        target.on("message_unpinned", unpinnedHandler)
    }

    @Synchronized
    fun setTyping(conversationId: String, isTyping: Boolean) {
        if (conversationId.isBlank()) return
        val current = socket?.takeIf { it.connected() } ?: return
        val payload = JSONObject().put("conversationId", conversationId)
        current.emit(if (isTyping) "typing_start" else "typing_stop", payload)
    }

    private fun payloadToObject(payload: Any): JSONObject? {
        return when (payload) {
            is JSONObject -> payload
            is String -> runCatching { JSONObject(payload) }.getOrNull()
            is JSONArray -> payload.optJSONObject(0)
            else -> null
        }
    }

    private fun parseSocketMessage(obj: JSONObject): ChatSocketEvent.NewMessage? {
        val rootMessage = obj.optJSONObject("message") ?: obj
        val backendId = rootMessage.optString("_id").ifBlank { rootMessage.optString("id") }
        val conversationId = rootMessage.optString("conversation").ifBlank {
            rootMessage.optString("conversationId").ifBlank {
                obj.optString("conversationId")
            }
        }

        if (backendId.isBlank() || conversationId.isBlank()) return null

        val senderObj = rootMessage.optJSONObject("sender")
        val senderId = senderObj?.optString("_id").orEmpty().ifBlank {
            rootMessage.optString("senderId")
        }
        val senderName = senderObj?.optString("fullName").orEmpty().ifBlank {
            senderObj?.optString("username").orEmpty()
        }.ifBlank { null }

        val createdAtMillis = parseTimeMillis(rootMessage.optString("createdAt"))

        return ChatSocketEvent.NewMessage(
            conversationId = conversationId,
            backendId = backendId,
            clientId = rootMessage.optString("clientId").ifBlank { null },
            senderId = senderId.ifBlank { "unknown" },
            senderName = senderName,
            text = rootMessage.optString("text"),
            createdAtMillis = createdAtMillis,
            read = !rootMessage.optString("readAt").isNullOrBlank(),
            serverSequence = rootMessage.optLong("serverSequence", 0L).takeIf { it > 0L }
                ?: obj.optLong("serverSequence", 0L),
            replyTo = parseReplyPreview(rootMessage.optJSONObject("replyToMessage"))
        )
    }

    private fun parseReplyPreview(reply: JSONObject?): UiReplyPreview? {
        reply ?: return null
        val replySender = reply.optJSONObject("sender")
        val myId = AuthSession.currentUserId
        val replySenderId = replySender?.optString("_id")?.ifBlank { null }
        return UiReplyPreview(
            id = reply.optString("_id"),
            text = reply.optString("text").ifBlank { "Xabar" },
            senderName = replySender?.optString("fullName")?.ifBlank { null }
                ?: replySender?.optString("username")?.ifBlank { null },
            mine = myId != null && replySenderId == myId
        )
    }

    private fun parseReactionsFromJson(message: JSONObject?): List<UiReaction> {
        val reactionsArray = message?.optJSONArray("reactions") ?: return emptyList()
        val myId = AuthSession.currentUserId
        val pairs = mutableListOf<Pair<String, String?>>()
        for (i in 0 until reactionsArray.length()) {
            val obj = reactionsArray.optJSONObject(i) ?: continue
            val emoji = obj.optString("emoji").takeIf { it.isNotBlank() } ?: continue
            val userId = obj.optJSONObject("user")?.optString("_id")?.ifBlank { null }
            pairs.add(emoji to userId)
        }
        return pairs.groupBy({ it.first }, { it.second })
            .map { (emoji, userIds) ->
                UiReaction(emoji = emoji, count = userIds.size, mine = myId != null && userIds.contains(myId))
            }
    }

    private fun parsePinnedMessage(conversation: JSONObject?): UiPinnedMessage? {
        val pinned = conversation?.optJSONObject("pinnedMessage") ?: return null
        val sender = pinned.optJSONObject("sender")
        val isDeleted = pinned.optBoolean("isDeletedForEveryone", false)
        return UiPinnedMessage(
            id = pinned.optString("_id"),
            text = if (isDeleted) "Bu xabar o'chirilgan" else pinned.optString("text"),
            senderName = sender?.optString("fullName")?.ifBlank { null }
                ?: sender?.optString("username")?.ifBlank { null }
        )
    }

    private fun parseTimeMillis(value: String?): Long {
        if (value.isNullOrBlank()) return System.currentTimeMillis()
        return runCatching { Instant.parse(value).toEpochMilli() }.getOrElse { System.currentTimeMillis() }
    }
}
