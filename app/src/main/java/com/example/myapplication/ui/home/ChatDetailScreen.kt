package com.example.myapplication.ui.home

import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.*
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.input.pointer.positionChange
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
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
import com.example.myapplication.data.remote.chat.UiMessageStatus
import com.example.myapplication.data.remote.chat.ChatSocketEvent
import com.example.myapplication.data.remote.chat.ChatSocketManager
import com.example.myapplication.ui.theme.IosEmojiFont
import com.example.myapplication.ui.theme.PremiumBlue
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.*
import kotlin.math.max

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

    var recordMode by remember { mutableStateOf(RecordMode.VOICE) }
    var isRecording by remember { mutableStateOf(false) }
    var isLocked by remember { mutableStateOf(false) }
    var recordSeconds by remember { mutableIntStateOf(0) }
    var recordDragY by remember { mutableFloatStateOf(0f) }
    var flashOn by remember { mutableStateOf(false) }
    val haptic = LocalHapticFeedback.current

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

    if (!isRequest) {
        LaunchedEffect(Unit) {
            while (true) {
                delay(5000)
                isTyping = true
                delay(3000)
                isTyping = false
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
            clientId = message.clientId
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
                messages.clear()
                messages.addAll(cached.map { mapUiToMessageData(it) })
            }
        }

        LaunchedEffect(conversationId, userName) {
            val targetConversationId = conversationId ?: return@LaunchedEffect
            when (val messagesResult = chatRepository.getMessages(targetConversationId)) {
                is ChatResult.Error -> {
                    errorText = messagesResult.message
                }
                is ChatResult.Success -> {
                    chatLocalStore.saveBackendMessages(targetConversationId, messagesResult.value)
                    syncMissingEvents(targetConversationId)
                    errorText = null
                }
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
                                    serverSequence = event.serverSequence
                                )
                            }
                        }

                        is ChatSocketEvent.MessageSeen -> {
                            if (event.conversationId == null || event.conversationId == targetConversationId) {
                                chatLocalStore.markMessageReadByBackendId(event.messageId)
                            }
                        }

                        is ChatSocketEvent.Reconnected -> {
                            val now = System.currentTimeMillis()
                            if (now - lastReconnectSyncAtMillis > 1500L) {
                                lastReconnectSyncAtMillis = now
                                syncMissingEvents(targetConversationId)
                            }
                        }

                        else -> {
                            // no-op for typing/unknown in this phase
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
    }

    val listState = rememberLazyListState()
    val scope = rememberCoroutineScope()

    val scrollToStart = suspend {
        if (messages.isNotEmpty()) {
            delay(100)
            listState.animateScrollToItem(0)
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
                        val isNewMessage = message.isMe && message.clientId != null && newMessageIds.value.contains(message.clientId)
                        var bubbleVisible by remember(stableKey) { mutableStateOf(!isNewMessage) }

                        LaunchedEffect(stableKey) {
                            if (isNewMessage) {
                                bubbleVisible = true
                                delay(700)
                                newMessageIds.value = newMessageIds.value - message.clientId!!
                            }
                        }

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
                                ) + fadeIn(tween(180, easing = FastOutSlowInEasing))
                            ) {
                                Column(modifier = Modifier.fillMaxWidth()) {
                                    if (showDateHeader) {
                                        DateHeader(message.timestamp, isDarkMode)
                                    }
                                    MessageBubble(message, isDarkMode, isFirstInGroup, isLastInGroup)
                                }
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
                                        "typing" -> Text(text = "yozmoqda...", color = Color(0xFF3478F6), fontSize = 11.sp, fontWeight = FontWeight.Medium)
                                        else -> Text(text = "online", color = Color(0xFF3478F6), fontSize = 11.sp, fontWeight = FontWeight.Medium)
                                    }
                                }
                            }
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

                    val clientId = "android:${UUID.randomUUID()}"
                    newMessageIds.value = newMessageIds.value + clientId
                    messageText = ""
                    isMenuOpen = false
                    scope.launch { scrollToStart() }

                    scope.launch {
                        val now = System.currentTimeMillis()
                        chatLocalStore.saveOptimisticMessage(
                            conversationId = targetConversationId,
                            clientId = clientId,
                            senderId = "me",
                            text = trimmedText,
                            nowMillis = now
                        )

                        when (val sendResult = chatRepository.sendTextMessage(targetConversationId, trimmedText, clientId)) {
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

                val finishRecording: (Boolean) -> Unit = { send ->
                    isRecording = false
                    isLocked = false
                    recordDragY = 0f
                    flashOn = false
                    if (send && recordSeconds > 0) {
                        haptic.performHapticFeedback(HapticFeedbackType.LongPress)
                    }
                }

                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .navigationBarsPadding()
                        .imePadding()
                ) {
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
                                                    AttachmentMenu(contentColor)
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
                                    Box(
                                        modifier = Modifier
                                            .size(42.dp)
                                            .clip(CircleShape)
                                            .background(accentBlue)
                                            .clickable(onClick = sendTextMessage),
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
                                            isRecording = true
                                            recordDragY = 0f
                                            haptic.performHapticFeedback(HapticFeedbackType.LongPress)
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

        // --- CALL OVERLAYS ---
        if (showVoiceCall) {
            VoiceCallScreen(userName = userName, onHangUp = { showVoiceCall = false })
        }
        if (showVideoCall) {
            VideoCallScreen(userName = userName, onHangUp = { showVideoCall = false })
        }
    }
}

@Composable
fun MessageBubble(
    message: MessageData,
    isDarkMode: Boolean,
    isFirstInGroup: Boolean = true,
    isLastInGroup: Boolean = true
) {
    val alignment = if (message.isMe) Alignment.End else Alignment.Start
    val bubbleColor = if (message.isMe) PremiumBlue else (if (isDarkMode) Color(0xFF262626) else Color(0xFFF0F2F0))
    val textColor = if (message.isMe) Color.White else (if (isDarkMode) Color.White else Color.Black)

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
        Surface(
            color = bubbleColor,
            shape = shape,
            modifier = Modifier.widthIn(max = 280.dp)
        ) {
            Column(modifier = Modifier.padding(start = 12.dp, end = 12.dp, top = 8.dp, bottom = 6.dp)) {
                Text(
                    text = message.text,
                    color = textColor,
                    fontSize = 15.sp,
                    lineHeight = 20.sp,
                    fontFamily = IosEmojiFont
                )
                Row(
                    modifier = Modifier
                        .align(Alignment.End)
                        .padding(top = 2.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(3.dp)
                ) {
                    Text(text = timeString, color = textColor.copy(alpha = 0.5f), fontSize = 10.sp)
                    if (message.isMe) {
                        when (message.status) {
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

@Composable
fun AttachmentMenu(contentColor: Color) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceEvenly,
        verticalAlignment = Alignment.CenterVertically
    ) {
        AttachmentItem(Icons.Default.Image, "Galereya", contentColor)
        AttachmentItem(Icons.Default.Description, "File", contentColor)
        AttachmentItem(Icons.Default.MusicNote, "Music", contentColor)
        AttachmentItem(Icons.Default.LocationOn, "Location", contentColor)
    }
}

@Composable
fun AttachmentItem(icon: ImageVector, label: String, contentColor: Color) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
        modifier = Modifier.clickable(interactionSource = remember { MutableInteractionSource() }, indication = null) { }
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
    val clientId: String? = null
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

private fun lerpColor(start: Color, end: Color, t: Float): Color {
    val c = t.coerceIn(0f, 1f)
    return Color(
        red = start.red + (end.red - start.red) * c,
        green = start.green + (end.green - start.green) * c,
        blue = start.blue + (end.blue - start.blue) * c,
        alpha = start.alpha + (end.alpha - start.alpha) * c
    )
}









