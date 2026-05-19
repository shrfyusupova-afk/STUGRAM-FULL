package com.example.myapplication.ui.home

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.*
import androidx.compose.ui.draw.clip
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MessagesScreen(
    isDarkMode: Boolean,
    onBack: () -> Unit,
    onNavigateToChat: (String, Boolean) -> Unit,
    onNavigateToGroupChat: (String) -> Unit
) {
    val viewModel: MessagesViewModel = viewModel()
    val ui = viewModel.uiState.collectAsState().value
    var showRequests by remember { mutableStateOf(false) }

    val contentColor = if (isDarkMode) Color.White else Color.Black
    val secondary = contentColor.copy(alpha = 0.6f)
    val accentBlue = Color(0xFF00A3FF)
    val backgroundColor = if (isDarkMode) Color(0xFF0F0F0F) else Color(0xFFF2F2F2)

    val filtered = ui.conversations.filter {
        ui.query.isBlank() || it.title.contains(ui.query, ignoreCase = true) || it.subtitle.contains(ui.query, ignoreCase = true)
    }

    Box(modifier = Modifier.fillMaxSize().background(backgroundColor)) {
        Column(modifier = Modifier.fillMaxSize().statusBarsPadding()) {
            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(onClick = onBack) {
                    Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back", tint = accentBlue)
                }

                OutlinedTextField(
                    value = ui.query,
                    onValueChange = viewModel::onQueryChange,
                    placeholder = { Text("Search messages...", color = secondary.copy(0.5f)) },
                    leadingIcon = { Icon(Icons.Default.Search, null, tint = secondary, modifier = Modifier.size(18.dp)) },
                    modifier = Modifier.weight(1f).height(48.dp),
                    shape = RoundedCornerShape(12.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedContainerColor = contentColor.copy(alpha = 0.05f),
                        unfocusedContainerColor = contentColor.copy(alpha = 0.05f),
                        focusedBorderColor = accentBlue,
                        unfocusedBorderColor = Color.Transparent
                    ),
                    singleLine = true
                )
            }

            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 4.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text("Messages", color = accentBlue, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                TextButton(onClick = { showRequests = !showRequests }) {
                    Text(if (showRequests) "Show chats" else "Requests (${ui.requests.size})", color = accentBlue)
                }
            }

            when {
                ui.isLoading -> Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = accentBlue)
                }
                ui.error != null -> Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(ui.error, color = contentColor, fontSize = 14.sp, textAlign = TextAlign.Center)
                        Spacer(Modifier.height(8.dp))
                        TextButton(onClick = viewModel::refresh) { Text("Retry", color = accentBlue) }
                    }
                }
                showRequests && ui.requestsLoading -> Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = accentBlue)
                }
                showRequests && ui.requestsError != null -> Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(ui.requestsError, color = contentColor, fontSize = 14.sp, textAlign = TextAlign.Center)
                        Spacer(Modifier.height(8.dp))
                        TextButton(onClick = viewModel::refreshRequests) { Text("Retry", color = accentBlue) }
                    }
                }
                showRequests && ui.requests.isEmpty() -> Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Text("No requests yet", color = secondary, fontSize = 14.sp)
                }
                showRequests -> {
                    LazyColumn(modifier = Modifier.fillMaxSize(), contentPadding = PaddingValues(bottom = 80.dp)) {
                        items(ui.requests, key = { it.id }) { request ->
                            Card(
                                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
                                colors = CardDefaults.cardColors(containerColor = if (isDarkMode) Color(0xFF1A1A1A) else Color.White),
                                shape = RoundedCornerShape(14.dp)
                            ) {
                                Column(modifier = Modifier.fillMaxWidth().padding(14.dp)) {
                                    Text(request.fullName, color = contentColor, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                                    Text("@${request.username}", color = secondary, fontSize = 12.sp)
                                    Spacer(Modifier.height(10.dp))
                                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                        val busy = ui.requestActionInProgressId == request.id
                                        Button(
                                            enabled = !busy,
                                            onClick = {
                                                viewModel.addRequestToChat(request.id) { username ->
                                                    onNavigateToChat(username, true)
                                                }
                                            },
                                            colors = ButtonDefaults.buttonColors(containerColor = accentBlue),
                                            shape = RoundedCornerShape(10.dp),
                                            modifier = Modifier.weight(1f)
                                        ) { Text("Add to Chat", color = Color.White, fontSize = 12.sp) }
                                        OutlinedButton(
                                            enabled = !busy,
                                            onClick = { viewModel.blockRequestUser(request.id) },
                                            shape = RoundedCornerShape(10.dp),
                                            modifier = Modifier.weight(1f)
                                        ) { Text("Block", fontSize = 12.sp) }
                                        TextButton(
                                            enabled = !busy,
                                            onClick = { viewModel.removeRequest(request.id) },
                                            modifier = Modifier.weight(1f)
                                        ) { Text("Delete", color = Color.Red, fontSize = 12.sp) }
                                    }
                                }
                            }
                        }
                    }
                }
                filtered.isEmpty() -> Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Text("No chats yet", color = secondary, fontSize = 14.sp)
                }
                else -> {
                    LazyColumn(modifier = Modifier.fillMaxSize(), contentPadding = PaddingValues(bottom = 80.dp)) {
                        items(filtered, key = { it.conversationId }) { chat ->
                            ChatItem(
                                chat = ChatMessage(
                                    id = chat.conversationId.hashCode(),
                                    name = chat.title,
                                    lastMessage = chat.subtitle,
                                    time = chat.timeLabel,
                                    unreadCount = 0
                                ),
                                contentColor = contentColor,
                                secondaryColor = secondary,
                                accent = accentBlue
                            ) { name -> onNavigateToChat(name, false) }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ChatItem(chat: ChatMessage, contentColor: Color, secondaryColor: Color, accent: Color, onChatClick: (String) -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onChatClick(chat.name) }
            .padding(horizontal = 16.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier
                .size(52.dp)
                .clip(CircleShape)
                .background(secondaryColor.copy(0.1f)),
            contentAlignment = Alignment.Center
        ) {
            Icon(Icons.Default.Person, null, modifier = Modifier.size(26.dp), tint = secondaryColor.copy(0.35f))
        }
        Column(
            modifier = Modifier
                .weight(1f)
                .padding(horizontal = 12.dp)
        ) {
            Text(
                text = chat.name,
                color = contentColor,
                fontWeight = FontWeight.SemiBold,
                fontSize = 15.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            Spacer(Modifier.height(2.dp))
            Text(
                text = chat.lastMessage,
                color = if (chat.unreadCount > 0) contentColor.copy(0.85f) else secondaryColor.copy(0.7f),
                fontSize = 13.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                fontWeight = if (chat.unreadCount > 0) FontWeight.Medium else FontWeight.Normal
            )
        }
        Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(chat.time, color = if (chat.unreadCount > 0) accent else secondaryColor.copy(0.5f), fontSize = 11.sp)
            if (chat.unreadCount > 0) {
                Box(
                    modifier = Modifier
                        .defaultMinSize(minWidth = 20.dp)
                        .height(20.dp)
                        .background(accent, CircleShape)
                        .padding(horizontal = 6.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = if (chat.unreadCount > 99) "99+" else chat.unreadCount.toString(),
                        color = Color.White,
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }
        }
    }
    HorizontalDivider(
        modifier = Modifier.padding(start = 80.dp, end = 16.dp),
        thickness = 0.5.dp,
        color = contentColor.copy(alpha = 0.06f)
    )
}

private data class ChatMessage(
    val id: Int,
    val name: String,
    val lastMessage: String,
    val time: String,
    val unreadCount: Int = 0
)
