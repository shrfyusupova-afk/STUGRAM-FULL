package com.example.myapplication.ui.home

import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.*
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.myapplication.R
import com.example.myapplication.ui.theme.IosEmojiFont
import com.example.myapplication.ui.theme.PremiumBlue
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.*

@Composable
fun GroupChatDetailScreen(
    groupName: String,
    isDarkMode: Boolean,
    onBack: () -> Unit
) {
    val backgroundColor = if (isDarkMode) Color.Black else Color.White
    val contentColor = if (isDarkMode) Color.White else Color.Black
    val accentBlue = Color(0xFF00A3FF)
    
    val glassBorder = if (isDarkMode) Color.White.copy(alpha = 0.1f) else Color.Black.copy(0.05f)

    val statusBarHeight = WindowInsets.statusBars.asPaddingValues().calculateTopPadding()
    val headerContentHeight = 70.dp 
    val totalHeaderHeight = statusBarHeight + headerContentHeight

    val backgroundImage = if (isDarkMode) {
        painterResource(id = R.drawable.tun)
    } else {
        painterResource(id = R.drawable.kun)
    }

    var messageText by remember { mutableStateOf("") }
    var showGroupInfo by remember { mutableStateOf(false) }
    val groupChatBackendReady = false // TODO: wire group chat endpoints before enabling send.

    val messages = remember {
        mutableStateListOf(
            GroupMessageData(4, "Ajoyib! Omad tilayman hamma loyihalarga. 👍", "Botir", true),
            GroupMessageData(3, "Zo'r, yangi loyiha ustida ishlayapman. 🔥", "Ali", false),
            GroupMessageData(2, "Yaxshi, rahmat. O'zingizchi?", "Vali", false),
            GroupMessageData(1, "Salom hamma! Qandaysizlar?", "Ali", false)
        )
    }

    val listState = rememberLazyListState()

    Box(modifier = Modifier.fillMaxSize().background(backgroundColor)) {
        Image(
            painter = backgroundImage,
            contentDescription = null,
            modifier = Modifier.fillMaxSize(),
            contentScale = ContentScale.Crop
        )

        Column(modifier = Modifier.fillMaxSize()) {
            Box(modifier = Modifier.fillMaxWidth().weight(1f)) {
                LazyColumn(
                    state = listState,
                    modifier = Modifier.fillMaxSize(),
                    reverseLayout = true,
                    contentPadding = PaddingValues(start = 12.dp, end = 12.dp, top = totalHeaderHeight + 10.dp, bottom = 12.dp)
                ) {
                    itemsIndexed(messages, key = { _, msg -> msg.id }) { index, message ->
                        GroupMessageBubble(message, isDarkMode, true, true, accentBlue)
                    }
                }

                // --- HEADER ---
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .statusBarsPadding()
                        .height(headerContentHeight)
                        .padding(horizontal = 16.dp, vertical = 8.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Box(
                        modifier = Modifier
                            .align(Alignment.CenterStart)
                            .size(44.dp)
                            .clip(CircleShape)
                            .background(Color.Black.copy(0.4f))
                            .clickable { onBack() },
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, null, tint = Color.White, modifier = Modifier.size(22.dp))
                    }

                    Surface(
                        modifier = Modifier
                            .fillMaxHeight()
                            .widthIn(min = 180.dp, max = 250.dp)
                            .clickable { showGroupInfo = true },
                        shape = RoundedCornerShape(30.dp),
                        color = Color.Black.copy(alpha = 0.6f),
                        border = BorderStroke(0.5.dp, Color.White.copy(0.2f))
                    ) {
                        Column(
                            modifier = Modifier.padding(horizontal = 20.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.Center
                        ) {
                            Text(
                                text = groupName, 
                                color = Color.White, 
                                fontWeight = FontWeight.Bold, 
                                fontSize = 15.sp,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                            Text(
                                text = "12 ta a'zo, 5 tasi online", 
                                color = Color(0xFF00A3FF), 
                                fontSize = 11.sp, 
                                fontWeight = FontWeight.Medium
                            )
                        }
                    }

                    Box(
                        modifier = Modifier
                            .align(Alignment.CenterEnd)
                            .size(44.dp)
                            .clip(CircleShape)
                            .background(Color.Black.copy(0.4f))
                            .clickable { showGroupInfo = true },
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(Icons.Default.Groups, null, tint = Color.White.copy(0.8f), modifier = Modifier.size(24.dp))
                    }
                }
            }

            // --- INPUT AREA ---
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
                        .clip(RoundedCornerShape(24.dp))
                        .background(if (isDarkMode) Color.White.copy(0.15f) else Color.White.copy(0.9f))
                        .border(0.5.dp, glassBorder, RoundedCornerShape(24.dp))
                        .padding(horizontal = 12.dp, vertical = 8.dp)
                ) {
                    BasicTextField(
                        value = messageText,
                        onValueChange = { messageText = it },
                        modifier = Modifier.fillMaxWidth(),
                        textStyle = TextStyle(color = contentColor, fontSize = 15.sp),
                        decorationBox = { innerTextField ->
                            if (messageText.isEmpty()) Text("Xabar yozing...", color = contentColor.copy(0.5f), fontSize = 15.sp)
                            innerTextField()
                        }
                    )
                }
                
                IconButton(
                    onClick = { /* TODO: enable after backend group endpoint integration */ },
                    enabled = groupChatBackendReady,
                    modifier = Modifier
                        .size(48.dp)
                        .background(accentBlue, CircleShape)
                ) {
                    Icon(Icons.AutoMirrored.Filled.Send, null, tint = Color.White)
                }
            }
        }

        AnimatedVisibility(visible = showGroupInfo, enter = slideInVertically(initialOffsetY = { it }) + fadeIn(), exit = slideOutVertically(targetOffsetY = { it }) + fadeOut()) {
            GroupInfoScreen(groupName = groupName, isDarkMode = isDarkMode, onBack = { showGroupInfo = false })
        }
    }
}

