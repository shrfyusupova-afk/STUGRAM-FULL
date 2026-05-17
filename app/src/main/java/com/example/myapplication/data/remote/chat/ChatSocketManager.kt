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
        activeRooms.add(conversationId)
        socket?.emit("join_conversation", conversationId)
        socket?.emit("join_room", conversationId)
    }

    @Synchronized
    fun leaveConversation(conversationId: String) {
        if (conversationId.isBlank()) return
        activeRooms.remove(conversationId)
        socket?.emit("leave_conversation", conversationId)
        socket?.emit("leave_room", conversationId)
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

        val typingHandler = Emitter.Listener { args ->
            val payload = args.firstOrNull() ?: return@Listener
            val obj = payloadToObject(payload) ?: return@Listener
            val conversationId = obj.optString("conversationId")
            if (conversationId.isBlank()) return@Listener
            _events.tryEmit(ChatSocketEvent.Typing(conversationId = conversationId, userId = obj.optString("userId").ifBlank { null }))
        }
        target.on("typing", typingHandler)
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
                ?: obj.optLong("serverSequence", 0L)
        )
    }

    private fun parseTimeMillis(value: String?): Long {
        if (value.isNullOrBlank()) return System.currentTimeMillis()
        return runCatching { Instant.parse(value).toEpochMilli() }.getOrElse { System.currentTimeMillis() }
    }
}
