package com.example.myapplication.ui.home

import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.*
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
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
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
    // Suppress push notifications for the chat that is currently on screen.
    DisposableEffect(userName) {
        com.example.myapplication.push.ActiveScreenTracker.activeChatUserName = userName
        onDispose {
            if (com.example.myapplication.push.ActiveScreenTracker.activeChatUserName == userName) {
                com.example.myapplication.push.ActiveScreenTracker.activeChatUserName = null
            }
        }
    }

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
    var sendBlockedUntilMillis by remember { mutableLongStateOf(0L) }
    var lastSeenSyncAtMillis by remember { mutableLongStateOf(0L) }
    var syncInFlight by remember { mutableStateOf(false) }
    var lastReconnectSyncAtMillis by remember { mutableLongStateOf(0L) }

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
        val isMe = !message.senderName.equals(userName, ignoreCase = true)
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
            when (val conversationResult = chatRepository.findOrCreateConversationWithUserName(userName)) {
                is ChatResult.Error -> {
                    errorText = conversationResult.message
                }
                is ChatResult.Success -> {
                    conversationId = conversationResult.value._id
                }
            }
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
                    itemsIndexed(messages, key = { _, msg -> msg.id }) { index, message ->
                        val isSameDay = if (index < messages.size - 1) {
                            isSameDay(message.timestamp, messages[index + 1].timestamp)
                        } else false

                        Column(modifier = Modifier.fillMaxWidth()) {
                            if (index == messages.size - 1 || !isSameDay) {
                                DateHeader(message.timestamp, isDarkMode)
                            }
                            MessageBubble(message, isDarkMode)
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
                                    glassBg,
                                    glassBg.copy(alpha = 0.8f),
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
                                    targetState = isTyping,
                                    transitionSpec = { fadeIn() togetherWith fadeOut() },
                                    label = "status"
                                ) { typing ->
                                    if (typing) {
                                        Text(text = "yozmoqda...", color = Color(0xFF3478F6), fontSize = 11.sp, fontWeight = FontWeight.Medium)
                                    } else {
                                        Text(text = "online", color = Color(0xFF3478F6), fontSize = 11.sp, fontWeight = FontWeight.Medium)
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
            if (isRequest) {
                RequestActionButtons(isDarkMode, onBack)
            } else {
                Row(
                    modifier = Modifier
                        .padding(horizontal = 12.dp, vertical = 10.dp)
                        .fillMaxWidth()
                        .navigationBarsPadding()
                        .imePadding(),
                    verticalAlignment = Alignment.Bottom,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .animateContentSize()
                            .clip(RoundedCornerShape(24.dp))
                            .background(if (isDarkMode) Color.White.copy(alpha = 0.15f) else Color.White.copy(alpha = 0.85f))
                            .border(0.5.dp, glassBorder, RoundedCornerShape(24.dp))
                            .padding(4.dp)
                    ) {
                        Row(verticalAlignment = Alignment.Bottom) {
                            IconButton(
                                onClick = { 
                                    isMenuOpen = !isMenuOpen 
                                    if (isMenuOpen) scope.launch { scrollToStart() }
                                },
                                modifier = Modifier.size(40.dp)
                            ) {
                                Icon(if (isMenuOpen) Icons.Default.Close else Icons.Default.Add, null, tint = contentColor.copy(0.7f), modifier = Modifier.size(24.dp))
                            }

                            Box(
                                modifier = Modifier
                                    .weight(1f)
                                    .padding(horizontal = 4.dp, vertical = 10.dp),
                                contentAlignment = Alignment.CenterStart
                            ) {
                                if (isMenuOpen) {
                                    AttachmentMenu(contentColor)
                                } else {
                                    val inputTextStyle = TextStyle(color = contentColor, fontSize = 15.sp, lineHeight = 20.sp, fontFamily = IosEmojiFont)
                                    if (messageText.isEmpty()) {
                                        Text(text = "Xabar...", style = inputTextStyle.copy(color = contentColor.copy(0.5f)))
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
                        }
                    }
                    
                                        val canSendNow = System.currentTimeMillis() >= sendBlockedUntilMillis
                    IconButton(
                        onClick = {
                            val targetConversationId = conversationId
                            val trimmedText = messageText.trim()
                            if (trimmedText.isBlank()) return@IconButton
                            if (targetConversationId.isNullOrBlank()) {
                                errorText = "Conversation not ready yet."
                                return@IconButton
                            }
                            if (!canSendNow) {
                                errorText = "Please wait before retrying."
                                return@IconButton
                            }

                            val clientId = "android:${UUID.randomUUID()}"
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
                        },
                        enabled = canSendNow,
                        modifier = Modifier.size(44.dp).clip(CircleShape).background(accentBlue)
                    ) {
                        Icon(Icons.AutoMirrored.Filled.Send, null, tint = Color.White, modifier = Modifier.size(20.dp))
                    }
if (!errorText.isNullOrBlank()) {
                    Text(
                        text = errorText.orEmpty(),
                        color = if (isDarkMode) Color(0xFFFFB4AB) else Color(0xFFB3261E),
                        fontSize = 12.sp,
                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 2.dp)
                    )
                }
            }
        }

        // --- OVERLAYS ---
        AnimatedVisibility(
            visible = showChatInfo,
            enter = slideInVertically(initialOffsetY = { it }) + fadeIn(),
            exit = slideOutVertically(targetOffsetY = { it }) + fadeOut()
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
            enter = slideInVertically(initialOffsetY = { it }) + fadeIn(),
            exit = slideOutVertically(targetOffsetY = { it }) + fadeOut()
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
}

@Composable
fun MessageBubble(message: MessageData, isDarkMode: Boolean) {
    val alignment = if (message.isMe) Alignment.End else Alignment.Start
    val bubbleColor = if (message.isMe) PremiumBlue else (if (isDarkMode) Color(0xFF262626) else Color(0xFFF0F2F0))
    val textColor = if (message.isMe) Color.White else (if (isDarkMode) Color.White else Color.Black)
    val shape = if (message.isMe) {
        RoundedCornerShape(16.dp, 16.dp, 2.dp, 16.dp)
    } else {
        RoundedCornerShape(16.dp, 16.dp, 16.dp, 2.dp)
    }

    val timeFormat = remember { SimpleDateFormat("HH:mm", Locale.getDefault()) }
    val timeString = timeFormat.format(Date(message.timestamp))

    Column(
        modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp), 
        horizontalAlignment = alignment
    ) {
        Surface(
            color = bubbleColor,
            shape = shape,
            modifier = Modifier.widthIn(max = 280.dp)
        ) {
            Box(modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)) {
                Text(
                    text = message.text,
                    color = textColor,
                    fontSize = 15.sp,
                    lineHeight = 19.sp,
                    fontFamily = IosEmojiFont,
                    modifier = Modifier.padding(end = 60.dp)
                )

                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.align(Alignment.BottomEnd)
                ) {
                    Text(text = timeString, color = textColor.copy(alpha = 0.5f), fontSize = 10.sp)
                    if (message.isMe) {
                        Spacer(Modifier.width(3.dp))
                        when (message.status) {
                            MessageStatus.FAILED -> {
                                Icon(
                                    imageVector = Icons.Default.ErrorOutline,
                                    contentDescription = null,
                                    tint = Color(0xFFEF5350),
                                    modifier = Modifier.size(13.dp)
                                )
                            }
                            MessageStatus.SENDING -> {
                                CircularProgressIndicator(
                                    modifier = Modifier.size(12.dp),
                                    strokeWidth = 1.dp,
                                    color = textColor.copy(alpha = 0.7f)
                                )
                            }
                            else -> {
                                Icon(
                                    imageVector = if (message.status == MessageStatus.READ) Icons.Default.DoneAll else Icons.Default.Done,
                                    contentDescription = null,
                                    tint = if (message.status == MessageStatus.READ) Color(0xFF4CAF50) else textColor.copy(alpha = 0.5f),
                                    modifier = Modifier.size(13.dp)
                                )
                            }
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

data class MessageData(
    val id: String,
    val text: String,
    val isMe: Boolean,
    var isNew: Boolean = false,
    val timestamp: Long = System.currentTimeMillis(),
    val status: MessageStatus = MessageStatus.SENT,
    val clientId: String? = null
)









