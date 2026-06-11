package com.example.myapplication.ui.home

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.media.MediaPlayer
import android.media.MediaRecorder
import android.net.Uri
import android.os.Build
import android.provider.OpenableColumns
import android.webkit.MimeTypeMap
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import coil.compose.AsyncImage
import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.*
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.snapshots.SnapshotStateList
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.TransformOrigin
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.input.pointer.positionChange
import androidx.compose.ui.layout.ContentScale
import androidx.compose.material.icons.automirrored.filled.Reply
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import com.example.myapplication.R
import com.example.myapplication.data.local.chat.ChatDatabase
import com.example.myapplication.data.local.chat.ChatLocalStore
import com.example.myapplication.data.local.chat.ChatOutboxScheduler
import com.example.myapplication.data.local.chat.ChatPendingMessageEntity
import com.example.myapplication.data.local.chat.ChatPendingStatus
import com.example.myapplication.data.remote.chat.ChatFailureClassifier
import com.example.myapplication.data.remote.chat.ChatFailureType
import com.example.myapplication.data.remote.chat.ChatRepository
import com.example.myapplication.data.remote.chat.ChatResult
import com.example.myapplication.data.remote.chat.UiChatMessage
import com.example.myapplication.data.remote.chat.UiConversationSummary
import com.example.myapplication.data.remote.chat.UiMedia
import com.example.myapplication.data.remote.chat.UiMessageStatus
import com.example.myapplication.data.remote.chat.UiPinnedMessage
import com.example.myapplication.data.remote.chat.UiReaction
import com.example.myapplication.data.remote.chat.UiReplyPreview
import com.example.myapplication.data.remote.chat.ChatSocketEvent
import com.example.myapplication.data.remote.chat.ChatSocketManager
import com.example.myapplication.ui.theme.IosEmojiFont
import com.example.myapplication.ui.theme.PremiumBlue
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import java.text.SimpleDateFormat
import java.util.*
import kotlin.math.max
import kotlin.math.roundToInt

