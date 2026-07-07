package com.example.myapplication.ui.comments

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.Send
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import coil.compose.AsyncImage
import com.example.myapplication.core.ui.UiState
import com.example.myapplication.data.remote.post.CommentDto
import com.example.myapplication.ui.home.formatRelativeTime

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CommentsSheet(
    postId: String,
    isDarkMode: Boolean,
    accentBlue: Color,
    onDismiss: () -> Unit,
    viewModel: CommentsViewModel = viewModel()
) {
    LaunchedEffect(postId) { viewModel.start(postId) }

    val sheetBg = if (isDarkMode) Color(0xFF1A1A1A) else Color.White
    val fg = if (isDarkMode) Color.White else Color.Black

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        containerColor = sheetBg,
        shape = RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp),
        dragHandle = { BottomSheetDefaults.DragHandle(color = Color.Gray.copy(0.4f)) }
    ) {
        Column(modifier = Modifier.fillMaxWidth().fillMaxHeight(0.85f)) {
            Text(
                "Izohlar",
                modifier = Modifier.fillMaxWidth().padding(12.dp),
                textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                fontWeight = FontWeight.Bold,
                fontSize = 16.sp,
                color = fg
            )
            HorizontalDivider(color = Color.Gray.copy(0.2f), thickness = 0.5.dp)

            Box(modifier = Modifier.weight(1f).fillMaxWidth()) {
                when (val state = viewModel.commentsState) {
                    is UiState.Loading -> {
                        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                            CircularProgressIndicator(color = accentBlue)
                        }
                    }
                    is UiState.Error -> {
                        Column(
                            modifier = Modifier.fillMaxSize(),
                            verticalArrangement = Arrangement.Center,
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            Text(state.message, color = fg.copy(alpha = 0.8f), fontSize = 13.sp)
                            Spacer(Modifier.height(8.dp))
                            TextButton(onClick = { viewModel.reload() }) { Text("Qayta urinish", color = accentBlue) }
                        }
                    }
                    is UiState.Empty -> {
                        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                            Text("Hali izoh yo'q — birinchi bo'ling!", color = fg.copy(alpha = 0.6f), fontSize = 14.sp)
                        }
                    }
                    is UiState.Success -> {
                        val comments = state.data
                        val listState = rememberLazyListState()
                        LazyColumn(state = listState, modifier = Modifier.fillMaxSize()) {
                            items(comments, key = { it.id ?: it.hashCode().toString() }) { comment ->
                                CommentRow(
                                    comment = comment,
                                    fg = fg,
                                    accentBlue = accentBlue,
                                    onReply = { viewModel.setReplyTo(comment) }
                                )
                            }
                            if (viewModel.isLoadingMore) {
                                item {
                                    Box(Modifier.fillMaxWidth().padding(16.dp), contentAlignment = Alignment.Center) {
                                        CircularProgressIndicator(color = accentBlue, strokeWidth = 2.dp, modifier = Modifier.size(20.dp))
                                    }
                                }
                            }
                        }
                        LaunchedEffect(listState, comments.size) {
                            snapshotFlow { listState.layoutInfo.visibleItemsInfo.lastOrNull()?.index }
                                .collect { last -> if (last != null && last >= comments.size - 3) viewModel.loadMore() }
                        }
                    }
                }
            }

            viewModel.replyingTo?.let { reply ->
                Row(
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        "@${reply.author?.username ?: "user"} ga javob",
                        color = accentBlue, fontSize = 12.sp, modifier = Modifier.weight(1f)
                    )
                    IconButton(onClick = { viewModel.setReplyTo(null) }, modifier = Modifier.size(24.dp)) {
                        Icon(Icons.Default.Close, contentDescription = "Bekor qilish", tint = fg.copy(alpha = 0.6f), modifier = Modifier.size(16.dp))
                    }
                }
            }

            CommentInputRow(
                value = viewModel.input,
                onValueChange = viewModel::onInputChange,
                isSending = viewModel.isSending,
                onSend = { viewModel.send() },
                isDarkMode = isDarkMode,
                accentBlue = accentBlue
            )
            viewModel.sendError?.let {
                Text(it, color = Color(0xFFE53935), fontSize = 12.sp, modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp))
            }
        }
    }
}

@Composable
private fun CommentRow(comment: CommentDto, fg: Color, accentBlue: Color, onReply: () -> Unit) {
    val isReply = comment.parentComment != null
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(start = if (isReply) 44.dp else 16.dp, end = 16.dp, top = 8.dp, bottom = 8.dp),
        verticalAlignment = Alignment.Top
    ) {
        val avatar = comment.author?.avatar
        if (avatar.isNullOrBlank()) {
            Box(
                modifier = Modifier.size(if (isReply) 26.dp else 34.dp).clip(CircleShape).background(accentBlue.copy(alpha = 0.25f)),
                contentAlignment = Alignment.Center
            ) { Icon(Icons.Default.Person, null, tint = accentBlue, modifier = Modifier.size(16.dp)) }
        } else {
            AsyncImage(
                model = avatar,
                contentDescription = null,
                modifier = Modifier.size(if (isReply) 26.dp else 34.dp).clip(CircleShape),
                contentScale = ContentScale.Crop
            )
        }
        Spacer(Modifier.width(10.dp))
        Column(modifier = Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(comment.author?.username ?: "user", fontWeight = FontWeight.Bold, fontSize = 13.sp, color = fg)
                Spacer(Modifier.width(8.dp))
                Text(formatRelativeTime(comment.createdAt), color = Color.Gray, fontSize = 11.sp)
            }
            Text(comment.content.orEmpty(), fontSize = 14.sp, color = fg, modifier = Modifier.padding(top = 2.dp))
            Text(
                "Javob berish",
                color = accentBlue,
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.padding(top = 4.dp).clickable { onReply() }
            )
        }
    }
}

@Composable
private fun CommentInputRow(
    value: String,
    onValueChange: (String) -> Unit,
    isSending: Boolean,
    onSend: () -> Unit,
    isDarkMode: Boolean,
    accentBlue: Color
) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 8.dp).navigationBarsPadding(),
        verticalAlignment = Alignment.CenterVertically
    ) {
        OutlinedTextField(
            value = value,
            onValueChange = onValueChange,
            modifier = Modifier.weight(1f),
            placeholder = { Text("Izoh qo'shing...") },
            maxLines = 3,
            shape = RoundedCornerShape(24.dp),
            keyboardActions = KeyboardActions(onSend = { onSend() })
        )
        Spacer(Modifier.width(8.dp))
        val canSend = value.isNotBlank() && !isSending
        IconButton(onClick = onSend, enabled = canSend) {
            if (isSending) {
                CircularProgressIndicator(color = accentBlue, strokeWidth = 2.dp, modifier = Modifier.size(20.dp))
            } else {
                Icon(
                    Icons.AutoMirrored.Rounded.Send,
                    contentDescription = "Yuborish",
                    tint = if (canSend) accentBlue else Color.Gray
                )
            }
        }
    }
}
