package com.example.myapplication.ui.home

import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Chat
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInRoot
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.myapplication.ui.theme.*
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.*

// Messages bo'limi uchun kerakli enum va data class'lar
enum class NoteModalType { NONE, CREATE, VIEW_REPLY, MANAGE_OWN }

@Composable
fun MessagesScreen(
    isDarkMode: Boolean, 
    onBack: () -> Unit,
    onNavigateToChat: (String, Boolean) -> Unit,
    onNavigateToGroupChat: (String) -> Unit
) {
    // Fon rangi: Kechasi to'q, kunduzi oq (F2F2F2)
    val backgroundColor = if (isDarkMode) Color(0xFF0F0F0F) else Color(0xFFF2F2F2)
    val contentColor = if (isDarkMode) Color.White else Color.Black
    val secondaryContentColor = contentColor.copy(alpha = 0.6f)
    val accentBlue = Color(0xFF00A3FF)

    var selectedSection by remember { mutableIntStateOf(0) }
    var myNote by remember { mutableStateOf<String?>(null) }
    var modalType by remember { mutableStateOf(NoteModalType.NONE) }
    var selectedNoteData by remember { mutableStateOf<NoteItemData?>(null) }
    var clickedNoteOffset by remember { mutableStateOf(Offset.Zero) }

    val scope = rememberCoroutineScope()

    val notes = remember(myNote) {
        listOf(
            NoteItemData("Me", myNote, isMe = true),
            NoteItemData("Sardor", "Bugun darsga borasizlarmi? ☀️"),
            NoteItemData("Malika", "Yangi rasm qo'ydim, ko'ringlar!"),
            NoteItemData("Jasur", "Futbol bugun soat 20:00 da"),
            NoteItemData("Nilufar", "Uyga vazifa nima ekan?")
        )
    }

    val chats = remember {
        listOf(
            ChatMessage(1, "Shahzod", "Ertaga soat nechada ko'rishamiz?", "27m", unreadCount = 0),
            ChatMessage(2, "Madina", "Rahmat kattakon! 😊", "4h", unreadCount = 1),
            ChatMessage(3, "Ruslan", "Video yubordim, ko'rdingmi?", "59m"),
            ChatMessage(4, "Islombek", "Loyihani tugatdim.", "1h"),
            ChatMessage(5, "Lola", "Salom, qandaysiz?", "4h", unreadCount = 1)
        )
    }

    val groups = remember {
        listOf(
            GroupChat(1, "IT Hamjamiyati 🚀", "Jahongir: Yangi UI tayyor!", "12:45", 5),
            GroupChat(2, "Dizaynerlar Guruhi 🎨", "Ali: Logo dizaynini ko'ringlar", "10:30", 0),
            GroupChat(3, "Stugram Rasmiy", "Admin: Yangi yangilanish chiqdi!", "Echa", 12)
        )
    }

    val requests = remember {
        listOf(
            ChatMessage(101, "Azamat", "Salom! Men sizni follow qildim...", "12:00", unreadCount = 1)
        )
    }

    Box(modifier = Modifier.fillMaxSize().background(backgroundColor)) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .statusBarsPadding()
        ) {
            // Top Bar
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(onClick = onBack) {
                    Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back", tint = accentBlue)
                }
                
                var searchQuery by remember { mutableStateOf("") }
                OutlinedTextField(
                    value = searchQuery,
                    onValueChange = { searchQuery = it },
                    placeholder = { Text("Search messages...", color = secondaryContentColor.copy(0.5f)) },
                    leadingIcon = { Icon(Icons.Default.Search, null, tint = secondaryContentColor, modifier = Modifier.size(18.dp)) },
                    modifier = Modifier
                        .weight(1f)
                        .height(48.dp),
                    shape = RoundedCornerShape(12.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedContainerColor = contentColor.copy(alpha = 0.05f),
                        unfocusedContainerColor = contentColor.copy(alpha = 0.05f),
                        focusedBorderColor = accentBlue,
                        unfocusedBorderColor = Color.Transparent
                    ),
                    singleLine = true,
                    textStyle = LocalTextStyle.current.copy(fontSize = 15.sp, color = contentColor)
                )
            }

            // Notes Section
            LazyRow(
                modifier = Modifier.fillMaxWidth(),
                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                items(notes) { noteData ->
                    NoteItem(
                        noteData = noteData,
                        isDarkMode = isDarkMode,
                        onClick = { offset ->
                            clickedNoteOffset = offset
                            selectedNoteData = noteData
                            if (noteData.isMe) {
                                modalType = if (noteData.note == null) NoteModalType.CREATE else NoteModalType.MANAGE_OWN
                            } else {
                                modalType = NoteModalType.VIEW_REPLY
                            }
                        }
                    )
                }
            }

            Spacer(Modifier.height(8.dp))

            // Header
            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text("Messages", color = accentBlue, fontSize = 16.sp, fontWeight = FontWeight.Bold)
            }

            // Custom Tab Selector
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 12.dp)
                    .height(40.dp)
                    .clip(RoundedCornerShape(20.dp))
                    .background(contentColor.copy(alpha = 0.08f))
                    .border(0.5.dp, contentColor.copy(0.1f), RoundedCornerShape(20.dp))
            ) {
                val configuration = LocalConfiguration.current
                val screenWidth = configuration.screenWidthDp.dp
                val tabWidth = (screenWidth - 32.dp) / 3

                val indicatorOffset by animateDpAsState(
                    targetValue = tabWidth * selectedSection,
                    animationSpec = spring(dampingRatio = 0.85f, stiffness = 400f),
                    label = "indicator"
                )

                Box(
                    modifier = Modifier
                        .offset(x = indicatorOffset)
                        .width(tabWidth)
                        .fillMaxHeight()
                        .padding(2.dp)
                        .clip(RoundedCornerShape(18.dp))
                        .background(accentBlue)
                )

                Row(modifier = Modifier.fillMaxSize()) {
                    val sections = listOf("Xabarlar", "Guruhlar", "So'rovlar")
                    sections.forEachIndexed { index, title ->
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .fillMaxHeight()
                                .clickable(
                                    interactionSource = remember { MutableInteractionSource() },
                                    indication = null,
                                    onClick = { selectedSection = index }
                                ),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = title,
                                color = if (selectedSection == index) Color.White else Color.Gray,
                                fontSize = 13.sp,
                                fontWeight = if (selectedSection == index) FontWeight.Bold else FontWeight.Medium
                            )
                        }
                    }
                }
            }

            // Section Content
            Box(modifier = Modifier.weight(1f)) {
                AnimatedContent(
                    targetState = selectedSection,
                    transitionSpec = {
                        if (targetState > initialState) {
                            (slideInHorizontally { width -> width } + fadeIn()).togetherWith(
                                slideOutHorizontally { width -> -width } + fadeOut())
                        } else {
                            (slideInHorizontally { width -> -width } + fadeIn()).togetherWith(
                                slideOutHorizontally { width -> width } + fadeOut())
                        }.using(SizeTransform(clip = false))
                    },
                    label = "section_slide"
                ) { targetPage ->
                    when (targetPage) {
                        0 -> {
                            LazyColumn(modifier = Modifier.fillMaxSize(), contentPadding = PaddingValues(bottom = 80.dp)) {
                                items(chats, key = { it.id }) { chat ->
                                    ChatItem(chat, contentColor, secondaryContentColor, accentBlue) { name ->
                                        onNavigateToChat(name, false)
                                    }
                                }
                            }
                        }
                        1 -> {
                            LazyColumn(modifier = Modifier.fillMaxSize(), contentPadding = PaddingValues(bottom = 80.dp)) {
                                items(groups, key = { it.id }) { group ->
                                    GroupChatItem(group, contentColor, secondaryContentColor, accentBlue, onNavigateToGroupChat)
                                }
                            }
                        }
                        2 -> {
                            LazyColumn(modifier = Modifier.fillMaxSize(), contentPadding = PaddingValues(bottom = 80.dp)) {
                                items(requests, key = { it.id }) { request ->
                                    ChatItem(request, contentColor, secondaryContentColor, accentBlue) { name ->
                                        onNavigateToChat(name, true)
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        // Modals Overlay
        val isVisible = modalType != NoteModalType.NONE
        AnimatedVisibility(
            visible = isVisible,
            enter = fadeIn(),
            exit = fadeOut()
        ) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Color.Black.copy(alpha = 0.5f))
                    .clickable { modalType = NoteModalType.NONE },
                contentAlignment = Alignment.BottomCenter
            ) {
                AnimatedVisibility(
                    visible = isVisible,
                    enter = slideInVertically(initialOffsetY = { it }) + fadeIn(),
                    exit = slideOutVertically(targetOffsetY = { it }) + fadeOut(),
                    modifier = Modifier.padding(bottom = 100.dp)
                ) {
                    Box(modifier = Modifier.clickable(enabled = false) {}) {
                        when (modalType) {
                            NoteModalType.CREATE -> CreateNoteScreen(
                                isDarkMode, myNote, 
                                onDismiss = { modalType = NoteModalType.NONE },
                                onShare = { 
                                    myNote = it
                                    modalType = NoteModalType.NONE 
                                }
                            )
                            NoteModalType.VIEW_REPLY -> ReplyNoteModal(
                                isDarkMode, selectedNoteData,
                                onDismiss = { modalType = NoteModalType.NONE }
                            )
                            NoteModalType.MANAGE_OWN -> ManageNoteModal(
                                isDarkMode, 
                                noteText = myNote ?: "",
                                onDismiss = { modalType = NoteModalType.NONE },
                                onLeaveNew = { modalType = NoteModalType.CREATE },
                                onDelete = { 
                                    myNote = null
                                    modalType = NoteModalType.NONE 
                                }
                            )
                            else -> {}
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun NoteItem(noteData: NoteItemData, isDarkMode: Boolean, onClick: (Offset) -> Unit) {
    val contentColor = if (isDarkMode) Color.White else Color.Black
    val bubbleBg = (if (isDarkMode) Color(0xFF262626) else Color.White).copy(alpha = 0.9f)
    val accentBlue = Color(0xFF00A3FF)
    var currentOffset by remember { mutableStateOf(Offset.Zero) }

    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier
            .width(85.dp)
            .onGloballyPositioned { coordinates ->
                currentOffset = coordinates.positionInRoot()
            }
            .clickable(
                interactionSource = remember { MutableInteractionSource() },
                indication = null,
                onClick = { onClick(currentOffset) }
            )
    ) {
        Box(contentAlignment = Alignment.TopCenter, modifier = Modifier.height(100.dp)) {
            Surface(
                modifier = Modifier.align(Alignment.BottomCenter).size(70.dp),
                shape = CircleShape,
                color = if (isDarkMode) Color(0xFF262626) else Color(0xFFE5E5E5),
                border = BorderStroke(0.5.dp, contentColor.copy(0.1f))
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Icon(Icons.Default.Person, null, modifier = Modifier.size(40.dp), tint = contentColor.copy(0.2f))
                }
            }

            if (noteData.note != null) {
                Surface(
                    modifier = Modifier.align(Alignment.TopCenter).padding(bottom = 2.dp).widthIn(max = 85.dp),
                    shape = RoundedCornerShape(16.dp),
                    color = bubbleBg,
                    border = BorderStroke(0.5.dp, contentColor.copy(0.1f)),
                    shadowElevation = 4.dp
                ) {
                    Text(
                        text = noteData.note, color = contentColor, fontSize = 11.sp,
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                        maxLines = 2, textAlign = TextAlign.Center, lineHeight = 13.sp, overflow = TextOverflow.Ellipsis
                    )
                }
            } else if (noteData.isMe) {
                Box(
                    modifier = Modifier
                        .align(Alignment.BottomEnd)
                        .offset(x = (-4).dp, y = (-4).dp)
                        .size(24.dp)
                        .background(accentBlue, CircleShape)
                        .border(2.dp, if (isDarkMode) Color(0xFF0F0F0F) else Color.White, CircleShape),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(Icons.Default.Add, null, tint = Color.White, modifier = Modifier.size(16.dp))
                }
            }
        }
        Text(
            text = if (noteData.isMe) "Your note" else noteData.name,
            color = contentColor.copy(0.6f), fontSize = 11.sp, modifier = Modifier.padding(top = 4.dp),
            maxLines = 1, overflow = TextOverflow.Ellipsis
        )
    }
}

@Composable
fun ReplyNoteModal(isDarkMode: Boolean, data: NoteItemData?, onDismiss: () -> Unit) {
    val bgColor = (if (isDarkMode) Color(0xFF262626) else Color.White).copy(alpha = 0.95f)
    val contentColor = if (isDarkMode) Color.White else Color.Black
    var replyText by remember { mutableStateOf("") }

    Column(
        modifier = Modifier
            .fillMaxWidth(0.94f)
            .clip(RoundedCornerShape(24.dp))
            .background(bgColor)
            .border(
                1.dp, 
                Brush.verticalGradient(listOf(contentColor.copy(0.1f), Color.Transparent)), 
                RoundedCornerShape(24.dp)
            )
            .padding(20.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Box(modifier = Modifier.width(40.dp).height(4.dp).clip(CircleShape).background(Color.Gray.copy(0.3f)))
        Spacer(Modifier.height(20.dp))
        Text(text = data?.name ?: "", color = contentColor, fontWeight = FontWeight.Bold, fontSize = 14.sp)
        Spacer(Modifier.height(16.dp))
        
        Row(verticalAlignment = Alignment.CenterVertically) {
            Surface(modifier = Modifier.size(60.dp), shape = CircleShape, color = contentColor.copy(0.05f)) {
                Icon(Icons.Default.Person, null, modifier = Modifier.padding(15.dp), tint = contentColor.copy(0.2f))
            }
            Spacer(Modifier.width(12.dp))
            Surface(
                shape = RoundedCornerShape(16.dp), 
                color = contentColor.copy(0.05f),
                border = BorderStroke(0.5.dp, contentColor.copy(0.1f))
            ) {
                Column(Modifier.padding(12.dp)) {
                    Text(text = data?.note ?: "", color = contentColor, fontSize = 14.sp)
                    Text(text = "See translation", color = Color.Gray, fontSize = 11.sp, modifier = Modifier.padding(top = 4.dp))
                }
            }
        }
        
        Spacer(Modifier.height(24.dp))
        
        OutlinedTextField(
            value = replyText, 
            onValueChange = { replyText = it },
            placeholder = { 
                Text("Reply to ${data?.name}...", color = Color.Gray, modifier = Modifier.fillMaxWidth(), textAlign = TextAlign.Center, fontSize = 14.sp) 
            },
            modifier = Modifier.fillMaxWidth().height(52.dp),
            shape = RoundedCornerShape(26.dp),
            trailingIcon = {
                if (replyText.isNotEmpty()) {
                    IconButton(onClick = { onDismiss() }) {
                        Icon(Icons.AutoMirrored.Filled.Send, null, tint = Color(0xFF00A3FF), modifier = Modifier.size(20.dp))
                    }
                }
            },
            colors = OutlinedTextFieldDefaults.colors(
                focusedContainerColor = contentColor.copy(0.05f),
                unfocusedContainerColor = contentColor.copy(0.05f),
                focusedBorderColor = Color.Transparent,
                unfocusedBorderColor = Color.Transparent,
                focusedTextColor = contentColor
            ),
            singleLine = true,
            textStyle = LocalTextStyle.current.copy(textAlign = TextAlign.Center, fontSize = 14.sp, color = contentColor)
        )
        Spacer(Modifier.height(12.dp))
    }
}

@Composable
fun ManageNoteModal(isDarkMode: Boolean, noteText: String, onDismiss: () -> Unit, onLeaveNew: () -> Unit, onDelete: () -> Unit) {
    val bgColor = (if (isDarkMode) Color(0xFF262626) else Color.White).copy(alpha = 0.95f)
    val contentColor = if (isDarkMode) Color.White else Color.Black

    Column(
        modifier = Modifier
            .fillMaxWidth(0.92f)
            .clip(RoundedCornerShape(24.dp))
            .background(bgColor)
            .border(1.dp, contentColor.copy(0.1f), RoundedCornerShape(24.dp))
            .padding(bottom = 24.dp, top = 12.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Box(modifier = Modifier.width(40.dp).height(4.dp).clip(CircleShape).background(Color.Gray.copy(0.3f)))
        Spacer(Modifier.height(24.dp))
        
        Box(contentAlignment = Alignment.TopCenter, modifier = Modifier.height(120.dp)) {
            Surface(modifier = Modifier.align(Alignment.BottomCenter).size(80.dp), shape = CircleShape, color = contentColor.copy(0.05f)) {
                Icon(Icons.Default.Person, null, modifier = Modifier.padding(20.dp), tint = contentColor.copy(0.2f))
            }
            Surface(
                modifier = Modifier.align(Alignment.TopCenter).widthIn(min = 100.dp, max = 220.dp),
                shape = RoundedCornerShape(20.dp), 
                color = if (isDarkMode) Color.Black.copy(0.3f) else Color.White, 
                border = BorderStroke(0.5.dp, contentColor.copy(0.1f)),
                shadowElevation = 8.dp
            ) {
                Box(modifier = Modifier.padding(12.dp), contentAlignment = Alignment.Center) {
                    Text(noteText, color = contentColor, textAlign = TextAlign.Center, fontSize = 14.sp)
                }
            }
        }
        
        Spacer(Modifier.height(16.dp))
        Text("Shared with friends · Now", color = Color.Gray, fontSize = 13.sp)
        Spacer(Modifier.height(24.dp))
        Button(
            onClick = onLeaveNew,
            modifier = Modifier.fillMaxWidth(0.85f).height(48.dp),
            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF3797EF)),
            shape = RoundedCornerShape(12.dp)
        ) {
            Text("Leave a new note", fontWeight = FontWeight.Bold, color = Color.White)
        }
        TextButton(onClick = onDelete, modifier = Modifier.padding(top = 8.dp)) {
            Text("Delete note", color = Color.Red, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
fun CreateNoteScreen(isDarkMode: Boolean, currentNote: String?, onDismiss: () -> Unit, onShare: (String) -> Unit) {
    var noteText by remember { mutableStateOf(currentNote ?: "") }
    val contentColor = if (isDarkMode) Color.White else Color.Black
    val bgColor = (if (isDarkMode) Color(0xFF262626) else Color.White).copy(alpha = 0.95f)

    Column(
        modifier = Modifier
            .fillMaxWidth(0.92f)
            .clip(RoundedCornerShape(28.dp))
            .background(bgColor)
            .border(1.dp, contentColor.copy(0.1f), RoundedCornerShape(28.dp))
            .padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = onDismiss) { Icon(Icons.Default.Close, null, tint = contentColor) }
            Button(
                onClick = { onShare(noteText) },
                colors = ButtonDefaults.buttonColors(containerColor = if (noteText.isNotEmpty()) Color(0xFF3797EF) else Color.Gray.copy(0.2f)),
                shape = RoundedCornerShape(20.dp), modifier = Modifier.height(36.dp)
            ) { Text("Share", fontWeight = FontWeight.Bold, color = Color.White) }
        }
        Spacer(Modifier.height(30.dp))
        Box(contentAlignment = Alignment.TopCenter, modifier = Modifier.height(120.dp)) {
            Surface(modifier = Modifier.align(Alignment.BottomCenter).size(80.dp), shape = CircleShape, color = contentColor.copy(0.05f)) {
                Icon(Icons.Default.Person, null, modifier = Modifier.padding(20.dp), tint = contentColor.copy(0.2f))
            }
            Surface(
                modifier = Modifier.align(Alignment.TopCenter).widthIn(min = 100.dp, max = 220.dp),
                shape = RoundedCornerShape(20.dp), 
                color = if (isDarkMode) Color.Black.copy(0.3f) else Color.White, 
                border = BorderStroke(0.5.dp, contentColor.copy(0.1f)),
                shadowElevation = 8.dp
            ) {
                Box(modifier = Modifier.padding(12.dp), contentAlignment = Alignment.Center) {
                    Text(if (noteText.isEmpty()) "Share a thought..." else noteText, color = if (noteText.isEmpty()) Color.Gray else contentColor, textAlign = TextAlign.Center, fontSize = 14.sp)
                }
            }
        }
        Spacer(Modifier.height(20.dp))
        TextField(
            value = noteText, onValueChange = { if (it.length <= 60) noteText = it },
            placeholder = { Text("What's on your mind?", color = Color.Gray, modifier = Modifier.fillMaxWidth(), textAlign = TextAlign.Center) },
            colors = TextFieldDefaults.colors(focusedContainerColor = Color.Transparent, unfocusedContainerColor = Color.Transparent, focusedIndicatorColor = Color.Transparent, unfocusedIndicatorColor = Color.Transparent, cursorColor = Color(0xFF3797EF), focusedTextColor = contentColor),
            modifier = Modifier.fillMaxWidth(), textStyle = LocalTextStyle.current.copy(textAlign = TextAlign.Center, fontSize = 16.sp, color = contentColor)
        )
        Text("${noteText.length}/60", color = Color.Gray, fontSize = 11.sp)
    }
}

@Composable
fun ChatItem(chat: ChatMessage, contentColor: Color, secondaryColor: Color, accent: Color, onChatClick: (String) -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth().clickable { onChatClick(chat.name) }.padding(horizontal = 24.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Surface(modifier = Modifier.size(56.dp), shape = CircleShape, color = secondaryColor.copy(0.1f)) {
            Icon(Icons.Default.Person, null, modifier = Modifier.padding(12.dp), tint = secondaryColor.copy(0.3f))
        }
        Column(modifier = Modifier.weight(1f).padding(horizontal = 16.dp)) {
            Text(chat.name, color = contentColor, fontWeight = FontWeight.Bold, fontSize = 14.sp)
            Text(chat.lastMessage, color = if (chat.unreadCount > 0) contentColor else secondaryColor, fontSize = 13.sp, maxLines = 1, fontWeight = if (chat.unreadCount > 0) FontWeight.SemiBold else FontWeight.Normal)
        }
        Column(horizontalAlignment = Alignment.End) {
            Text(chat.time, color = accent, fontSize = 11.sp)
            if (chat.unreadCount > 0) Box(modifier = Modifier.padding(top = 4.dp).size(8.dp).background(accent, CircleShape))
        }
    }
}

@Composable
fun GroupChatItem(
    group: GroupChat, 
    contentColor: Color, 
    secondaryColor: Color, 
    accent: Color,
    onGroupClick: (String) -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onGroupClick(group.name) }
            .padding(horizontal = 24.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(modifier = Modifier.size(56.dp)) {
            Surface(modifier = Modifier.fillMaxSize(), shape = RoundedCornerShape(16.dp), color = accent.copy(alpha = 0.1f)) {
                Icon(Icons.Default.Groups, null, modifier = Modifier.padding(12.dp), tint = accent)
            }
        }
        Column(modifier = Modifier.weight(1f).padding(horizontal = 16.dp)) {
            Text(group.name, color = contentColor, fontWeight = FontWeight.Bold, fontSize = 14.sp)
            Text(group.lastMessage, color = secondaryColor, fontSize = 13.sp, maxLines = 1)
        }
        Column(horizontalAlignment = Alignment.End) {
            Text(group.time, color = accent, fontSize = 11.sp)
            if (group.unreadCount > 0) {
                Surface(
                    color = accent,
                    shape = CircleShape,
                    modifier = Modifier.padding(top = 4.dp)
                ) {
                    Text(
                        text = group.unreadCount.toString(),
                        color = Color.White,
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                    )
                }
            }
        }
    }
}

// Data class'lar
data class NoteItemData(val name: String, val note: String? = null, val isMe: Boolean = false)
data class ChatMessage(val id: Int, val name: String, val lastMessage: String, val time: String, val unreadCount: Int = 0)
data class GroupChat(val id: Int, val name: String, val lastMessage: String, val time: String, val unreadCount: Int = 0)