@Composable
fun ChatDetailScreen(
    userName: String,
    isDarkMode: Boolean,
    onBack: () -> Unit,
    isRequest: Boolean = false
) {
    val backgroundColor = if (isDarkMode) Color.Black else Color.White
    val contentColor = if (isDarkMode) Color.White else Color.Black
    val accentBlue = Color(0xFF00A3FF)
    val keyboardController = LocalSoftwareKeyboardController.current
    
    val glassBg = if (isDarkMode) Color.Black.copy(alpha = 0.7f) else Color.White.copy(alpha = 0.7f)
    val pillBg = if (isDarkMode) Color.White.copy(alpha = 0.12f) else Color.White.copy(alpha = 0.6f)
    val glassBorder = if (isDarkMode) Color.White.copy(alpha = 0.1f) else Color.Black.copy(0.05f)

    val headerHeight = 90.dp

    val backgroundImage = if (isDarkMode) {
        painterResource(id = R.drawable.tun)
    } else {
        painterResource(id = R.drawable.kun)
    }

    var messageText by remember { mutableStateOf("") }
    var isMenuOpen by remember { mutableStateOf(false) }

    var showChatInfo by remember { mutableStateOf(false) }
    var showMemberProfile by remember { mutableStateOf(false) }
    var showVoiceCall by remember { mutableStateOf(false) }
    var showVideoCall by remember { mutableStateOf(false) }

    var isTyping by remember { mutableStateOf(false) }
    var isMemberProfileRefreshing by remember { mutableStateOf(false) }
    var errorText by remember { mutableStateOf<String?>(null) }
    var conversationId by remember { mutableStateOf<String?>(null) }
    var isConversationLoading by remember { mutableStateOf(false) }
    var sendBlockedUntilMillis by remember { mutableLongStateOf(0L) }
    var lastSeenSyncAtMillis by remember { mutableLongStateOf(0L) }
    var syncInFlight by remember { mutableStateOf(false) }
    var lastReconnectSyncAtMillis by remember { mutableLongStateOf(0L) }
    val newMessageIds = remember { mutableStateOf(emptySet<String>()) }
    val knownMessageKeys = remember { mutableStateOf<Set<String>?>(null) }
    var initialLoadComplete by remember { mutableStateOf(false) }
    var unreadCount by remember { mutableIntStateOf(0) }

    var typingActive by remember { mutableStateOf(false) }
    var lastTypingEmitAtMillis by remember { mutableLongStateOf(0L) }
    var lastTypingEventAtMillis by remember { mutableLongStateOf(0L) }

    // --- Reply / reactions / pin / pagination / context menu state ---
    var replyingTo by remember { mutableStateOf<UiReplyPreview?>(null) }
    var pinnedMessage by remember { mutableStateOf<UiPinnedMessage?>(null) }
    var contextMenuMessage by remember { mutableStateOf<MessageData?>(null) }
    val pendingDeletionIds = remember { mutableStateOf(emptySet<String>()) }
    val heartBurstIds = remember { mutableStateOf(emptySet<String>()) }
    var currentPage by remember { mutableIntStateOf(1) }
    var hasMoreMessages by remember { mutableStateOf(true) }
    var isLoadingMore by remember { mutableStateOf(false) }

    // --- Edit / forward / search state ---
    var editingMessage by remember { mutableStateOf<MessageData?>(null) }
    var forwardingMessage by remember { mutableStateOf<MessageData?>(null) }
    var showSearchOverlay by remember { mutableStateOf(false) }
    var searchQuery by remember { mutableStateOf("") }
    val searchResults = remember { mutableStateListOf<UiChatMessage>() }
    var isSearching by remember { mutableStateOf(false) }
    var highlightedMessageKey by remember { mutableStateOf<String?>(null) }
    var isJumpingToMessage by remember { mutableStateOf(false) }

    // --- Media attachment state ---
    var fullScreenImageUrl by remember { mutableStateOf<String?>(null) }

    var recordMode by remember { mutableStateOf(RecordMode.VOICE) }
    var isRecording by remember { mutableStateOf(false) }
    var isLocked by remember { mutableStateOf(false) }
    var recordSeconds by remember { mutableIntStateOf(0) }
    var recordDragY by remember { mutableFloatStateOf(0f) }
    var flashOn by remember { mutableStateOf(false) }
    val haptic = LocalHapticFeedback.current
    val clipboardManager = LocalClipboardManager.current

    LaunchedEffect(isRecording) {
        if (isRecording) {
            recordSeconds = 0
            while (true) {
                delay(1000)
                recordSeconds++
            }
        }
    }

    val recPulse = rememberInfiniteTransition(label = "rec_pulse")
    val recDotAlpha by recPulse.animateFloat(
        initialValue = 0.35f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(700, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "rec_dot"
    )
    val recordingWaveScale by recPulse.animateFloat(
        initialValue = 1f,
        targetValue = 1.45f,
        animationSpec = infiniteRepeatable(
            animation = tween(1100, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "rec_wave"
    )

    val context = LocalContext.current

    var hasAudioPermission by remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) ==
                PackageManager.PERMISSION_GRANTED
        )
    }
    val audioPermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission()
    ) { granted -> hasAudioPermission = granted }
    var mediaRecorder by remember { mutableStateOf<MediaRecorder?>(null) }
    var recordingFile by remember { mutableStateOf<File?>(null) }

    DisposableEffect(Unit) {
        onDispose {
            mediaRecorder?.let { recorder ->
                try {
                    recorder.stop()
                } catch (_: Exception) {
                }
                recorder.release()
            }
            recordingFile?.delete()
        }
    }

    val chatDatabase = remember { ChatDatabase.getInstance(context) }
    val chatRepository = remember { ChatRepository() }
    val cursorDao = remember { chatDatabase.chatEventCursorDao() }
    val chatLocalStore = remember {
        ChatLocalStore(chatDatabase.chatMessageDao(), cursorDao)
    }
    val pendingDao = remember { chatDatabase.chatPendingMessageDao() }

    val messages = remember {
        if (isRequest) {
            mutableStateListOf(
                MessageData("1", "Salom! Men sizni follow qildim, siz ham follow qivoring iltimos.", false, timestamp = System.currentTimeMillis())
            )
        } else {
            mutableStateListOf()
        }
    }

    val listState = rememberLazyListState()
    val scope = rememberCoroutineScope()
    val isAtBottom by remember {
        derivedStateOf { listState.firstVisibleItemIndex == 0 && listState.firstVisibleItemScrollOffset < 120 }
    }

    LaunchedEffect(isAtBottom) {
        if (isAtBottom) unreadCount = 0
    }

    if (!isRequest) {
        // Auto-clears the "typing..." indicator if the expected typing_stop event
        // never arrives (e.g. the other client disconnects mid-type).
        LaunchedEffect(isTyping, lastTypingEventAtMillis) {
            if (isTyping) {
                delay(6000)
                if (System.currentTimeMillis() - lastTypingEventAtMillis >= 6000) {
                    isTyping = false
                }
            }
        }

        // Sends typing_stop once the local user pauses typing for a while.
        LaunchedEffect(messageText) {
            if (messageText.isNotBlank() && typingActive) {
                delay(3000)
                val targetConversationId = conversationId
                if (!targetConversationId.isNullOrBlank() && typingActive) {
                    ChatSocketManager.setTyping(targetConversationId, false)
                    typingActive = false
                }
            }
        }
    }

    fun mapUiToMessageData(message: UiChatMessage): MessageData {
        val isMe = when {
            message.senderName.equals("me", ignoreCase = true) -> true
            message.senderName.isNullOrBlank() -> false
            else -> !message.senderName.equals(userName, ignoreCase = true)
        }
        return MessageData(
            id = message.id,
            text = message.text,
            isMe = isMe,
            timestamp = message.timestamp,
            status = when (message.status) {
                UiMessageStatus.READ -> MessageStatus.READ
                UiMessageStatus.SENDING -> MessageStatus.SENDING
                UiMessageStatus.FAILED -> MessageStatus.FAILED
                UiMessageStatus.SENT -> MessageStatus.SENT
            },
            clientId = message.clientId,
            isDeleted = message.isDeleted,
            reactions = message.reactions,
            replyTo = message.replyTo,
            messageType = message.messageType,
            media = message.media,
            editedAt = message.editedAt,
            forwardedFromSenderId = message.forwardedFromSenderId
        )
    }

    suspend fun syncMissingEvents(targetConversationId: String) {
        if (syncInFlight) return
        syncInFlight = true
        try {
            val cursor = chatLocalStore.getLatestCursor(targetConversationId)
            when (val syncResult = chatRepository.getConversationEvents(targetConversationId, cursor)) {
                is ChatResult.Success -> {
                    chatLocalStore.applyConversationEvents(targetConversationId, syncResult.value)
                }
                is ChatResult.Error -> {
                    errorText = syncResult.message
                }
            }
        } finally {
            syncInFlight = false
        }
    }

    if (!isRequest) {
        LaunchedEffect(userName) {
            errorText = null
            isConversationLoading = true
            var attempt = 0
            while (conversationId == null && attempt < 5) {
                when (val result = chatRepository.findOrCreateConversationWithUserName(userName)) {
                    is ChatResult.Success -> {
                        conversationId = result.value._id
                        errorText = null
                    }
                    is ChatResult.Error -> {
                        attempt++
                        errorText = result.message
                        if (attempt < 5) delay(minOf(2000L * attempt, 10_000L))
                    }
                }
            }
            isConversationLoading = false
        }

        LaunchedEffect(conversationId) {
            val targetConversationId = conversationId ?: return@LaunchedEffect
            chatLocalStore.observeMessages(targetConversationId).collect { cached ->
                val mapped = cached.map { mapUiToMessageData(it) }
                val currentKeys = mapped.map { it.clientId ?: it.id }.toSet()
                val previousKeys = knownMessageKeys.value
                if (initialLoadComplete && previousKeys != null) {
                    val newKeys = currentKeys - previousKeys
                    if (newKeys.isNotEmpty()) {
                        mapped.forEach { msg ->
                            val key = msg.clientId ?: msg.id
                            if (key in newKeys && !msg.isMe) {
                                newMessageIds.value = newMessageIds.value + key
                                if (!isAtBottom) unreadCount++
                            }
                        }
                    }
                }
                knownMessageKeys.value = currentKeys
                messages.clear()
                messages.addAll(mapped)
            }
        }

        // Give the initial cache emission + backend sync time to settle before
        // treating any new arrivals as live (animatable) messages.
        LaunchedEffect(conversationId) {
            conversationId ?: return@LaunchedEffect
            initialLoadComplete = false
            delay(1500)
            initialLoadComplete = true
        }

        LaunchedEffect(conversationId, userName) {
            val targetConversationId = conversationId ?: return@LaunchedEffect
            currentPage = 1
            hasMoreMessages = true
            when (val messagesResult = chatRepository.getMessages(targetConversationId)) {
                is ChatResult.Error -> {
                    errorText = messagesResult.message
                }
                is ChatResult.Success -> {
                    chatLocalStore.saveBackendMessages(targetConversationId, messagesResult.value)
                    if (messagesResult.value.size < 50) hasMoreMessages = false
                    syncMissingEvents(targetConversationId)
                    errorText = null
                }
            }
        }

        LaunchedEffect(conversationId) {
            val targetConversationId = conversationId ?: return@LaunchedEffect
            when (val result = chatRepository.getConversation(targetConversationId)) {
                is ChatResult.Success -> pinnedMessage = result.value.pinnedMessage
                is ChatResult.Error -> Unit
            }
        }

        LaunchedEffect(conversationId) {
            val targetConversationId = conversationId ?: return@LaunchedEffect
            ChatSocketManager.ensureConnected()
            ChatSocketManager.joinConversation(targetConversationId)
            try {
                ChatSocketManager.events.collect { event ->
                    when (event) {
                        is ChatSocketEvent.NewMessage -> {
                            if (event.conversationId == targetConversationId) {
                                chatLocalStore.upsertIncomingSocketMessage(
                                    conversationId = event.conversationId,
                                    backendId = event.backendId,
                                    clientId = event.clientId,
                                    senderId = event.senderId,
                                    senderName = event.senderName,
                                    text = event.text,
                                    createdAtMillis = event.createdAtMillis,
                                    read = event.read,
                                    serverSequence = event.serverSequence,
                                    replyTo = event.replyTo,
                                    messageType = event.messageType,
                                    media = event.media,
                                    editedAt = event.editedAt,
                                    forwardedFromSenderId = event.forwardedFromSenderId
                                )
                            }
                        }

                        is ChatSocketEvent.MessageEdited -> {
                            if (event.conversationId == null || event.conversationId == targetConversationId) {
                                chatLocalStore.applyEditedMessage(targetConversationId, event.messageId, event.text, event.editedAt)
                            }
                        }

                        is ChatSocketEvent.MessageSeen -> {
                            if (event.conversationId == null || event.conversationId == targetConversationId) {
                                chatLocalStore.markMessageReadByBackendId(event.messageId)
                            }
                        }

                        is ChatSocketEvent.MessageDeleted -> {
                            if (event.conversationId == null || event.conversationId == targetConversationId) {
                                chatLocalStore.deleteMessageForMe(targetConversationId, event.messageId, clientId = null)
                            }
                        }

                        is ChatSocketEvent.MessageDeletedForEveryone -> {
                            if (event.conversationId == null || event.conversationId == targetConversationId) {
                                chatLocalStore.markDeletedForEveryone(targetConversationId, event.messageId)
                            }
                        }

                        is ChatSocketEvent.ReactionUpdated -> {
                            if (event.conversationId == null || event.conversationId == targetConversationId) {
                                chatLocalStore.updateReactions(targetConversationId, event.messageId, event.reactions)
                            }
                        }

                        is ChatSocketEvent.ConversationPinned -> {
                            if (event.conversationId == targetConversationId) {
                                pinnedMessage = event.pinnedMessage
                            }
                        }

                        is ChatSocketEvent.ConversationUnpinned -> {
                            if (event.conversationId == targetConversationId) {
                                pinnedMessage = null
                            }
                        }

                        is ChatSocketEvent.Reconnected -> {
                            val now = System.currentTimeMillis()
                            if (now - lastReconnectSyncAtMillis > 1500L) {
                                lastReconnectSyncAtMillis = now
                                syncMissingEvents(targetConversationId)
                            }
                        }

                        is ChatSocketEvent.Typing -> {
                            if (event.conversationId == targetConversationId) {
                                lastTypingEventAtMillis = System.currentTimeMillis()
                                isTyping = event.isTyping
                            }
                        }

                        else -> {
                            // no-op for unknown events in this phase
                        }
                    }
                }
            } finally {
                ChatSocketManager.leaveConversation(targetConversationId)
            }
        }

        LaunchedEffect(conversationId, messages.size) {
            val targetConversationId = conversationId ?: return@LaunchedEffect
            val now = System.currentTimeMillis()
            if (now - lastSeenSyncAtMillis < 2_000L) return@LaunchedEffect

            val candidateIds = chatLocalStore.getCandidateMessageIdsForSeen(targetConversationId, limit = 5)
            if (candidateIds.isEmpty()) return@LaunchedEffect

            lastSeenSyncAtMillis = now
            candidateIds.forEach { messageId ->
                when (chatRepository.markSeen(messageId)) {
                    is ChatResult.Success -> chatLocalStore.markMessageReadByBackendId(messageId)
                    is ChatResult.Error -> Unit
                }
            }
        }

        // --- PAGINATION: load older messages when the user scrolls near the top ---
        val shouldLoadMore by remember {
            derivedStateOf {
                val lastVisible = listState.layoutInfo.visibleItemsInfo.lastOrNull()?.index ?: -1
                messages.isNotEmpty() && lastVisible >= messages.size - 5
            }
        }

        LaunchedEffect(shouldLoadMore, hasMoreMessages, conversationId) {
            val targetConversationId = conversationId ?: return@LaunchedEffect
            if (!shouldLoadMore || !hasMoreMessages || isLoadingMore || isConversationLoading) return@LaunchedEffect
            isLoadingMore = true
            val nextPage = currentPage + 1
            when (val result = chatRepository.getMessagesPage(targetConversationId, nextPage)) {
                is ChatResult.Success -> {
                    if (result.value.isEmpty()) {
                        hasMoreMessages = false
                    } else {
                        chatLocalStore.saveBackendMessages(targetConversationId, result.value)
                        currentPage = nextPage
                        if (result.value.size < 50) hasMoreMessages = false
                    }
                }
                is ChatResult.Error -> Unit
            }
            isLoadingMore = false
        }
    }

    val scrollToStart = suspend {
        if (messages.isNotEmpty()) {
            delay(100)
            listState.animateScrollToItem(0)
        }
    }

    // A confirmed backend id never contains ":" (local stable ids look like
    // "client:<uuid>" or "time:<millis>" when the message hasn't been synced yet).
    fun backendIdOrNull(message: MessageData): String? = message.id.takeUnless { it.contains(":") }

    val toggleHeartReaction: (MessageData) -> Unit = { message ->
        val targetConversationId = conversationId
        val backendId = backendIdOrNull(message)
        if (targetConversationId != null && backendId != null) {
            val alreadyMine = message.reactions.any { it.emoji == "❤️" && it.mine }
            scope.launch {
                val result = if (alreadyMine) {
                    chatRepository.removeReaction(backendId)
                } else {
                    chatRepository.setReaction(backendId, "❤️")
                }
                when (result) {
                    is ChatResult.Success -> chatLocalStore.updateReactions(targetConversationId, backendId, result.value.reactions)
                    is ChatResult.Error -> errorText = result.message
                }
            }
        }
    }

    val deleteMessage: (MessageData, String) -> Unit = { message, scopeName ->
        val targetConversationId = conversationId
        val key = message.clientId ?: message.id
        if (targetConversationId != null) {
            pendingDeletionIds.value = pendingDeletionIds.value + key
            scope.launch {
                delay(220)
                val backendId = backendIdOrNull(message)
                if (scopeName == "everyone") {
                    if (backendId != null) {
                        when (val result = chatRepository.deleteMessage(backendId, "everyone")) {
                            is ChatResult.Success -> chatLocalStore.markDeletedForEveryone(targetConversationId, backendId)
                            is ChatResult.Error -> errorText = result.message
                        }
                    }
                } else {
                    if (backendId != null) {
                        chatRepository.deleteMessage(backendId, "self")
                    }
                    chatLocalStore.deleteMessageForMe(targetConversationId, backendId.orEmpty(), message.clientId)
                }
                pendingDeletionIds.value = pendingDeletionIds.value - key
            }
        }
    }

    val togglePin: (MessageData) -> Unit = { message ->
        val targetConversationId = conversationId
        val backendId = backendIdOrNull(message)
        if (targetConversationId != null && backendId != null) {
            scope.launch {
                val result = if (pinnedMessage?.id == backendId) {
                    chatRepository.unpinMessage(targetConversationId)
                } else {
                    chatRepository.pinMessage(targetConversationId, backendId)
                }
                when (result) {
                    is ChatResult.Success -> pinnedMessage = result.value.pinnedMessage
                    is ChatResult.Error -> errorText = result.message
                }
            }
        }
    }

    val unpinCurrent: () -> Unit = {
        val targetConversationId = conversationId
        if (targetConversationId != null) {
            scope.launch {
                when (val result = chatRepository.unpinMessage(targetConversationId)) {
                    is ChatResult.Success -> pinnedMessage = result.value.pinnedMessage
                    is ChatResult.Error -> errorText = result.message
                }
            }
        }
    }

    // --- SEARCH: jump to a message, loading older pages until it is in view ---
    val jumpToMessage: (UiChatMessage) -> Unit = { target ->
        val targetConversationId = conversationId
        if (targetConversationId != null && !isJumpingToMessage) {
            scope.launch {
                isJumpingToMessage = true
                try {
                    var index = messages.indexOfFirst { it.id == target.id }
                    var attempts = 0
                    while (index < 0 && hasMoreMessages && attempts < 20) {
                        val nextPage = currentPage + 1
                        when (val result = chatRepository.getMessagesPage(targetConversationId, nextPage)) {
                            is ChatResult.Success -> {
                                if (result.value.isEmpty()) {
                                    hasMoreMessages = false
                                } else {
                                    chatLocalStore.saveBackendMessages(targetConversationId, result.value)
                                    currentPage = nextPage
                                    if (result.value.size < 50) hasMoreMessages = false
                                }
                            }
                            is ChatResult.Error -> hasMoreMessages = false
                        }
                        delay(80)
                        index = messages.indexOfFirst { it.id == target.id }
                        attempts++
                    }

                    showSearchOverlay = false

                    if (index >= 0) {
                        val key = messages[index].clientId ?: messages[index].id
                        delay(150)
                        listState.animateScrollToItem(index)
                        highlightedMessageKey = key
                        delay(1600)
                        if (highlightedMessageKey == key) highlightedMessageKey = null
                    } else {
                        errorText = "Xabar topilmadi."
                    }
                } finally {
                    isJumpingToMessage = false
                }
            }
        }
    }

    Box(modifier = Modifier.fillMaxSize().background(backgroundColor)) {
        Image(
            painter = backgroundImage,
            contentDescription = null,
            modifier = Modifier.fillMaxSize(),
            contentScale = ContentScale.Crop
        )

        if (isDarkMode) {
            Box(modifier = Modifier.fillMaxSize().background(Color.Black.copy(alpha = 0.3f)))
        }

        Column(modifier = Modifier.fillMaxSize()) {
            Box(modifier = Modifier.fillMaxWidth().weight(1f)) {
                // --- MESSAGES LIST ---
                val density = LocalDensity.current
                val maxSwipePx = with(density) { 64.dp.toPx() }
                val replyThresholdPx = with(density) { 48.dp.toPx() }

                LazyColumn(
                    state = listState,
                    modifier = Modifier.fillMaxSize(),
                    reverseLayout = true,
                    contentPadding = PaddingValues(start = 12.dp, end = 12.dp, top = headerHeight, bottom = 12.dp)
                ) {
                    itemsIndexed(messages, key = { _, msg -> msg.clientId ?: msg.id }) { index, message ->
                        val prevMsg = if (index > 0) messages[index - 1] else null
                        val nextMsg = if (index < messages.size - 1) messages[index + 1] else null
                        val isLastInGroup = prevMsg == null || prevMsg.isMe != message.isMe
                        val isFirstInGroup = nextMsg == null || nextMsg.isMe != message.isMe
                        val showDateHeader = nextMsg == null || !isSameDay(message.timestamp, nextMsg.timestamp)

                        val stableKey = message.clientId ?: message.id
                        val isNewMessage = newMessageIds.value.contains(stableKey)
                        val isPendingDeletion = pendingDeletionIds.value.contains(stableKey)
                        var bubbleVisible by remember(stableKey) { mutableStateOf(!isNewMessage) }

                        LaunchedEffect(stableKey) {
                            if (isNewMessage) {
                                bubbleVisible = true
                                delay(700)
                                newMessageIds.value = newMessageIds.value - stableKey
                            }
                        }

                        LaunchedEffect(isPendingDeletion) {
                            if (isPendingDeletion) bubbleVisible = false
                        }

                        val swipeOffsetX = remember(stableKey) { Animatable(0f) }
                        val swipeProgress = (swipeOffsetX.value / replyThresholdPx).coerceIn(0f, 1f)

                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .animateItem(
                                    fadeInSpec = null,
                                    placementSpec = spring(dampingRatio = 0.82f, stiffness = 480f)
                                )
                        ) {
                            AnimatedVisibility(
                                visible = bubbleVisible,
                                enter = slideInVertically(
                                    animationSpec = spring(dampingRatio = 0.85f, stiffness = 500f),
                                    initialOffsetY = { it }
                                ) + scaleIn(
                                    animationSpec = spring(dampingRatio = 0.85f, stiffness = 500f),
                                    initialScale = 0.85f,
                                    transformOrigin = TransformOrigin(if (message.isMe) 1f else 0f, 1f)
                                ) + fadeIn(tween(180, easing = FastOutSlowInEasing))
                            ) {
                                Column(modifier = Modifier.fillMaxWidth()) {
                                    if (showDateHeader) {
                                        DateHeader(message.timestamp, isDarkMode)
                                    }
                                    Box(modifier = Modifier.fillMaxWidth()) {
                                        if (!message.isDeleted) {
                                            Icon(
                                                imageVector = Icons.AutoMirrored.Filled.Reply,
                                                contentDescription = null,
                                                tint = accentBlue.copy(alpha = swipeProgress),
                                                modifier = Modifier
                                                    .align(Alignment.CenterStart)
                                                    .padding(start = 6.dp)
                                                    .size(20.dp)
                                                    .graphicsLayer {
                                                        scaleX = 0.6f + 0.4f * swipeProgress
                                                        scaleY = 0.6f + 0.4f * swipeProgress
                                                        alpha = swipeProgress
                                                    }
                                            )
                                        }

                                        Column(
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .offset { IntOffset(swipeOffsetX.value.roundToInt(), 0) }
                                                .then(
                                                    if (!message.isDeleted) {
                                                        Modifier.pointerInput(stableKey) {
                                                            detectHorizontalDragGestures(
                                                                onDragEnd = {
                                                                    val triggered = swipeOffsetX.value >= replyThresholdPx
                                                                    if (triggered) {
                                                                        haptic.performHapticFeedback(HapticFeedbackType.LongPress)
                                                                        replyingTo = UiReplyPreview(
                                                                            id = backendIdOrNull(message) ?: message.id,
                                                                            text = message.text,
                                                                            senderName = if (message.isMe) "Siz" else userName,
                                                                            mine = message.isMe
                                                                        )
                                                                    }
                                                                    scope.launch {
                                                                        swipeOffsetX.animateTo(0f, spring(dampingRatio = 0.6f, stiffness = 380f))
                                                                    }
                                                                },
                                                                onDragCancel = {
                                                                    scope.launch {
                                                                        swipeOffsetX.animateTo(0f, spring(dampingRatio = 0.6f, stiffness = 380f))
                                                                    }
                                                                },
                                                                onHorizontalDrag = { change, dragAmount ->
                                                                    change.consume()
                                                                    val raw = (swipeOffsetX.value + dragAmount).coerceAtLeast(0f)
                                                                    val resisted = if (raw <= maxSwipePx) {
                                                                        raw
                                                                    } else {
                                                                        maxSwipePx + (raw - maxSwipePx) * 0.18f
                                                                    }
                                                                    scope.launch { swipeOffsetX.snapTo(resisted) }
                                                                }
                                                            )
                                                        }
                                                    } else {
                                                        Modifier
                                                    }
                                                )
                                        ) {
                                            MessageBubble(
                                                message = message,
                                                isDarkMode = isDarkMode,
                                                isFirstInGroup = isFirstInGroup,
                                                isLastInGroup = isLastInGroup,
                                                showHeartBurst = heartBurstIds.value.contains(stableKey),
                                                onHeartBurstEnd = {
                                                    heartBurstIds.value = heartBurstIds.value - stableKey
                                                },
                                                onLongPress = {
                                                    haptic.performHapticFeedback(HapticFeedbackType.LongPress)
                                                    contextMenuMessage = message
                                                },
                                                onDoubleTap = {
                                                    if (!message.isDeleted) {
                                                        heartBurstIds.value = heartBurstIds.value + stableKey
                                                        toggleHeartReaction(message)
                                                    }
                                                },
                                                onMediaClick = { media ->
                                                    if (media.url.startsWith("http")) {
                                                        if (media.type == "image") {
                                                            fullScreenImageUrl = media.url
                                                        } else {
                                                            runCatching {
                                                                context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(media.url)))
                                                            }
                                                        }
                                                    }
                                                },
                                                isHighlighted = highlightedMessageKey == stableKey
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }

                    item {
                        androidx.compose.animation.AnimatedVisibility(
                            visible = isLoadingMore,
                            enter = fadeIn(tween(150)),
                            exit = fadeOut(tween(150))
                        ) {
                            Box(
                                modifier = Modifier.fillMaxWidth().padding(vertical = 12.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                CircularProgressIndicator(
                                    modifier = Modifier.size(20.dp),
                                    strokeWidth = 2.dp,
                                    color = contentColor.copy(alpha = 0.5f)
                                )
                            }
                        }
                    }
                }

                // --- TOP AREA ---
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(headerHeight)
                        .background(
                            Brush.verticalGradient(
                                colors = listOf(
                                    glassBg.copy(alpha = 0.97f),
                                    glassBg.copy(alpha = 0.88f),
                                    glassBg.copy(alpha = 0.52f),
                                    Color.Transparent
                                )
                            )
                        )
                )

                // --- HEADER OVERLAY ---
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .statusBarsPadding()
                        .padding(horizontal = 16.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    HeaderPillButton(onClick = onBack, isDarkMode = isDarkMode) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, null, tint = contentColor, modifier = Modifier.size(24.dp))
                    }

                    Surface(
                        modifier = Modifier
                            .wrapContentWidth()
                            .height(48.dp)
                            .clickable(
                                interactionSource = remember { MutableInteractionSource() },
                                indication = null
                            ) { 
                                keyboardController?.hide()
                                showChatInfo = true 
                            },
                        shape = RoundedCornerShape(24.dp),
                        color = pillBg,
                        border = BorderStroke(0.5.dp, glassBorder)
                    ) {
                        Column(
                            modifier = Modifier.padding(horizontal = 24.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.Center
                        ) {
                            Text(text = userName, color = contentColor, fontWeight = FontWeight.Bold, fontSize = 16.sp, lineHeight = 16.sp)
                            if (!isRequest) {
                                AnimatedContent(
                                    targetState = when {
                                        isConversationLoading -> "loading"
                                        isTyping -> "typing"
                                        else -> "online"
                                    },
                                    transitionSpec = { fadeIn(tween(180)) togetherWith fadeOut(tween(140)) },
                                    label = "status"
                                ) { state ->
                                    when (state) {
                                        "loading" -> Row(
                                            verticalAlignment = Alignment.CenterVertically,
                                            horizontalArrangement = Arrangement.spacedBy(4.dp)
                                        ) {
                                            CircularProgressIndicator(
                                                modifier = Modifier.size(9.dp),
                                                strokeWidth = 1.5.dp,
                                                color = contentColor.copy(0.5f)
                                            )
                                            Text(text = "ulanmoqda...", color = contentColor.copy(0.5f), fontSize = 11.sp)
                                        }
                                        "typing" -> Row(
                                            verticalAlignment = Alignment.CenterVertically,
                                            horizontalArrangement = Arrangement.spacedBy(4.dp)
                                        ) {
                                            Text(text = "yozmoqda", color = Color(0xFF3478F6), fontSize = 11.sp, fontWeight = FontWeight.Medium)
                                            TypingIndicatorDots(color = Color(0xFF3478F6))
                                        }
                                        else -> Text(text = "online", color = Color(0xFF3478F6), fontSize = 11.sp, fontWeight = FontWeight.Medium)
                                    }
                                }
                            }
                        }
                    }

                    Row(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        if (!isRequest) {
                            HeaderPillButton(
                                onClick = {
                                    keyboardController?.hide()
                                    showSearchOverlay = true
                                },
                                isDarkMode = isDarkMode
                            ) {
                                Icon(Icons.Default.Search, null, tint = contentColor.copy(0.4f), modifier = Modifier.size(22.dp))
                            }
                        }

                        Box(
                            modifier = Modifier
                                .size(44.dp)
                                .clip(CircleShape)
                                .background(pillBg)
                                .border(0.5.dp, glassBorder, CircleShape)
                                .clickable(
                                    interactionSource = remember { MutableInteractionSource() },
                                    indication = null
                                ) {
                                    keyboardController?.hide()
                                    showMemberProfile = true
                                },
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(Icons.Default.Person, null, tint = contentColor.copy(0.4f), modifier = Modifier.size(24.dp))
                        }
                    }
                }

                // --- PINNED MESSAGE BANNER ---
                androidx.compose.animation.AnimatedVisibility(
                    visible = pinnedMessage != null,
                    modifier = Modifier
                        .align(Alignment.TopCenter)
                        .padding(top = headerHeight),
                    enter = expandVertically(animationSpec = spring(dampingRatio = 0.85f, stiffness = 420f)) + fadeIn(tween(200)),
                    exit = shrinkVertically(animationSpec = tween(180, easing = FastOutSlowInEasing)) + fadeOut(tween(140))
                ) {
                    pinnedMessage?.let { pm ->
                        PinnedMessageBanner(
                            pinnedMessage = pm,
                            isDarkMode = isDarkMode,
                            accentBlue = accentBlue,
                            glassBg = glassBg,
                            glassBorder = glassBorder,
                            onUnpin = unpinCurrent
                        )
                    }
                }

                // --- SCROLL TO BOTTOM FAB ---
                if (!isRequest) {
                    androidx.compose.animation.AnimatedVisibility(
                        visible = !isAtBottom && messages.isNotEmpty(),
                        modifier = Modifier
                            .align(Alignment.BottomEnd)
                            .padding(end = 12.dp, bottom = 12.dp),
                        enter = scaleIn(spring(dampingRatio = Spring.DampingRatioMediumBouncy, stiffness = Spring.StiffnessMedium)) + fadeIn(tween(150)),
                        exit = scaleOut(tween(120, easing = FastOutSlowInEasing)) + fadeOut(tween(120))
                    ) {
                        BadgedBox(
                            badge = {
                                if (unreadCount > 0) {
                                    Badge(containerColor = accentBlue, contentColor = Color.White) {
                                        Text(text = if (unreadCount > 9) "9+" else unreadCount.toString())
                                    }
                                }
                            }
                        ) {
                            FloatingActionButton(
                                onClick = {
                                    scope.launch {
                                        listState.animateScrollToItem(0)
                                        unreadCount = 0
                                    }
                                },
                                modifier = Modifier
                                    .size(44.dp)
                                    .border(0.5.dp, glassBorder, CircleShape),
                                containerColor = pillBg,
                                contentColor = contentColor,
                                elevation = FloatingActionButtonDefaults.elevation(defaultElevation = 2.dp)
                            ) {
                                Icon(Icons.Default.KeyboardArrowDown, contentDescription = null, modifier = Modifier.size(22.dp))
                            }
                        }
                    }
                }
            }

            // --- BOTTOM AREA ---
            AnimatedVisibility(visible = !isRequest && !errorText.isNullOrBlank()) {
                Text(
                    text = errorText.orEmpty(),
                    color = if (isDarkMode) Color(0xFFFFB4AB) else Color(0xFFB3261E),
                    fontSize = 12.sp,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp)
                )
            }
            if (isRequest) {
                RequestActionButtons(isDarkMode, onBack)
            } else {
                val canSendNow = !isConversationLoading &&
                    conversationId != null &&
                    System.currentTimeMillis() >= sendBlockedUntilMillis

                val sendMediaFromUri: (Uri) -> Unit = { uri ->
                    val targetConversationId = conversationId
                    if (!isConversationLoading && !targetConversationId.isNullOrBlank()) {
                        isMenuOpen = false
                        val replySnapshot = replyingTo
                        replyingTo = null
                        scope.launch {
                            val picked = withContext(Dispatchers.IO) { pickedMediaFromUri(context, uri) }
                            if (picked == null) {
                                errorText = "Faylni o'qib bo'lmadi."
                                return@launch
                            }
                            val mediaMessageType = messageTypeForMime(picked.mimeType)
                            val clientId = "android:${UUID.randomUUID()}"
                            val now = System.currentTimeMillis()
                            val media = UiMedia(
                                url = picked.file.toURI().toString(),
                                type = mediaMessageType,
                                fileName = picked.fileName,
                                fileSize = picked.fileSize,
                                mimeType = picked.mimeType,
                                durationSeconds = null
                            )
                            newMessageIds.value = newMessageIds.value + clientId
                            chatLocalStore.saveOptimisticMessage(
                                conversationId = targetConversationId,
                                clientId = clientId,
                                senderId = "me",
                                text = "",
                                nowMillis = now,
                                replyTo = replySnapshot,
                                messageType = mediaMessageType,
                                media = media
                            )
                            scrollToStart()

                            when (val result = chatRepository.sendMediaMessage(
                                conversationId = targetConversationId,
                                file = picked.file,
                                mimeType = picked.mimeType,
                                messageType = mediaMessageType,
                                text = null,
                                clientId = clientId,
                                replyToMessageId = replySnapshot?.id
                            )) {
                                is ChatResult.Success -> {
                                    chatLocalStore.replaceOptimisticWithServer(
                                        conversationId = targetConversationId,
                                        clientId = clientId,
                                        serverMessage = result.value,
                                        senderId = "me"
                                    )
                                    errorText = null
                                }
                                is ChatResult.Error -> {
                                    chatLocalStore.markFailed(targetConversationId, clientId)
                                    errorText = result.message
                                }
                            }
                        }
                    }
                }

                val pickGalleryLauncher = rememberLauncherForActivityResult(
                    contract = ActivityResultContracts.PickVisualMedia()
                ) { uri -> uri?.let(sendMediaFromUri) }

                val pickFileLauncher = rememberLauncherForActivityResult(
                    contract = ActivityResultContracts.GetContent()
                ) { uri -> uri?.let(sendMediaFromUri) }

                val pickAudioLauncher = rememberLauncherForActivityResult(
                    contract = ActivityResultContracts.GetContent()
                ) { uri -> uri?.let(sendMediaFromUri) }

                val sendTextMessage: () -> Unit = sendBlock@{
                    val targetConversationId = conversationId
                    val trimmedText = messageText.trim()
                    if (trimmedText.isBlank()) return@sendBlock
                    if (isConversationLoading) {
                        errorText = "Ulanmoqda, biroz kutib turing..."
                        return@sendBlock
                    }
                    if (targetConversationId.isNullOrBlank()) {
                        errorText = "Chat hali tayyor emas. Sahifani yoping va qayta oching."
                        return@sendBlock
                    }
                    if (System.currentTimeMillis() < sendBlockedUntilMillis) {
                        errorText = "Iltimos, biroz kutib turing."
                        return@sendBlock
                    }

                    val editingSnapshot = editingMessage
                    if (editingSnapshot != null) {
                        val editBackendId = backendIdOrNull(editingSnapshot)
                        if (editBackendId == null) {
                            errorText = "Bu xabarni tahrirlab bo'lmaydi."
                            editingMessage = null
                            messageText = ""
                            return@sendBlock
                        }
                        editingMessage = null
                        messageText = ""
                        isMenuOpen = false
                        scope.launch {
                            when (val result = chatRepository.editMessage(editBackendId, trimmedText)) {
                                is ChatResult.Success -> {
                                    chatLocalStore.applyEditedMessage(
                                        conversationId = targetConversationId,
                                        messageId = editBackendId,
                                        text = result.value.text,
                                        editedAtMillis = result.value.editedAt ?: System.currentTimeMillis()
                                    )
                                    errorText = null
                                }
                                is ChatResult.Error -> {
                                    errorText = result.message
                                }
                            }
                        }
                        return@sendBlock
                    }

                    val clientId = "android:${UUID.randomUUID()}"
                    val replySnapshot = replyingTo
                    newMessageIds.value = newMessageIds.value + clientId
                    messageText = ""
                    replyingTo = null
                    isMenuOpen = false
                    scope.launch { scrollToStart() }

                    if (typingActive) {
                        ChatSocketManager.setTyping(targetConversationId, false)
                        typingActive = false
                    }

                    scope.launch {
                        val now = System.currentTimeMillis()
                        chatLocalStore.saveOptimisticMessage(
                            conversationId = targetConversationId,
                            clientId = clientId,
                            senderId = "me",
                            text = trimmedText,
                            nowMillis = now,
                            replyTo = replySnapshot
                        )

                        when (val sendResult = chatRepository.sendTextMessage(targetConversationId, trimmedText, clientId, replyToMessageId = replySnapshot?.id)) {
                            is ChatResult.Success -> {
                                chatLocalStore.replaceOptimisticWithServer(
                                    conversationId = targetConversationId,
                                    clientId = clientId,
                                    serverMessage = sendResult.value,
                                    senderId = "me"
                                )
                                errorText = null
                            }

                            is ChatResult.Error -> {
                                chatLocalStore.markFailed(targetConversationId, clientId)
                                when (ChatFailureClassifier.classify(sendResult)) {
                                    ChatFailureType.RETRYABLE -> {
                                        val nowMs = System.currentTimeMillis()
                                        val retryAfterSec = max(1L, sendResult.retryAfterSeconds ?: 10L)
                                        sendBlockedUntilMillis = nowMs + retryAfterSec * 1000L
                                        pendingDao.insertOrReplace(
                                            ChatPendingMessageEntity(
                                                localId = "pending:$clientId",
                                                conversationId = targetConversationId,
                                                clientId = clientId,
                                                text = trimmedText,
                                                status = ChatPendingStatus.PENDING,
                                                retryCount = 0,
                                                nextAttemptAt = nowMs + retryAfterSec * 1000L,
                                                lastError = sendResult.message,
                                                createdAt = nowMs,
                                                updatedAt = nowMs
                                            )
                                        )
                                        ChatOutboxScheduler.schedule(context)
                                        errorText = "Queued for retry: ${sendResult.message}"
                                    }
                                    ChatFailureType.TERMINAL -> {
                                        errorText = sendResult.message
                                    }
                                }
                            }
                        }
                    }
                }

                val sendVoiceMessage: (File, Int) -> Unit = { file, durationSeconds ->
                    val targetConversationId = conversationId
                    if (!isConversationLoading && !targetConversationId.isNullOrBlank()) {
                        val replySnapshot = replyingTo
                        replyingTo = null
                        scope.launch {
                            val mimeType = "audio/mp4"
                            val clientId = "android:${UUID.randomUUID()}"
                            val now = System.currentTimeMillis()
                            val media = UiMedia(
                                url = file.toURI().toString(),
                                type = "voice",
                                fileName = file.name,
                                fileSize = file.length(),
                                mimeType = mimeType,
                                durationSeconds = durationSeconds
                            )
                            newMessageIds.value = newMessageIds.value + clientId
                            chatLocalStore.saveOptimisticMessage(
                                conversationId = targetConversationId,
                                clientId = clientId,
                                senderId = "me",
                                text = "",
                                nowMillis = now,
                                replyTo = replySnapshot,
                                messageType = "voice",
                                media = media
                            )
                            scrollToStart()

                            when (val result = chatRepository.sendMediaMessage(
                                conversationId = targetConversationId,
                                file = file,
                                mimeType = mimeType,
                                messageType = "voice",
                                text = null,
                                clientId = clientId,
                                replyToMessageId = replySnapshot?.id
                            )) {
                                is ChatResult.Success -> {
                                    chatLocalStore.replaceOptimisticWithServer(
                                        conversationId = targetConversationId,
                                        clientId = clientId,
                                        serverMessage = result.value,
                                        senderId = "me"
                                    )
                                    errorText = null
                                }
                                is ChatResult.Error -> {
                                    chatLocalStore.markFailed(targetConversationId, clientId)
                                    errorText = result.message
                                }
                            }
                        }
                    } else {
                        file.delete()
                    }
                }

                val finishRecording: (Boolean) -> Unit = { send ->
                    val wasRecording = isRecording
                    val duration = recordSeconds
                    val file = recordingFile
                    val recorder = mediaRecorder
                    isRecording = false
                    isLocked = false
                    recordDragY = 0f
                    flashOn = false
                    mediaRecorder = null
                    recordingFile = null
                    if (recorder != null) {
                        try {
                            recorder.stop()
                        } catch (_: Exception) {
                        }
                        recorder.release()
                    }
                    if (wasRecording && send && duration > 0 && file != null) {
                        haptic.performHapticFeedback(HapticFeedbackType.LongPress)
                        sendVoiceMessage(file, duration)
                    } else {
                        file?.delete()
                    }
                }

                val startVoiceRecording: () -> Unit = {
                    if (!hasAudioPermission) {
                        audioPermissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
                    } else {
                        try {
                            val file = File(context.cacheDir, "voice_${System.currentTimeMillis()}.m4a")
                            val recorder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                                MediaRecorder(context)
                            } else {
                                @Suppress("DEPRECATION")
                                MediaRecorder()
                            }
                            recorder.setAudioSource(MediaRecorder.AudioSource.MIC)
                            recorder.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
                            recorder.setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
                            recorder.setOutputFile(file.absolutePath)
                            recorder.prepare()
                            recorder.start()
                            mediaRecorder = recorder
                            recordingFile = file
                            isRecording = true
                            recordDragY = 0f
                            haptic.performHapticFeedback(HapticFeedbackType.LongPress)
                        } catch (ex: Exception) {
                            errorText = "Ovoz yozishni boshlab bo'lmadi."
                        }
                    }
                }

                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .navigationBarsPadding()
                        .imePadding()
                ) {
                    AnimatedVisibility(
                        visible = replyingTo != null,
                        enter = expandVertically(animationSpec = spring(dampingRatio = 0.85f, stiffness = 500f)) + fadeIn(tween(180)),
                        exit = shrinkVertically(animationSpec = tween(180, easing = FastOutSlowInEasing)) + fadeOut(tween(120))
                    ) {
                        replyingTo?.let { reply ->
                            ReplyPreviewBar(
                                reply = reply,
                                isDarkMode = isDarkMode,
                                accentBlue = accentBlue,
                                onCancel = { replyingTo = null }
                            )
                        }
                    }

                    AnimatedVisibility(
                        visible = editingMessage != null,
                        enter = expandVertically(animationSpec = spring(dampingRatio = 0.85f, stiffness = 500f)) + fadeIn(tween(180)),
                        exit = shrinkVertically(animationSpec = tween(180, easing = FastOutSlowInEasing)) + fadeOut(tween(120))
                    ) {
                        editingMessage?.let { editing ->
                            EditPreviewBar(
                                text = editing.text,
                                isDarkMode = isDarkMode,
                                accentBlue = accentBlue,
                                onCancel = {
                                    editingMessage = null
                                    messageText = ""
                                }
                            )
                        }
                    }

                    val lockProgress = ((-recordDragY) / 140f).coerceIn(0f, 1f)
                    AnimatedVisibility(
                        visible = isRecording && !isLocked,
                        enter = fadeIn(tween(180, easing = FastOutSlowInEasing)) +
                            slideInVertically(tween(220, easing = FastOutSlowInEasing)) { it / 2 },
                        exit = fadeOut(tween(160, easing = FastOutSlowInEasing)) +
                            slideOutVertically(tween(180, easing = FastOutSlowInEasing)) { it / 2 }
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(end = 18.dp, bottom = 6.dp),
                            horizontalArrangement = Arrangement.End
                        ) {
                            LockHintChip(
                                progress = lockProgress,
                                isDarkMode = isDarkMode,
                                accentBlue = accentBlue
                            )
                        }
                    }

                    Row(
                        modifier = Modifier
                            .padding(horizontal = 8.dp, vertical = 6.dp)
                            .fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .animateContentSize(animationSpec = spring(dampingRatio = 0.85f, stiffness = 500f))
                                .clip(RoundedCornerShape(22.dp))
                                .background(if (isDarkMode) Color.White.copy(alpha = 0.12f) else Color.White.copy(alpha = 0.92f))
                                .border(0.5.dp, glassBorder, RoundedCornerShape(22.dp))
                        ) {
                            AnimatedContent(
                                targetState = when {
                                    isLocked -> InputBarState.LOCKED
                                    isRecording -> InputBarState.RECORDING
                                    else -> InputBarState.IDLE
                                },
                                transitionSpec = {
                                    (fadeIn(tween(180, easing = FastOutSlowInEasing)) +
                                        slideInHorizontally(tween(220, easing = FastOutSlowInEasing)) { -it / 6 })
                                        .togetherWith(
                                            fadeOut(tween(140, easing = FastOutSlowInEasing)) +
                                                slideOutHorizontally(tween(180, easing = FastOutSlowInEasing)) { -it / 6 }
                                        )
                                },
                                label = "input_bar_state"
                            ) { state ->
                                when (state) {
                                    InputBarState.IDLE -> {
                                        Row(verticalAlignment = Alignment.CenterVertically) {
                                            IconButton(
                                                onClick = {
                                                    isMenuOpen = !isMenuOpen
                                                    if (isMenuOpen) scope.launch { scrollToStart() }
                                                },
                                                modifier = Modifier.size(40.dp)
                                            ) {
                                                Icon(
                                                    if (isMenuOpen) Icons.Default.Close else Icons.Default.AttachFile,
                                                    null,
                                                    tint = contentColor.copy(0.55f),
                                                    modifier = Modifier.size(20.dp)
                                                )
                                            }

                                            Box(
                                                modifier = Modifier
                                                    .weight(1f)
                                                    .padding(vertical = 10.dp),
                                                contentAlignment = Alignment.CenterStart
                                            ) {
                                                if (isMenuOpen) {
                                                    AttachmentMenu(
                                                        contentColor = contentColor,
                                                        onPickGallery = {
                                                            pickGalleryLauncher.launch(
                                                                PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageAndVideo)
                                                            )
                                                        },
                                                        onPickFile = { pickFileLauncher.launch("*/*") },
                                                        onPickAudio = { pickAudioLauncher.launch("audio/*") }
                                                    )
                                                } else {
                                                    val inputTextStyle = TextStyle(color = contentColor, fontSize = 15.sp, lineHeight = 20.sp, fontFamily = IosEmojiFont)
                                                    if (messageText.isEmpty()) {
                                                        Text(text = "Xabar...", style = inputTextStyle.copy(color = contentColor.copy(0.45f)))
                                                    }
                                                    BasicTextField(
                                                        value = messageText,
                                                        onValueChange = {
                                                            messageText = it
                                                            scope.launch { scrollToStart() }
                                                            val targetConversationId = conversationId
                                                            if (!targetConversationId.isNullOrBlank()) {
                                                                if (it.isNotBlank()) {
                                                                    val now = System.currentTimeMillis()
                                                                    if (!typingActive || now - lastTypingEmitAtMillis > 2500L) {
                                                                        ChatSocketManager.setTyping(targetConversationId, true)
                                                                        typingActive = true
                                                                        lastTypingEmitAtMillis = now
                                                                    }
                                                                } else if (typingActive) {
                                                                    ChatSocketManager.setTyping(targetConversationId, false)
                                                                    typingActive = false
                                                                }
                                                            }
                                                        },
                                                        modifier = Modifier.fillMaxWidth(),
                                                        textStyle = inputTextStyle,
                                                        cursorBrush = SolidColor(accentBlue),
                                                        maxLines = 4
                                                    )
                                                }
                                            }

                                            IconButton(
                                                onClick = { /* emoji picker hook */ },
                                                modifier = Modifier.size(40.dp)
                                            ) {
                                                Icon(
                                                    Icons.Default.SentimentSatisfiedAlt,
                                                    null,
                                                    tint = contentColor.copy(0.55f),
                                                    modifier = Modifier.size(20.dp)
                                                )
                                            }
                                        }
                                    }
                                    InputBarState.RECORDING -> {
                                        RecordingProgressBar(
                                            seconds = recordSeconds,
                                            dotAlpha = recDotAlpha,
                                            slideProgress = (-recordDragY / 120f).coerceIn(0f, 1f),
                                            contentColor = contentColor
                                        )
                                    }
                                    InputBarState.LOCKED -> {
                                        LockedRecordBar(
                                            seconds = recordSeconds,
                                            dotAlpha = recDotAlpha,
                                            mode = recordMode,
                                            flashOn = flashOn,
                                            onFlashToggle = { flashOn = !flashOn },
                                            onCancel = { finishRecording(false) },
                                            contentColor = contentColor
                                        )
                                    }
                                }
                            }
                        }

                        val hasText = messageText.isNotBlank()
                        val rightBtnTarget = when {
                            isRecording -> RightButtonState.RECORDING
                            hasText -> RightButtonState.SEND_TEXT
                            else -> RightButtonState.RECORD_IDLE
                        }

                        AnimatedContent(
                            targetState = rightBtnTarget,
                            transitionSpec = {
                                (scaleIn(spring(dampingRatio = 0.7f, stiffness = 600f), initialScale = 0.6f) + fadeIn(tween(180)))
                                    .togetherWith(scaleOut(tween(160, easing = FastOutSlowInEasing), targetScale = 0.6f) + fadeOut(tween(140)))
                            },
                            label = "right_btn_state"
                        ) { btnState ->
                            when (btnState) {
                                RightButtonState.SEND_TEXT -> {
                                    val sendScale = remember { Animatable(1f) }
                                    Box(
                                        modifier = Modifier
                                            .size(42.dp)
                                            .graphicsLayer {
                                                scaleX = sendScale.value
                                                scaleY = sendScale.value
                                            }
                                            .clip(CircleShape)
                                            .background(accentBlue)
                                            .pointerInput(sendTextMessage) {
                                                detectTapGestures(
                                                    onPress = {
                                                        scope.launch { sendScale.animateTo(0.85f, tween(80, easing = FastOutSlowInEasing)) }
                                                        tryAwaitRelease()
                                                        scope.launch {
                                                            sendScale.animateTo(
                                                                1f,
                                                                spring(Spring.DampingRatioMediumBouncy, Spring.StiffnessMedium)
                                                            )
                                                        }
                                                    },
                                                    onTap = { sendTextMessage() }
                                                )
                                            },
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Icon(Icons.Default.ArrowUpward, null, tint = Color.White, modifier = Modifier.size(20.dp))
                                    }
                                }
                                RightButtonState.RECORD_IDLE,
                                RightButtonState.RECORDING -> {
                                    RecordButton(
                                        mode = recordMode,
                                        isRecording = isRecording,
                                        waveScale = recordingWaveScale,
                                        accentBlue = accentBlue,
                                        onTap = {
                                            recordMode = if (recordMode == RecordMode.VOICE) RecordMode.VIDEO else RecordMode.VOICE
                                            haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                                        },
                                        onLongPress = {
                                            if (recordMode == RecordMode.VOICE) {
                                                startVoiceRecording()
                                            } else {
                                                isRecording = true
                                                recordDragY = 0f
                                                haptic.performHapticFeedback(HapticFeedbackType.LongPress)
                                            }
                                        },
                                        onDrag = { dy ->
                                            if (isRecording && !isLocked) {
                                                recordDragY += dy
                                                if (recordDragY < -140f) {
                                                    isLocked = true
                                                    haptic.performHapticFeedback(HapticFeedbackType.LongPress)
                                                }
                                            }
                                        },
                                        onRelease = {
                                            if (isRecording && !isLocked) {
                                                val keep = recordSeconds >= 1
                                                finishRecording(keep)
                                            }
                                        }
                                    )
                                }
                            }
                        }

                        AnimatedVisibility(
                            visible = isLocked,
                            enter = scaleIn(spring(dampingRatio = 0.7f, stiffness = 600f), initialScale = 0.6f) + fadeIn(tween(180)),
                            exit = scaleOut(tween(140, easing = FastOutSlowInEasing), targetScale = 0.6f) + fadeOut(tween(120))
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(42.dp)
                                    .clip(CircleShape)
                                    .background(accentBlue)
                                    .clickable { finishRecording(true) },
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(Icons.Default.ArrowUpward, null, tint = Color.White, modifier = Modifier.size(20.dp))
                            }
                        }
                    }
                }
            }
        }

        // --- OVERLAYS ---
        AnimatedVisibility(
            visible = showChatInfo,
            enter = slideInVertically(tween(320, easing = FastOutSlowInEasing)) { it } + fadeIn(tween(280, easing = FastOutSlowInEasing)),
            exit = slideOutVertically(tween(280, easing = FastOutSlowInEasing)) { it } + fadeOut(tween(240, easing = FastOutSlowInEasing))
        ) {
            ChatInfoScreen(
                userName = userName,
                isDarkMode = isDarkMode,
                onBack = { showChatInfo = false },
                onCall = { showVoiceCall = true },
                onVideoCall = { showVideoCall = true }
            )
        }

        AnimatedVisibility(
            visible = showMemberProfile,
            enter = slideInVertically(tween(320, easing = FastOutSlowInEasing)) { it } + fadeIn(tween(280, easing = FastOutSlowInEasing)),
            exit = slideOutVertically(tween(280, easing = FastOutSlowInEasing)) { it } + fadeOut(tween(240, easing = FastOutSlowInEasing))
        ) {
            ProfileScreen(
                isDarkMode = isDarkMode,
                isRefreshing = isMemberProfileRefreshing,
                onRefresh = {
                    scope.launch {
                        isMemberProfileRefreshing = true
                        delay(1500)
                        isMemberProfileRefreshing = false
                    }
                },
                isMyProfile = false,
                onBack = { showMemberProfile = false }
            )
        }

        AnimatedVisibility(
            visible = showSearchOverlay,
            enter = slideInVertically(tween(320, easing = FastOutSlowInEasing)) { it } + fadeIn(tween(280, easing = FastOutSlowInEasing)),
            exit = slideOutVertically(tween(280, easing = FastOutSlowInEasing)) { it } + fadeOut(tween(240, easing = FastOutSlowInEasing))
        ) {
            MessageSearchOverlay(
                isDarkMode = isDarkMode,
                accentBlue = accentBlue,
                conversationId = conversationId,
                query = searchQuery,
                onQueryChange = { searchQuery = it },
                results = searchResults,
                isSearching = isSearching,
                onSearchingChange = { isSearching = it },
                onDismiss = { showSearchOverlay = false },
                onResultClick = jumpToMessage
            )
        }

        // --- CALL OVERLAYS ---
        if (showVoiceCall) {
            VoiceCallScreen(userName = userName, onHangUp = { showVoiceCall = false })
        }
        if (showVideoCall) {
            VideoCallScreen(userName = userName, onHangUp = { showVideoCall = false })
        }

        // --- MESSAGE CONTEXT MENU ---
        contextMenuMessage?.let { activeMessage ->
            val activeBackendId = backendIdOrNull(activeMessage)
            MessageContextMenuOverlay(
                message = activeMessage,
                isDarkMode = isDarkMode,
                isPinned = activeBackendId != null && pinnedMessage?.id == activeBackendId,
                canPin = activeBackendId != null,
                onDismiss = { contextMenuMessage = null },
                onCopy = { clipboardManager.setText(AnnotatedString(activeMessage.text)) },
                onReply = {
                    replyingTo = UiReplyPreview(
                        id = activeBackendId ?: activeMessage.id,
                        text = activeMessage.text,
                        senderName = if (activeMessage.isMe) "Siz" else userName,
                        mine = activeMessage.isMe
                    )
                },
                onTogglePin = { togglePin(activeMessage) },
                onDeleteForMe = { deleteMessage(activeMessage, "self") },
                onDeleteForEveryone = { deleteMessage(activeMessage, "everyone") },
                onEdit = {
                    editingMessage = activeMessage
                    messageText = activeMessage.text
                    replyingTo = null
                },
                onForward = { forwardingMessage = activeMessage }
            )
        }

        // --- FORWARD MESSAGE PICKER ---
        forwardingMessage?.let { activeForward ->
            ForwardPickerOverlay(
                isDarkMode = isDarkMode,
                onDismiss = { forwardingMessage = null },
                onSelect = { conversation ->
                    val sourceMessageId = backendIdOrNull(activeForward)
                    if (sourceMessageId != null) {
                        scope.launch {
                            when (val result = chatRepository.forwardMessage(conversation.id, sourceMessageId)) {
                                is ChatResult.Success -> {
                                    chatLocalStore.saveBackendMessages(conversation.id, listOf(result.value))
                                    errorText = null
                                }
                                is ChatResult.Error -> errorText = result.message
                            }
                        }
                    }
                    forwardingMessage = null
                }
            )
        }

        // --- FULL SCREEN IMAGE VIEWER ---
        fullScreenImageUrl?.let { url ->
            FullScreenImageViewer(
                url = url,
                onDismiss = { fullScreenImageUrl = null }
            )
        }
    }
}