@Composable
private fun GroupMessageBubble(message: GroupMessageData, isDarkMode: Boolean, showName: Boolean, showAvatar: Boolean, accentBlue: Color) {
    val alignment = if (message.isMe) Alignment.End else Alignment.Start
    val bubbleColor = if (message.isMe) PremiumBlue else (if (isDarkMode) Color(0xFF262626) else Color(0xFFF0F0F0))
    val textColor = if (message.isMe) Color.White else (if (isDarkMode) Color.White else Color.Black)
    val shape = if (message.isMe) { RoundedCornerShape(16.dp, 16.dp, 2.dp, 16.dp) } else { RoundedCornerShape(16.dp, 16.dp, 16.dp, 2.dp) }

    Column(modifier = Modifier.fillMaxWidth().padding(vertical = 2.dp), horizontalAlignment = alignment) {
        Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = if (message.isMe) Arrangement.End else Arrangement.Start) {
            if (!message.isMe) {
                Surface(modifier = Modifier.size(28.dp), shape = CircleShape, color = Color.Gray.copy(0.2f)) {
                    Icon(Icons.Default.Person, null, modifier = Modifier.padding(6.dp), tint = Color.Gray)
                }
                Spacer(Modifier.width(6.dp))
            }
            Column(horizontalAlignment = alignment) {
                if (showName && !message.isMe) { 
                    Text(message.senderName, color = (if (isDarkMode) Color.White else Color.Black).copy(0.6f), fontSize = 11.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(start = 4.dp, bottom = 2.dp)) 
                }
                Surface(color = bubbleColor, shape = shape) {
                    Text(text = message.text, color = textColor, fontSize = 15.sp, modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp))
                }
            }
        }
    }
}

@Composable
private fun GroupInfoScreen(groupName: String, isDarkMode: Boolean, onBack: () -> Unit) {
    val backgroundColor = if (isDarkMode) Color(0xFF0F0F0F) else Color.White
    val contentColor = if (isDarkMode) Color.White else Color.Black
    Column(modifier = Modifier.fillMaxSize().background(backgroundColor).statusBarsPadding()) {
        Box(modifier = Modifier.fillMaxWidth().padding(16.dp)) { IconButton(onClick = onBack, modifier = Modifier.align(Alignment.CenterStart)) { Icon(Icons.AutoMirrored.Filled.ArrowBack, null, tint = contentColor) } }
        Column(modifier = Modifier.fillMaxWidth().weight(1f).verticalScroll(rememberScrollState()), horizontalAlignment = Alignment.CenterHorizontally) {
            Box(modifier = Modifier.size(100.dp).clip(CircleShape).background(contentColor.copy(0.1f)), contentAlignment = Alignment.Center) { Icon(Icons.Default.Groups, null, modifier = Modifier.size(60.dp), tint = contentColor.copy(0.4f)) }
            Spacer(modifier = Modifier.height(16.dp))
            Text(text = groupName, color = contentColor, fontSize = 22.sp, fontWeight = FontWeight.Bold)
            Text(text = "12 ta a'zo", color = contentColor.copy(0.5f), fontSize = 14.sp)
            Spacer(modifier = Modifier.height(32.dp))
            Column(modifier = Modifier.fillMaxWidth().padding(horizontal = 24.dp)) {
                repeat(12) { i -> MemberItem(name = if (i == 0) "Siz (Admin)" else "A'zo $i", contentColor = contentColor) }
            }
        }
    }
}

@Composable
private fun MemberItem(name: String, contentColor: Color) {
    Row(modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
        Box(modifier = Modifier.size(36.dp).clip(CircleShape).background(contentColor.copy(0.1f)), contentAlignment = Alignment.Center) { Icon(Icons.Default.Person, null, modifier = Modifier.size(20.dp), tint = contentColor.copy(0.4f)) }
        Spacer(modifier = Modifier.width(12.dp)); Text(text = name, color = contentColor, fontSize = 15.sp)
    }
}

data class GroupMessageData(val id: Int, val text: String, val senderName: String, val isMe: Boolean, val timestamp: Long = System.currentTimeMillis())