@Composable
fun MessageBubble(
    message: MessageData,
    isDarkMode: Boolean,
    isFirstInGroup: Boolean = true,
    isLastInGroup: Boolean = true,
    showHeartBurst: Boolean = false,
    onHeartBurstEnd: () -> Unit = {},
    onLongPress: () -> Unit = {},
    onDoubleTap: () -> Unit = {},
    onMediaClick: (UiMedia) -> Unit = {},
    isHighlighted: Boolean = false
) {
    val alignment = if (message.isMe) Alignment.End else Alignment.Start
    val bubbleColor = when {
        message.isDeleted -> if (isDarkMode) Color(0xFF1C1C1E) else Color(0xFFE8E8EA)
        message.isMe -> PremiumBlue
        else -> if (isDarkMode) Color(0xFF262626) else Color(0xFFF0F2F0)
    }
    val highlightColor = if (isDarkMode) Color(0xFFFFD60A) else Color(0xFFFFE082)
    val animatedBubbleColor by animateColorAsState(
        targetValue = if (isHighlighted) highlightColor.copy(alpha = 0.6f) else bubbleColor,
        animationSpec = tween(400, easing = FastOutSlowInEasing),
        label = "bubble_highlight"
    )
    val textColor = when {
        message.isDeleted -> if (isDarkMode) Color.White.copy(alpha = 0.5f) else Color.Black.copy(alpha = 0.5f)
        message.isMe -> Color.White
        else -> if (isDarkMode) Color.White else Color.Black
    }

    val r = 18.dp
    val t = 4.dp
    val shape = when {
        message.isMe -> when {
            isLastInGroup -> RoundedCornerShape(r, r, t, r)
            isFirstInGroup -> RoundedCornerShape(r, t, r, r)
            else -> RoundedCornerShape(r, t, t, r)
        }
        else -> when {
            isLastInGroup -> RoundedCornerShape(r, r, r, t)
            isFirstInGroup -> RoundedCornerShape(t, r, r, r)
            else -> RoundedCornerShape(t, r, r, t)
        }
    }

    val bottomPad = if (isLastInGroup) 6.dp else 2.dp
    val timeFormat = remember { SimpleDateFormat("HH:mm", Locale.getDefault()) }
    val timeString = timeFormat.format(Date(message.timestamp))

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(bottom = bottomPad, top = 1.dp),
        horizontalAlignment = alignment
    ) {
        Box {
            Surface(
                color = animatedBubbleColor,
                shape = shape,
                modifier = Modifier
                    .widthIn(max = 280.dp)
                    .pointerInput(message.clientId, message.id) {
                        detectTapGestures(
                            onLongPress = { onLongPress() },
                            onDoubleTap = { onDoubleTap() }
                        )
                    }
            ) {
                Column(modifier = Modifier.padding(start = 12.dp, end = 12.dp, top = 8.dp, bottom = 6.dp)) {
                    if (message.isDeleted) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.Block,
                                contentDescription = null,
                                tint = textColor,
                                modifier = Modifier.size(14.dp)
                            )
                            Text(
                                text = "Bu xabar o'chirilgan",
                                color = textColor,
                                fontSize = 14.sp,
                                fontStyle = FontStyle.Italic
                            )
                        }
                    } else {
                        if (message.forwardedFromSenderId != null) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(4.dp),
                                modifier = Modifier.padding(bottom = 4.dp)
                            ) {
                                Icon(
                                    imageVector = Icons.AutoMirrored.Filled.Send,
                                    contentDescription = null,
                                    tint = textColor.copy(alpha = 0.6f),
                                    modifier = Modifier.size(12.dp)
                                )
                                Text(
                                    text = "Uzatilgan xabar",
                                    color = textColor.copy(alpha = 0.6f),
                                    fontSize = 11.sp,
                                    fontStyle = FontStyle.Italic
                                )
                            }
                        }
                        message.replyTo?.let { reply ->
                            ReplyQuoteBlock(reply = reply, textColor = textColor, isMe = message.isMe)
                        }
                        message.media?.let { media ->
                            val mediaModifier = if (message.text.isNotBlank()) {
                                Modifier.padding(bottom = 6.dp)
                            } else {
                                Modifier
                            }
                            Box(modifier = mediaModifier) {
                                when (message.messageType) {
                                    "image" -> MediaImageContent(media = media, onClick = { onMediaClick(media) })
                                    "video" -> MediaVideoContent(media = media, isDarkMode = isDarkMode, onClick = { onMediaClick(media) })
                                    "file" -> MediaFileContent(media = media, textColor = textColor, onClick = { onMediaClick(media) })
                                    "voice" -> MediaVoiceContent(media = media, textColor = textColor)
                                    else -> {}
                                }
                            }
                        }
                        if (message.text.isNotBlank()) {
                            Text(
                                text = message.text,
                                color = textColor,
                                fontSize = 15.sp,
                                lineHeight = 20.sp,
                                fontFamily = IosEmojiFont
                            )
                        }
                    }
                    Row(
                        modifier = Modifier
                            .align(Alignment.End)
                            .padding(top = 2.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(3.dp)
                    ) {
                        if (message.editedAt != null && !message.isDeleted) {
                            Text(
                                text = "tahrirlangan",
                                color = textColor.copy(alpha = 0.5f),
                                fontSize = 10.sp,
                                fontStyle = FontStyle.Italic
                            )
                        }
                        Text(text = timeString, color = textColor.copy(alpha = 0.5f), fontSize = 10.sp)
                        if (message.isMe) {
                            AnimatedContent(
                                targetState = message.status,
                                transitionSpec = {
                                    (fadeIn(tween(150, easing = FastOutSlowInEasing)) +
                                        scaleIn(tween(150, easing = FastOutSlowInEasing), initialScale = 0.6f))
                                        .togetherWith(
                                            fadeOut(tween(100)) + scaleOut(tween(100), targetScale = 0.6f)
                                        )
                                },
                                label = "msg_status"
                            ) { status ->
                                Box(modifier = Modifier.size(13.dp), contentAlignment = Alignment.Center) {
                                    when (status) {
                                        MessageStatus.FAILED -> Icon(
                                            imageVector = Icons.Default.ErrorOutline,
                                            contentDescription = null,
                                            tint = Color(0xFFEF5350),
                                            modifier = Modifier.size(13.dp)
                                        )
                                        MessageStatus.SENDING -> CircularProgressIndicator(
                                            modifier = Modifier.size(11.dp),
                                            strokeWidth = 1.dp,
                                            color = textColor.copy(alpha = 0.6f)
                                        )
                                        MessageStatus.READ -> Icon(
                                            imageVector = Icons.Default.DoneAll,
                                            contentDescription = null,
                                            tint = Color(0xFF4FC3F7),
                                            modifier = Modifier.size(13.dp)
                                        )
                                        MessageStatus.SENT -> Icon(
                                            imageVector = Icons.Default.Done,
                                            contentDescription = null,
                                            tint = textColor.copy(alpha = 0.5f),
                                            modifier = Modifier.size(13.dp)
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }

            if (showHeartBurst) {
                HeartBurstOverlay(onEnd = onHeartBurstEnd)
            }
        }

        if (message.reactions.isNotEmpty()) {
            ReactionBadgeRow(reactions = message.reactions, isMe = message.isMe, isDarkMode = isDarkMode)
        }
    }
}

@Composable
private fun ReplyQuoteBlock(reply: UiReplyPreview, textColor: Color, isMe: Boolean) {
    Row(
        modifier = Modifier
            .padding(bottom = 4.dp)
            .fillMaxWidth()
            .clip(RoundedCornerShape(6.dp))
            .background(textColor.copy(alpha = 0.1f))
            .padding(start = 6.dp, end = 8.dp, top = 4.dp, bottom = 4.dp)
    ) {
        Box(
            modifier = Modifier
                .width(2.5.dp)
                .height(32.dp)
                .background(if (isMe) Color.White.copy(alpha = 0.7f) else PremiumBlue, RoundedCornerShape(2.dp))
        )
        Spacer(modifier = Modifier.width(6.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = reply.senderName ?: if (reply.mine) "Siz" else "",
                color = textColor.copy(alpha = 0.85f),
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            Text(
                text = reply.text,
                color = textColor.copy(alpha = 0.65f),
                fontSize = 12.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                fontFamily = IosEmojiFont
            )
        }
    }
}

@Composable
private fun MediaImageContent(media: UiMedia, onClick: () -> Unit) {
    AsyncImage(
        model = media.url,
        contentDescription = null,
        contentScale = ContentScale.Crop,
        modifier = Modifier
            .size(220.dp)
            .clip(RoundedCornerShape(12.dp))
            .clickable(onClick = onClick)
    )
}

@Composable
private fun MediaVideoContent(media: UiMedia, isDarkMode: Boolean, onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .size(220.dp)
            .clip(RoundedCornerShape(12.dp))
            .background(if (isDarkMode) Color(0xFF1C1C1E) else Color(0xFFD9D9DC))
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center
    ) {
        Icon(
            imageVector = Icons.Default.PlayCircleFilled,
            contentDescription = null,
            tint = Color.White,
            modifier = Modifier.size(48.dp)
        )
        media.durationSeconds?.let { duration ->
            Text(
                text = formatRecordTime(duration),
                color = Color.White,
                fontSize = 12.sp,
                modifier = Modifier
                    .align(Alignment.BottomEnd)
                    .padding(8.dp)
                    .clip(RoundedCornerShape(4.dp))
                    .background(Color.Black.copy(alpha = 0.45f))
                    .padding(horizontal = 5.dp, vertical = 2.dp)
            )
        }
    }
}

@Composable
private fun MediaFileContent(media: UiMedia, textColor: Color, onClick: () -> Unit) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        modifier = Modifier
            .widthIn(min = 160.dp, max = 240.dp)
            .clip(RoundedCornerShape(10.dp))
            .clickable(onClick = onClick)
            .padding(vertical = 4.dp)
    ) {
        Icon(
            imageVector = Icons.Default.InsertDriveFile,
            contentDescription = null,
            tint = textColor,
            modifier = Modifier.size(32.dp)
        )
        Column {
            Text(
                text = media.fileName ?: "Fayl",
                color = textColor,
                fontSize = 14.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            Text(
                text = formatFileSize(media.fileSize ?: 0L),
                color = textColor.copy(alpha = 0.6f),
                fontSize = 12.sp
            )
        }
    }
}

@Composable
private fun MediaVoiceContent(media: UiMedia, textColor: Color) {
    val context = LocalContext.current
    var isPlaying by remember(media.url) { mutableStateOf(false) }
    var progress by remember(media.url) { mutableFloatStateOf(0f) }
    val mediaPlayer = remember(media.url) { mutableStateOf<MediaPlayer?>(null) }

    DisposableEffect(media.url) {
        onDispose {
            mediaPlayer.value?.release()
            mediaPlayer.value = null
        }
    }

    LaunchedEffect(isPlaying) {
        while (isPlaying) {
            val player = mediaPlayer.value
            if (player != null && player.duration > 0) {
                progress = player.currentPosition.toFloat() / player.duration.toFloat()
            }
            delay(100)
        }
    }

    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        modifier = Modifier
            .widthIn(min = 160.dp, max = 220.dp)
            .padding(vertical = 2.dp)
    ) {
        IconButton(
            onClick = {
                val player = mediaPlayer.value
                if (player == null) {
                    runCatching {
                        val newPlayer = MediaPlayer()
                        newPlayer.setDataSource(context, Uri.parse(media.url))
                        newPlayer.setOnCompletionListener {
                            isPlaying = false
                            progress = 0f
                        }
                        newPlayer.prepare()
                        newPlayer.start()
                        mediaPlayer.value = newPlayer
                        isPlaying = true
                    }
                } else if (player.isPlaying) {
                    player.pause()
                    isPlaying = false
                } else {
                    player.start()
                    isPlaying = true
                }
            },
            modifier = Modifier.size(36.dp)
        ) {
            Icon(
                imageVector = if (isPlaying) Icons.Default.Pause else Icons.Default.PlayArrow,
                contentDescription = null,
                tint = textColor
            )
        }
        LinearProgressIndicator(
            progress = { progress },
            modifier = Modifier
                .weight(1f)
                .height(3.dp)
                .clip(RoundedCornerShape(2.dp)),
            color = textColor,
            trackColor = textColor.copy(alpha = 0.25f)
        )
        Text(
            text = formatRecordTime(media.durationSeconds ?: 0),
            color = textColor.copy(alpha = 0.7f),
            fontSize = 11.sp
        )
    }
}

@Composable
private fun FullScreenImageViewer(url: String, onDismiss: () -> Unit) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black)
            .clickable(
                indication = null,
                interactionSource = remember { MutableInteractionSource() },
                onClick = onDismiss
            ),
        contentAlignment = Alignment.Center
    ) {
        AsyncImage(
            model = url,
            contentDescription = null,
            contentScale = ContentScale.Fit,
            modifier = Modifier.fillMaxSize()
        )
        IconButton(
            onClick = onDismiss,
            modifier = Modifier
                .align(Alignment.TopStart)
                .padding(16.dp)
        ) {
            Icon(Icons.Default.Close, contentDescription = null, tint = Color.White)
        }
    }
}

@Composable
private fun ReactionBadgeRow(reactions: List<UiReaction>, isMe: Boolean, isDarkMode: Boolean) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .offset(y = (-6).dp),
        horizontalArrangement = Arrangement.spacedBy(4.dp, alignment = if (isMe) Alignment.End else Alignment.Start)
    ) {
        reactions.forEach { reaction ->
            key(reaction.emoji) {
                AnimatedReactionBadge(reaction = reaction, isDarkMode = isDarkMode)
            }
        }
    }
}

@Composable
private fun AnimatedReactionBadge(reaction: UiReaction, isDarkMode: Boolean) {
    var visible by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) { visible = true }
    androidx.compose.animation.AnimatedVisibility(
        visible = visible,
        enter = scaleIn(spring(Spring.DampingRatioMediumBouncy, Spring.StiffnessMedium)) + fadeIn(tween(150))
    ) {
        Surface(
            shape = RoundedCornerShape(10.dp),
            color = if (isDarkMode) Color(0xFF2C2C2E) else Color.White,
            border = BorderStroke(0.5.dp, if (reaction.mine) PremiumBlue else Color.Black.copy(alpha = 0.08f)),
            shadowElevation = 1.dp
        ) {
            Row(
                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(2.dp)
            ) {
                Text(text = reaction.emoji, fontSize = 12.sp, fontFamily = IosEmojiFont)
                if (reaction.count > 1) {
                    Text(
                        text = reaction.count.toString(),
                        fontSize = 10.sp,
                        color = if (isDarkMode) Color.White.copy(alpha = 0.7f) else Color.Black.copy(alpha = 0.6f)
                    )
                }
            }
        }
    }
}

@Composable
private fun BoxScope.HeartBurstOverlay(onEnd: () -> Unit) {
    val scale = remember { Animatable(0f) }
    val alpha = remember { Animatable(1f) }
    LaunchedEffect(Unit) {
        scale.animateTo(1.3f, spring(Spring.DampingRatioMediumBouncy, Spring.StiffnessMedium))
        scale.animateTo(1f, tween(120, easing = FastOutSlowInEasing))
        delay(250)
        alpha.animateTo(0f, tween(200))
        onEnd()
    }
    Icon(
        imageVector = Icons.Default.Favorite,
        contentDescription = null,
        tint = Color(0xFFFF3B5C),
        modifier = Modifier
            .align(Alignment.Center)
            .size(72.dp)
            .graphicsLayer {
                scaleX = scale.value
                scaleY = scale.value
                this.alpha = alpha.value
            }
    )
}

@Composable
fun AttachmentMenu(
    contentColor: Color,
    onPickGallery: () -> Unit = {},
    onPickFile: () -> Unit = {},
    onPickAudio: () -> Unit = {}
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceEvenly,
        verticalAlignment = Alignment.CenterVertically
    ) {
        AttachmentItem(Icons.Default.Image, "Galereya", contentColor, onClick = onPickGallery)
        AttachmentItem(Icons.Default.Description, "File", contentColor, onClick = onPickFile)
        AttachmentItem(Icons.Default.MusicNote, "Music", contentColor, onClick = onPickAudio)
        AttachmentItem(Icons.Default.LocationOn, "Location", contentColor)
    }
}

@Composable
fun AttachmentItem(icon: ImageVector, label: String, contentColor: Color, onClick: () -> Unit = {}) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
        modifier = Modifier.clickable(interactionSource = remember { MutableInteractionSource() }, indication = null, onClick = onClick)
    ) {
        Icon(icon, null, tint = contentColor, modifier = Modifier.size(18.dp))
        Text(label, color = contentColor, fontSize = 8.sp)
    }
}

@Composable
fun HeaderPillButton(onClick: () -> Unit, isDarkMode: Boolean, content: @Composable () -> Unit) {
    val pillBg = if (isDarkMode) Color.White.copy(alpha = 0.12f) else Color.White.copy(alpha = 0.6f)
    val glassBorder = if (isDarkMode) Color.White.copy(alpha = 0.1f) else Color.White.copy(0.3f)

    Box(
        modifier = Modifier.size(44.dp).clip(CircleShape).background(pillBg).border(0.5.dp, glassBorder, CircleShape)
            .clickable(interactionSource = remember { MutableInteractionSource() }, indication = null, onClick = onClick),
        contentAlignment = Alignment.Center
    ) {
        content()
    }
}

@Composable
fun ChatInfoScreen(
    userName: String, 
    isDarkMode: Boolean, 
    onBack: () -> Unit,
    onCall: () -> Unit,
    onVideoCall: () -> Unit
) {
    val backgroundColor = if (isDarkMode) Color(0xFF0F0F0F) else Color.White
    val contentColor = if (isDarkMode) Color.White else Color.Black
    val accentBlue = Color(0xFF00A3FF)
    var selectedFilter by remember { mutableIntStateOf(0) }
    val keyboardController = LocalSoftwareKeyboardController.current

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(backgroundColor)
            .statusBarsPadding()
    ) {
        Box(modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 8.dp)) {
            IconButton(onClick = onBack, modifier = Modifier.align(Alignment.CenterStart).size(36.dp)) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, null, tint = contentColor, modifier = Modifier.size(20.dp))
            }
        }

        Column(
            modifier = Modifier.fillMaxWidth().weight(1f).verticalScroll(rememberScrollState()),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Box(
                modifier = Modifier
                    .size(120.dp)
                    .border(2.dp, accentBlue, CircleShape)
                    .padding(6.dp)
                    .clip(CircleShape)
                    .background(contentColor.copy(0.1f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(Icons.Default.Person, null, modifier = Modifier.fillMaxSize(0.6f), tint = contentColor.copy(0.4f))
            }

            Spacer(modifier = Modifier.height(16.dp))
            
            var isInfoNameExpanded by remember { mutableStateOf(false) }
            Text(
                text = userName, 
                color = contentColor, 
                fontSize = if (isInfoNameExpanded) 24.sp else if (userName.length > 15) 18.sp else 22.sp, 
                fontWeight = FontWeight.ExtraBold,
                textAlign = TextAlign.Center,
                maxLines = if (isInfoNameExpanded) 2 else 1,
                softWrap = isInfoNameExpanded,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier
                    .padding(horizontal = 24.dp)
                    .clickable(
                        interactionSource = remember { MutableInteractionSource() },
                        indication = null
                    ) { isInfoNameExpanded = !isInfoNameExpanded }
            )

            Text(text = "@${userName.lowercase().replace(" ", "")}", color = accentBlue, fontSize = 15.sp, fontWeight = FontWeight.Bold)

            Spacer(modifier = Modifier.height(24.dp))

            // TOP 4 ACTIONS (Profile, Search, Call, Video)
            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                InfoActionButton(Icons.Default.Person, "Profile", isDarkMode) { }
                InfoActionButton(Icons.Default.Search, "Qidiruv", isDarkMode) { }
                InfoActionButton(Icons.Default.Call, "Call", isDarkMode, onClick = onCall)
                InfoActionButton(Icons.Default.Videocam, "Video", isDarkMode, onClick = onVideoCall)
            }

            Spacer(modifier = Modifier.height(28.dp))

            // SETTINGS LIST (Mute, Themes, Nicknames, Report, Block, Delete)
            Column(modifier = Modifier.fillMaxWidth().padding(horizontal = 24.dp)) {
                SettingsListItem(Icons.Default.Notifications, "Mute", "Xabarlarni o'chirish", contentColor)
                SettingsListItem(Icons.Default.Palette, "Themes", "Orqa fon va ranglar", contentColor)
                SettingsListItem(Icons.Default.Badge, "Nicknames", "Ismni o'zgartirish", contentColor)
                SettingsListItem(Icons.Default.Flag, "Report", "Ariza tashlash", Color.Red)
                SettingsListItem(Icons.Default.Block, "Block", "Foydalanuvchini bloklash", Color.Red)
                SettingsListItem(Icons.Default.DeleteForever, "Delete Chat", "Chatni o'chirish", Color.Red)
            }

            Spacer(modifier = Modifier.height(32.dp))

            // --- 5 ICONS NAVIGATION BAR ---
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 24.dp, vertical = 8.dp)
                    .height(56.dp)
                    .clip(RoundedCornerShape(28.dp))
                    .background(if (isDarkMode) Color.White.copy(0.08f) else Color.Black.copy(0.04f))
                    .border(0.5.dp, contentColor.copy(0.1f), RoundedCornerShape(28.dp))
            ) {
                val screenWidth = LocalConfiguration.current.screenWidthDp
                val barPadding = 48 
                val itemWidth = (screenWidth - barPadding) / 5
                val indicatorOffset by animateDpAsState(
                    targetValue = (selectedFilter * itemWidth).dp,
                    animationSpec = spring(stiffness = Spring.StiffnessLow),
                    label = "indicator"
                )

                Box(
                    modifier = Modifier
                        .offset(x = indicatorOffset)
                        .width(itemWidth.dp)
                        .fillMaxHeight()
                        .padding(4.dp)
                        .clip(RoundedCornerShape(24.dp))
                        .background(accentBlue.copy(0.2f))
                        .border(1.dp, accentBlue.copy(0.4f), RoundedCornerShape(24.dp))
                )

                Row(modifier = Modifier.fillMaxSize(), verticalAlignment = Alignment.CenterVertically) {
                    FilterItem(Icons.Default.Image, selectedFilter == 0, contentColor) { selectedFilter = 0 }
                    FilterItem(Icons.Default.GridView, selectedFilter == 1, contentColor) { selectedFilter = 1 }
                    FilterItem(Icons.Default.Description, selectedFilter == 2, contentColor) { selectedFilter = 2 }
                    FilterItem(Icons.Default.MusicNote, selectedFilter == 3, contentColor) { selectedFilter = 3 }
                    FilterItem(Icons.Default.Folder, selectedFilter == 4, contentColor) { selectedFilter = 4 }
                }
            }

            // --- SHARED CONTENT AREA (Under the icons, eng pastda) ---
            Box(modifier = Modifier.fillMaxWidth().height(240.dp).padding(horizontal = 24.dp)) {
                AnimatedContent(
                    targetState = selectedFilter,
                    transitionSpec = { fadeIn() togetherWith fadeOut() },
                    label = "filter_content"
                ) { filter ->
                    Column(modifier = Modifier.fillMaxSize()) {
                        when(filter) {
                            0 -> { // Gallery
                                LazyVerticalGrid(
                                    columns = GridCells.Fixed(3),
                                    modifier = Modifier.fillMaxSize(),
                                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                                    verticalArrangement = Arrangement.spacedBy(4.dp)
                                ) {
                                    items(6) {
                                        Box(modifier = Modifier.aspectRatio(1f).clip(RoundedCornerShape(8.dp)).background(contentColor.copy(0.1f))) {
                                            Icon(Icons.Default.Image, null, modifier = Modifier.align(Alignment.Center), tint = contentColor.copy(0.2f))
                                        }
                                    }
                                }
                            }
                            1 -> { // Posts
                                LazyVerticalGrid(
                                    columns = GridCells.Fixed(3),
                                    modifier = Modifier.fillMaxSize(),
                                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                                    verticalArrangement = Arrangement.spacedBy(4.dp)
                                ) {
                                    items(3) {
                                        Box(modifier = Modifier.aspectRatio(1f).clip(RoundedCornerShape(8.dp)).background(contentColor.copy(0.1f))) {
                                            Icon(Icons.Default.GridView, null, modifier = Modifier.align(Alignment.Center), tint = contentColor.copy(0.2f))
                                        }
                                    }
                                }
                            }
                            2 -> { // Documents
                                LazyColumn(modifier = Modifier.fillMaxSize()) {
                                    items(3) { SettingsListItem(Icons.Default.Description, "Hujjat $it.pdf", "2.4 MB", contentColor) }
                                }
                            }
                            3 -> { // Music
                                LazyColumn(modifier = Modifier.fillMaxSize()) {
                                    items(3) { SettingsListItem(Icons.Default.MusicNote, "Audio Track $it.mp3", "Artist Name", contentColor) }
                                }
                            }
                            4 -> { // Files
                                LazyColumn(modifier = Modifier.fillMaxSize()) {
                                    items(3) { SettingsListItem(Icons.Default.Folder, "File_$it.zip", "156 MB", contentColor) }
                                }
                            }
                        }
                    }
                }
            }
            
            Spacer(modifier = Modifier.height(32.dp))
        }
    }
}

@Composable
fun RowScope.FilterItem(icon: ImageVector, isSelected: Boolean, contentColor: Color, onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .weight(1f)
            .fillMaxHeight()
            .clickable(
                interactionSource = remember { MutableInteractionSource() },
                indication = null,
                onClick = onClick
            ),
        contentAlignment = Alignment.Center
    ) {
        Icon(
            imageVector = icon, 
            contentDescription = null, 
            tint = if (isSelected) Color(0xFF00A3FF) else contentColor.copy(0.4f), 
            modifier = Modifier.size(22.dp)
        )
    }
}

@Composable
fun InfoActionButton(icon: ImageVector, label: String, isDarkMode: Boolean, onClick: () -> Unit) {
    val contentColor = if (isDarkMode) Color.White else Color.Black
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Box(
            modifier = Modifier
                .size(52.dp)
                .clip(CircleShape)
                .background(
                    Brush.verticalGradient(
                        colors = if (isDarkMode)
                            listOf(Color.White.copy(0.18f), Color.White.copy(0.04f))
                        else
                            listOf(Color.Black.copy(0.08f), Color.Black.copy(0.02f))
                    )
                )
                .border(0.5.dp, if (isDarkMode) Color.White.copy(0.12f) else Color.Black.copy(0.06f), CircleShape)
                .clickable(onClick = onClick),
            contentAlignment = Alignment.Center
        ) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(2.dp)
                    .clip(CircleShape)
                    .background(
                        Brush.verticalGradient(
                            listOf(Color.White.copy(0.1f), Color.Transparent)
                        )
                    )
            )
            Icon(icon, null, tint = Color(0xFF00A3FF), modifier = Modifier.size(22.dp))
        }
        Spacer(modifier = Modifier.height(8.dp))
        Text(text = label, color = contentColor.copy(0.6f), fontSize = 11.sp, fontWeight = FontWeight.Bold)
    }
}

@Composable
fun SettingsListItem(icon: ImageVector, title: String, subtitle: String?, tint: Color) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(icon, null, tint = if(tint == Color.Red) Color.Red else Color(0xFF00A3FF), modifier = Modifier.size(22.dp))
        Spacer(modifier = Modifier.width(16.dp))
        Column {
            Text(text = title, color = tint, fontSize = 15.sp, fontWeight = FontWeight.Bold)
            if (subtitle != null) {
                Text(text = subtitle, color = tint.copy(0.5f), fontSize = 12.sp)
            }
        }
    }
}

@Composable
fun RequestActionButtons(isDarkMode: Boolean, onBack: () -> Unit) {
    val containerBg = if (isDarkMode) Color(0xFF1C1C1E) else Color.White
    val contentColor = if (isDarkMode) Color.White else Color.Black
    val glassBorder = if (isDarkMode) Color.White.copy(alpha = 0.1f) else Color.Black.copy(0.05f)

    Surface(
        modifier = Modifier.fillMaxWidth(),
        color = containerBg,
        tonalElevation = 8.dp,
        border = BorderStroke(0.5.dp, glassBorder)
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp).fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            RequestActionButton(text = "O'chirish", color = Color.Red, modifier = Modifier.weight(1f), onClick = onBack)
            RequestActionButton(text = "Bloklash", color = contentColor, modifier = Modifier.weight(1f), onClick = onBack)
            RequestActionButton(text = "Qo'shish", color = Color(0xFF00A3FF), modifier = Modifier.weight(1f), onClick = onBack)
        }
    }
}

@Composable
fun RequestActionButton(text: String, color: Color, modifier: Modifier = Modifier, onClick: () -> Unit) {
    Surface(
        modifier = modifier.height(44.dp).clickable(onClick = onClick),
        shape = RoundedCornerShape(12.dp),
        color = color.copy(alpha = 0.1f),
        border = BorderStroke(1.dp, color.copy(alpha = 0.2f))
    ) {
        Box(contentAlignment = Alignment.Center) {
            Text(text = text, color = color, fontWeight = FontWeight.Bold, fontSize = 14.sp)
        }
    }
}

@Composable
private fun DateHeader(timestamp: Long, isDarkMode: Boolean) {
    val dateString = SimpleDateFormat("dd MMMM", Locale.getDefault()).format(Date(timestamp))
    Box(modifier = Modifier.fillMaxWidth().padding(vertical = 12.dp), contentAlignment = Alignment.Center) {
        Surface(
            color = if (isDarkMode) Color.White.copy(0.1f) else Color.Black.copy(0.05f),
            shape = RoundedCornerShape(12.dp)
        ) {
            Text(text = dateString, modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp), color = if (isDarkMode) Color.White.copy(0.6f) else Color.Black.copy(0.5f), fontSize = 11.sp, fontWeight = FontWeight.Medium)
        }
    }
}

private fun isSameDay(t1: Long, t2: Long): Boolean {
    val f = SimpleDateFormat("yyyyMMdd", Locale.getDefault())
    return f.format(Date(t1)) == f.format(Date(t2))
}

@Composable
private fun TypingIndicatorDots(color: Color, modifier: Modifier = Modifier) {
    val transition = rememberInfiniteTransition(label = "typing_dots")
    val dotOffsets = List(3) { index ->
        transition.animateFloat(
            initialValue = 0f,
            targetValue = 1f,
            animationSpec = infiniteRepeatable(
                animation = tween(durationMillis = 450, easing = FastOutSlowInEasing),
                repeatMode = RepeatMode.Reverse,
                initialStartOffset = StartOffset(index * 150)
            ),
            label = "typing_dot_$index"
        )
    }
    Row(
        modifier = modifier,
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(3.dp)
    ) {
        dotOffsets.forEach { offset ->
            Box(
                modifier = Modifier
                    .size(5.dp)
                    .offset(y = (-3).dp * offset.value)
                    .background(color, CircleShape)
            )
        }
    }
}

enum class MessageStatus { SENT, READ, FAILED, SENDING }

enum class RecordMode { VOICE, VIDEO }
enum class InputBarState { IDLE, RECORDING, LOCKED }
enum class RightButtonState { SEND_TEXT, RECORD_IDLE, RECORDING }

data class MessageData(
    val id: String,
    val text: String,
    val isMe: Boolean,
    var isNew: Boolean = false,
    val timestamp: Long = System.currentTimeMillis(),
    val status: MessageStatus = MessageStatus.SENT,
    val clientId: String? = null,
    val isDeleted: Boolean = false,
    val reactions: List<UiReaction> = emptyList(),
    val replyTo: UiReplyPreview? = null,
    val messageType: String = "text",
    val media: UiMedia? = null,
    val editedAt: Long? = null,
    val forwardedFromSenderId: String? = null
)

@Composable
private fun RecordingProgressBar(
    seconds: Int,
    dotAlpha: Float,
    slideProgress: Float,
    contentColor: Color
) {
    val arrowAlpha = (1f - slideProgress * 1.4f).coerceIn(0f, 1f)
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(start = 14.dp, end = 14.dp, top = 14.dp, bottom = 14.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier
                .size(10.dp)
                .clip(CircleShape)
                .background(Color(0xFFFF3B30).copy(alpha = dotAlpha))
        )
        Spacer(Modifier.width(10.dp))
        Text(
            text = formatRecordTime(seconds),
            color = contentColor,
            fontSize = 15.sp,
            fontWeight = FontWeight.Medium,
            fontFamily = IosEmojiFont
        )
        Spacer(Modifier.weight(1f))
        Row(
            modifier = Modifier.graphicsLayer { alpha = arrowAlpha },
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                Icons.Default.ChevronLeft,
                null,
                tint = contentColor.copy(0.5f),
                modifier = Modifier.size(16.dp)
            )
            Text(
                text = "Bekor qilish uchun suring",
                color = contentColor.copy(0.55f),
                fontSize = 13.sp,
                fontFamily = IosEmojiFont
            )
        }
    }
}

@Composable
private fun LockedRecordBar(
    seconds: Int,
    dotAlpha: Float,
    mode: RecordMode,
    flashOn: Boolean,
    onFlashToggle: () -> Unit,
    onCancel: () -> Unit,
    contentColor: Color
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 4.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        IconButton(onClick = onCancel, modifier = Modifier.size(40.dp)) {
            Icon(
                Icons.Default.Delete,
                null,
                tint = Color(0xFFFF3B30),
                modifier = Modifier.size(20.dp)
            )
        }
        Spacer(Modifier.width(2.dp))
        Box(
            modifier = Modifier
                .size(10.dp)
                .clip(CircleShape)
                .background(Color(0xFFFF3B30).copy(alpha = dotAlpha))
        )
        Spacer(Modifier.width(8.dp))
        Text(
            text = formatRecordTime(seconds),
            color = contentColor,
            fontSize = 15.sp,
            fontWeight = FontWeight.Medium,
            fontFamily = IosEmojiFont
        )
        Spacer(Modifier.weight(1f))
        if (mode == RecordMode.VIDEO) {
            IconButton(onClick = onFlashToggle, modifier = Modifier.size(40.dp)) {
                Icon(
                    if (flashOn) Icons.Default.FlashOn else Icons.Default.FlashOff,
                    null,
                    tint = if (flashOn) Color(0xFFFFC107) else contentColor.copy(0.55f),
                    modifier = Modifier.size(20.dp)
                )
            }
        }
        Icon(
            Icons.Default.Lock,
            null,
            tint = contentColor.copy(0.6f),
            modifier = Modifier
                .padding(end = 8.dp)
                .size(16.dp)
        )
    }
}

@Composable
private fun RecordButton(
    mode: RecordMode,
    isRecording: Boolean,
    waveScale: Float,
    accentBlue: Color,
    onTap: () -> Unit,
    onLongPress: () -> Unit,
    onDrag: (Float) -> Unit,
    onRelease: () -> Unit
) {
    val bgColor by animateColorAsState(
        targetValue = if (isRecording) Color(0xFFFF3B30) else accentBlue,
        animationSpec = tween(220, easing = FastOutSlowInEasing),
        label = "rec_btn_bg"
    )
    val scale by animateFloatAsState(
        targetValue = if (isRecording) 1.35f else 1f,
        animationSpec = spring(dampingRatio = 0.7f, stiffness = 480f),
        label = "rec_btn_scale"
    )

    Box(
        modifier = Modifier.size(64.dp),
        contentAlignment = Alignment.Center
    ) {
        if (isRecording) {
            Box(
                modifier = Modifier
                    .size(48.dp)
                    .graphicsLayer {
                        scaleX = waveScale
                        scaleY = waveScale
                        alpha = (2f - waveScale).coerceIn(0f, 1f) * 0.55f
                    }
                    .clip(CircleShape)
                    .background(Color(0xFFFF3B30))
            )
        }
        Box(
            modifier = Modifier
                .size(42.dp)
                .graphicsLayer { scaleX = scale; scaleY = scale }
                .clip(CircleShape)
                .background(bgColor)
                .pointerInput(mode) {
                    detectTapGestures(
                        onTap = { onTap() },
                        onLongPress = { onLongPress() },
                        onPress = {
                            val released = tryAwaitRelease()
                            if (released) onRelease()
                        }
                    )
                }
                .pointerInput(Unit) {
                    awaitEachGesture {
                        val down = awaitFirstDown(requireUnconsumed = false)
                        try {
                            while (true) {
                                val event = awaitPointerEvent()
                                val change = event.changes.firstOrNull { it.id == down.id } ?: break
                                if (!change.pressed) break
                                onDrag(change.positionChange().y)
                            }
                        } catch (_: Throwable) {}
                    }
                },
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = if (mode == RecordMode.VOICE) Icons.Default.Mic else Icons.Default.Videocam,
                contentDescription = null,
                tint = Color.White,
                modifier = Modifier.size(if (isRecording) 22.dp else 20.dp)
            )
        }
    }
}

@Composable
private fun LockHintChip(progress: Float, isDarkMode: Boolean, accentBlue: Color) {
    val bg = if (isDarkMode) Color.White.copy(alpha = 0.12f) else Color.White.copy(alpha = 0.85f)
    val border = if (isDarkMode) Color.White.copy(alpha = 0.1f) else Color.Black.copy(alpha = 0.05f)
    val activeColor = accentBlue.copy(alpha = (0.25f + progress * 0.75f).coerceIn(0f, 1f))
    val lockColor = lerpColor(if (isDarkMode) Color.White.copy(0.6f) else Color.Black.copy(0.5f), accentBlue, progress)

    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(2.dp),
        modifier = Modifier
            .width(40.dp)
            .clip(RoundedCornerShape(20.dp))
            .background(bg)
            .border(0.5.dp, border, RoundedCornerShape(20.dp))
            .padding(vertical = 8.dp)
    ) {
        Icon(
            Icons.Default.Lock,
            null,
            tint = lockColor,
            modifier = Modifier.size(18.dp)
        )
        Icon(
            Icons.Default.KeyboardArrowUp,
            null,
            tint = activeColor,
            modifier = Modifier.size(16.dp)
        )
    }
}

private fun formatRecordTime(seconds: Int): String {
    val m = seconds / 60
    val s = seconds % 60
    return "%d:%02d".format(m, s)
}

private fun formatFileSize(bytes: Long): String {
    val kb = bytes / 1024.0
    return if (kb < 1024) "%.0f KB".format(kb) else "%.1f MB".format(kb / 1024.0)
}

private fun messageTypeForMime(mimeType: String): String = when {
    mimeType.startsWith("image/") -> "image"
    mimeType.startsWith("video/") -> "video"
    else -> "file"
}

private data class PickedMedia(
    val file: File,
    val fileName: String,
    val mimeType: String,
    val fileSize: Long
)

// Copies a content:// URI's bytes into a cache file because the upload API
// (and Coil's optimistic preview) need a real File / file:// path, while
// content URIs from the system picker are not guaranteed to remain readable.
private fun pickedMediaFromUri(context: android.content.Context, uri: Uri): PickedMedia? {
    return try {
        val resolver = context.contentResolver
        val mimeType = resolver.getType(uri) ?: "application/octet-stream"
        var displayName: String? = null
        var size = 0L
        resolver.query(uri, null, null, null, null)?.use { cursor ->
            val nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
            val sizeIndex = cursor.getColumnIndex(OpenableColumns.SIZE)
            if (cursor.moveToFirst()) {
                if (nameIndex >= 0) displayName = cursor.getString(nameIndex)
                if (sizeIndex >= 0) size = cursor.getLong(sizeIndex)
            }
        }
        val extension = MimeTypeMap.getSingleton().getExtensionFromMimeType(mimeType)
        val fileName = displayName ?: "file_${System.currentTimeMillis()}${extension?.let { ".$it" } ?: ""}"
        val outFile = File(context.cacheDir, "chat_${System.currentTimeMillis()}_$fileName")
        resolver.openInputStream(uri)?.use { input ->
            outFile.outputStream().use { output -> input.copyTo(output) }
        } ?: return null
        if (size <= 0L) size = outFile.length()
        PickedMedia(file = outFile, fileName = fileName, mimeType = mimeType, fileSize = size)
    } catch (ex: Exception) {
        null
    }
}

private fun lerpColor(start: Color, end: Color, t: Float): Color {
    val c = t.coerceIn(0f, 1f)
    return Color(
        red = start.red + (end.red - start.red) * c,
        green = start.green + (end.green - start.green) * c,
        blue = start.blue + (end.blue - start.blue) * c,
        alpha = start.alpha + (end.alpha - start.alpha) * c
    )
}

@Composable
private fun ReplyPreviewBar(
    reply: UiReplyPreview,
    isDarkMode: Boolean,
    accentBlue: Color,
    onCancel: () -> Unit
) {
    val contentColor = if (isDarkMode) Color.White else Color.Black
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp, vertical = 6.dp)
            .clip(RoundedCornerShape(10.dp))
            .background(if (isDarkMode) Color.White.copy(alpha = 0.08f) else Color.Black.copy(alpha = 0.05f))
            .padding(horizontal = 10.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier
                .width(2.5.dp)
                .height(32.dp)
                .background(accentBlue, RoundedCornerShape(2.dp))
        )
        Spacer(modifier = Modifier.width(8.dp))
        Icon(
            imageVector = Icons.AutoMirrored.Filled.Reply,
            contentDescription = null,
            tint = accentBlue,
            modifier = Modifier.size(16.dp)
        )
        Spacer(modifier = Modifier.width(6.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = reply.senderName ?: if (reply.mine) "Siz" else "",
                color = accentBlue,
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            Text(
                text = reply.text,
                color = contentColor.copy(alpha = 0.65f),
                fontSize = 12.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                fontFamily = IosEmojiFont
            )
        }
        IconButton(onClick = onCancel, modifier = Modifier.size(28.dp)) {
            Icon(
                imageVector = Icons.Default.Close,
                contentDescription = null,
                tint = contentColor.copy(alpha = 0.5f),
                modifier = Modifier.size(16.dp)
            )
        }
    }
}

@Composable
private fun EditPreviewBar(
    text: String,
    isDarkMode: Boolean,
    accentBlue: Color,
    onCancel: () -> Unit
) {
    val contentColor = if (isDarkMode) Color.White else Color.Black
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp, vertical = 6.dp)
            .clip(RoundedCornerShape(10.dp))
            .background(if (isDarkMode) Color.White.copy(alpha = 0.08f) else Color.Black.copy(alpha = 0.05f))
            .padding(horizontal = 10.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier
                .width(2.5.dp)
                .height(32.dp)
                .background(accentBlue, RoundedCornerShape(2.dp))
        )
        Spacer(modifier = Modifier.width(8.dp))
        Icon(
            imageVector = Icons.Default.Edit,
            contentDescription = null,
            tint = accentBlue,
            modifier = Modifier.size(16.dp)
        )
        Spacer(modifier = Modifier.width(6.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = "Xabarni tahrirlash",
                color = accentBlue,
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            Text(
                text = text,
                color = contentColor.copy(alpha = 0.65f),
                fontSize = 12.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                fontFamily = IosEmojiFont
            )
        }
        IconButton(onClick = onCancel, modifier = Modifier.size(28.dp)) {
            Icon(
                imageVector = Icons.Default.Close,
                contentDescription = null,
                tint = contentColor.copy(alpha = 0.5f),
                modifier = Modifier.size(16.dp)
            )
        }
    }
}

@Composable
private fun PinnedMessageBanner(
    pinnedMessage: UiPinnedMessage,
    isDarkMode: Boolean,
    accentBlue: Color,
    glassBg: Color,
    glassBorder: Color,
    onUnpin: () -> Unit
) {
    val contentColor = if (isDarkMode) Color.White else Color.Black
    Surface(
        modifier = Modifier.fillMaxWidth(),
        color = glassBg.copy(alpha = 0.92f),
        border = BorderStroke(0.5.dp, glassBorder)
    ) {
        Row(
            modifier = Modifier
                .padding(horizontal = 16.dp, vertical = 8.dp)
                .fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .width(2.5.dp)
                    .height(28.dp)
                    .background(accentBlue, RoundedCornerShape(2.dp))
            )
            Spacer(modifier = Modifier.width(8.dp))
            Icon(
                imageVector = Icons.Default.PushPin,
                contentDescription = null,
                tint = accentBlue,
                modifier = Modifier.size(14.dp)
            )
            Spacer(modifier = Modifier.width(8.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(text = "Pin qilingan xabar", color = accentBlue, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                Text(
                    text = pinnedMessage.text,
                    color = contentColor.copy(alpha = 0.7f),
                    fontSize = 12.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    fontFamily = IosEmojiFont
                )
            }
            IconButton(onClick = onUnpin, modifier = Modifier.size(28.dp)) {
                Icon(
                    imageVector = Icons.Default.Close,
                    contentDescription = null,
                    tint = contentColor.copy(alpha = 0.5f),
                    modifier = Modifier.size(16.dp)
                )
            }
        }
    }
}

private data class ContextMenuAction(
    val label: String,
    val icon: ImageVector,
    val color: Color,
    val onClick: () -> Unit
)

@Composable
private fun MessageContextMenuOverlay(
    message: MessageData,
    isDarkMode: Boolean,
    isPinned: Boolean,
    canPin: Boolean,
    onDismiss: () -> Unit,
    onCopy: () -> Unit,
    onReply: () -> Unit,
    onTogglePin: () -> Unit,
    onDeleteForMe: () -> Unit,
    onDeleteForEveryone: () -> Unit,
    onEdit: () -> Unit,
    onForward: () -> Unit
) {
    var visible by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) { visible = true }

    val close: () -> Unit = { visible = false }

    LaunchedEffect(visible) {
        if (!visible) {
            delay(180)
            onDismiss()
        }
    }

    val contentColor = if (isDarkMode) Color.White else Color.Black
    val transformOrigin = TransformOrigin(if (message.isMe) 0.85f else 0.15f, 1f)

    AnimatedVisibility(
        visible = visible,
        enter = fadeIn(tween(160)),
        exit = fadeOut(tween(160)),
        modifier = Modifier.fillMaxSize()
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Color.Black.copy(alpha = 0.45f))
                .clickable(
                    interactionSource = remember { MutableInteractionSource() },
                    indication = null,
                    onClick = close
                ),
            contentAlignment = Alignment.Center
        ) {
            AnimatedVisibility(
                visible = visible,
                enter = scaleIn(
                    animationSpec = spring(dampingRatio = 0.7f, stiffness = 500f),
                    initialScale = 0.8f,
                    transformOrigin = transformOrigin
                ) + fadeIn(tween(160)),
                exit = scaleOut(
                    animationSpec = tween(140, easing = FastOutSlowInEasing),
                    targetScale = 0.85f,
                    transformOrigin = transformOrigin
                ) + fadeOut(tween(120)),
                modifier = Modifier
                    .padding(horizontal = 24.dp)
                    .widthIn(max = 280.dp)
            ) {
                Column(
                    horizontalAlignment = if (message.isMe) Alignment.End else Alignment.Start,
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    MessageBubble(message = message, isDarkMode = isDarkMode)

                    val items = buildList {
                        if (!message.isDeleted) {
                            add(
                                ContextMenuAction("Nusxalash", Icons.Default.ContentCopy, contentColor) {
                                    onCopy(); close()
                                }
                            )
                            add(
                                ContextMenuAction("Javob berish", Icons.AutoMirrored.Filled.Reply, contentColor) {
                                    onReply(); close()
                                }
                            )
                            if (canPin) {
                                add(
                                    ContextMenuAction(
                                        if (isPinned) "Pindan olish" else "Pin qilish",
                                        Icons.Default.PushPin,
                                        contentColor
                                    ) { onTogglePin(); close() }
                                )
                                add(
                                    ContextMenuAction("Uzatish", Icons.AutoMirrored.Filled.Send, contentColor) {
                                        onForward(); close()
                                    }
                                )
                            }
                            if (message.isMe && message.messageType == "text" && canPin) {
                                add(
                                    ContextMenuAction("Tahrirlash", Icons.Default.Edit, contentColor) {
                                        onEdit(); close()
                                    }
                                )
                            }
                        }
                        add(
                            ContextMenuAction("Men uchun o'chirish", Icons.Default.Delete, Color(0xFFFF3B30)) {
                                onDeleteForMe(); close()
                            }
                        )
                        if (message.isMe && !message.isDeleted && canPin) {
                            add(
                                ContextMenuAction("Hamma uchun o'chirish", Icons.Default.DeleteForever, Color(0xFFFF3B30)) {
                                    onDeleteForEveryone(); close()
                                }
                            )
                        }
                    }

                    ContextMenuCard(isDarkMode = isDarkMode, items = items)
                }
            }
        }
    }
}

@Composable
private fun ContextMenuCard(isDarkMode: Boolean, items: List<ContextMenuAction>) {
    val bg = if (isDarkMode) Color(0xFF2C2C2E) else Color.White
    val dividerColor = if (isDarkMode) Color.White.copy(alpha = 0.08f) else Color.Black.copy(alpha = 0.08f)
    Column(
        modifier = Modifier
            .width(220.dp)
            .clip(RoundedCornerShape(14.dp))
            .background(bg)
    ) {
        items.forEachIndexed { index, action ->
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable(
                        interactionSource = remember { MutableInteractionSource() },
                        indication = null,
                        onClick = action.onClick
                    )
                    .padding(horizontal = 16.dp, vertical = 12.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(text = action.label, color = action.color, fontSize = 15.sp)
                Icon(action.icon, contentDescription = null, tint = action.color, modifier = Modifier.size(18.dp))
            }
            if (index < items.size - 1) {
                HorizontalDivider(color = dividerColor, thickness = 0.5.dp)
            }
        }
    }
}

@Composable
private fun ForwardPickerOverlay(
    isDarkMode: Boolean,
    onDismiss: () -> Unit,
    onSelect: (UiConversationSummary) -> Unit
) {
    var visible by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) { visible = true }

    val close: () -> Unit = { visible = false }

    LaunchedEffect(visible) {
        if (!visible) {
            delay(180)
            onDismiss()
        }
    }

    val chatRepository = remember { ChatRepository() }
    var conversations by remember { mutableStateOf<List<UiConversationSummary>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }

    LaunchedEffect(Unit) {
        when (val result = chatRepository.getConversations()) {
            is ChatResult.Success -> conversations = result.value
            is ChatResult.Error -> Unit
        }
        isLoading = false
    }

    val contentColor = if (isDarkMode) Color.White else Color.Black
    val bg = if (isDarkMode) Color(0xFF2C2C2E) else Color.White

    AnimatedVisibility(
        visible = visible,
        enter = fadeIn(tween(160)),
        exit = fadeOut(tween(160)),
        modifier = Modifier.fillMaxSize()
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Color.Black.copy(alpha = 0.45f))
                .clickable(
                    interactionSource = remember { MutableInteractionSource() },
                    indication = null,
                    onClick = close
                ),
            contentAlignment = Alignment.Center
        ) {
            AnimatedVisibility(
                visible = visible,
                enter = scaleIn(animationSpec = spring(dampingRatio = 0.7f, stiffness = 500f), initialScale = 0.85f) + fadeIn(tween(160)),
                exit = scaleOut(animationSpec = tween(140, easing = FastOutSlowInEasing), targetScale = 0.85f) + fadeOut(tween(120)),
                modifier = Modifier
                    .padding(horizontal = 32.dp)
                    .widthIn(max = 320.dp)
            ) {
                Column(
                    modifier = Modifier
                        .clip(RoundedCornerShape(16.dp))
                        .background(bg)
                        .clickable(
                            interactionSource = remember { MutableInteractionSource() },
                            indication = null,
                            onClick = {}
                        )
                ) {
                    Text(
                        text = "Xabarni uzatish",
                        color = contentColor,
                        fontWeight = FontWeight.Bold,
                        fontSize = 16.sp,
                        modifier = Modifier.padding(16.dp)
                    )
                    when {
                        isLoading -> Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(24.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(24.dp),
                                strokeWidth = 2.dp,
                                color = contentColor.copy(alpha = 0.5f)
                            )
                        }
                        conversations.isEmpty() -> Text(
                            text = "Suhbatlar topilmadi",
                            color = contentColor.copy(alpha = 0.5f),
                            fontSize = 13.sp,
                            modifier = Modifier.padding(16.dp)
                        )
                        else -> LazyColumn(modifier = Modifier.heightIn(max = 320.dp)) {
                            items(conversations, key = { it.id }) { conv ->
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .clickable {
                                            close()
                                            onSelect(conv)
                                        }
                                        .padding(horizontal = 16.dp, vertical = 12.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Box(
                                        modifier = Modifier
                                            .size(36.dp)
                                            .clip(CircleShape)
                                            .background(if (isDarkMode) Color.White.copy(alpha = 0.1f) else Color.Black.copy(alpha = 0.06f)),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Icon(
                                            Icons.Default.Person,
                                            contentDescription = null,
                                            tint = contentColor.copy(alpha = 0.5f),
                                            modifier = Modifier.size(18.dp)
                                        )
                                    }
                                    Spacer(modifier = Modifier.width(12.dp))
                                    Text(
                                        text = conv.displayName,
                                        color = contentColor,
                                        fontSize = 14.sp,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis
                                    )
                                }
                            }
                        }
                    }
                    Spacer(modifier = Modifier.height(8.dp))
                }
            }
        }
    }
}

@Composable
private fun MessageSearchOverlay(
    isDarkMode: Boolean,
    accentBlue: Color,
    conversationId: String?,
    query: String,
    onQueryChange: (String) -> Unit,
    results: SnapshotStateList<UiChatMessage>,
    isSearching: Boolean,
    onSearchingChange: (Boolean) -> Unit,
    onDismiss: () -> Unit,
    onResultClick: (UiChatMessage) -> Unit
) {
    val backgroundColor = if (isDarkMode) Color.Black else Color.White
    val contentColor = if (isDarkMode) Color.White else Color.Black
    val chatRepository = remember { ChatRepository() }
    val keyboardController = LocalSoftwareKeyboardController.current
    val focusRequester = remember { FocusRequester() }

    LaunchedEffect(Unit) {
        delay(150)
        focusRequester.requestFocus()
    }

    LaunchedEffect(query, conversationId) {
        val targetConversationId = conversationId
        if (query.isBlank() || targetConversationId == null) {
            results.clear()
            onSearchingChange(false)
            return@LaunchedEffect
        }
        delay(350)
        onSearchingChange(true)
        when (val result = chatRepository.searchMessages(targetConversationId, query.trim())) {
            is ChatResult.Success -> {
                results.clear()
                results.addAll(result.value)
            }
            is ChatResult.Error -> results.clear()
        }
        onSearchingChange(false)
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(backgroundColor)
            .statusBarsPadding()
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 8.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            IconButton(onClick = {
                keyboardController?.hide()
                onDismiss()
            }) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = null, tint = contentColor)
            }
            Box(
                modifier = Modifier
                    .weight(1f)
                    .clip(RoundedCornerShape(20.dp))
                    .background(if (isDarkMode) Color.White.copy(alpha = 0.08f) else Color.Black.copy(alpha = 0.05f))
                    .padding(horizontal = 14.dp, vertical = 10.dp)
            ) {
                if (query.isEmpty()) {
                    Text(text = "Xabarlarni qidirish...", color = contentColor.copy(alpha = 0.45f), fontSize = 14.sp)
                }
                BasicTextField(
                    value = query,
                    onValueChange = onQueryChange,
                    modifier = Modifier
                        .fillMaxWidth()
                        .focusRequester(focusRequester),
                    textStyle = TextStyle(color = contentColor, fontSize = 14.sp, fontFamily = IosEmojiFont),
                    cursorBrush = SolidColor(accentBlue),
                    singleLine = true
                )
            }
            if (query.isNotEmpty()) {
                IconButton(onClick = { onQueryChange("") }) {
                    Icon(Icons.Default.Close, contentDescription = null, tint = contentColor.copy(alpha = 0.5f))
                }
            }
        }

        when {
            isSearching -> Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(24.dp),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator(
                    modifier = Modifier.size(24.dp),
                    strokeWidth = 2.dp,
                    color = contentColor.copy(alpha = 0.5f)
                )
            }
            query.isNotBlank() && results.isEmpty() -> Text(
                text = "Hech narsa topilmadi",
                color = contentColor.copy(alpha = 0.5f),
                fontSize = 13.sp,
                modifier = Modifier.padding(16.dp)
            )
            else -> {
                val timeFormat = remember { SimpleDateFormat("dd.MM.yyyy HH:mm", Locale.getDefault()) }
                LazyColumn(modifier = Modifier.fillMaxSize()) {
                    items(results, key = { it.id }) { msg ->
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { onResultClick(msg) }
                                .padding(horizontal = 16.dp, vertical = 10.dp)
                        ) {
                            Text(
                                text = msg.senderName ?: "Siz",
                                color = accentBlue,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.SemiBold
                            )
                            Text(
                                text = msg.text.ifBlank { "[Media]" },
                                color = contentColor,
                                fontSize = 14.sp,
                                maxLines = 2,
                                overflow = TextOverflow.Ellipsis,
                                fontFamily = IosEmojiFont
                            )
                            Text(
                                text = timeFormat.format(Date(msg.timestamp)),
                                color = contentColor.copy(alpha = 0.4f),
                                fontSize = 11.sp
                            )
                        }
                        HorizontalDivider(color = contentColor.copy(alpha = 0.06f), thickness = 0.5.dp)
                    }
                }
            }
        }
    }
}








