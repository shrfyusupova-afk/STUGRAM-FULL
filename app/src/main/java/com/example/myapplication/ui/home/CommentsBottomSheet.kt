package com.example.myapplication.ui.home

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Comment
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.FavoriteBorder
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
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

/**
 * Bottom-sliding comments panel — pasdan tepaga sirpanib chiqadi.
 * postId beriladi va backend `/api/v1/comments/posts/:postId` chaqiriladi.
 *
 * Reels va Home feed ikkalasiga ham bir xil dizaynda ulanadi.
 */
@Composable
fun CommentsBottomSheet(
    postId: String,
    initialCount: Int,
    visible: Boolean,
    accent: Color = Color(0xFF00A3FF),
    onDismiss: () -> Unit,
    viewModel: CommentsViewModel = viewModel()
) {
    val ui by viewModel.uiState.collectAsState()
    var draft by remember { mutableStateOf("") }

    LaunchedEffect(visible, postId) {
        if (visible && postId.isNotBlank()) viewModel.open(postId, initialCount)
    }

    // Scrim — bosilganda yopiladi
    AnimatedVisibility(
        visible = visible,
        enter = fadeIn(tween(200)),
        exit = fadeOut(tween(180))
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Color.Black.copy(0.55f))
                .clickable(
                    onClick = onDismiss,
                    interactionSource = remember { androidx.compose.foundation.interaction.MutableInteractionSource() },
                    indication = null
                )
        )
    }

    // Sheet — pasdan chiqadi
    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.BottomCenter) {
        AnimatedVisibility(
            visible = visible,
            enter = slideInVertically(tween(280)) { it } + fadeIn(tween(220)),
            exit = slideOutVertically(tween(220)) { it } + fadeOut(tween(180))
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .fillMaxHeight(0.72f)
                    .background(Color(0xFF121212), RoundedCornerShape(topStart = 22.dp, topEnd = 22.dp))
                    .navigationBarsPadding()
            ) {
                // Drag handle + header
                Column(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Box(
                        modifier = Modifier
                            .padding(top = 10.dp, bottom = 8.dp)
                            .width(40.dp)
                            .height(4.dp)
                            .background(Color.White.copy(0.25f), RoundedCornerShape(2.dp))
                    )
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 6.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            "Izohlar  ·  ${formatCount(ui.totalCount)}",
                            color = Color.White,
                            fontWeight = FontWeight.Bold,
                            fontSize = 15.sp,
                            modifier = Modifier.weight(1f)
                        )
                        IconButton(onClick = onDismiss, modifier = Modifier.size(32.dp)) {
                            Icon(Icons.Default.Close, null, tint = Color.White.copy(0.7f), modifier = Modifier.size(20.dp))
                        }
                    }
                    HorizontalDivider(color = Color.White.copy(0.05f))
                }

                // Body
                Box(modifier = Modifier.weight(1f)) {
                    when {
                        ui.isLoading && ui.items.isEmpty() -> Box(
                            modifier = Modifier.fillMaxSize(),
                            contentAlignment = Alignment.Center
                        ) { CircularProgressIndicator(color = accent, strokeWidth = 2.5.dp, modifier = Modifier.size(32.dp)) }

                        ui.error != null && ui.items.isEmpty() -> Box(
                            modifier = Modifier.fillMaxSize(),
                            contentAlignment = Alignment.Center
                        ) {
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Text(ui.error ?: "Xato", color = Color.White.copy(0.7f), fontSize = 13.sp)
                                Spacer(Modifier.height(8.dp))
                                TextButton(onClick = { viewModel.load() }) {
                                    Text("Qayta urinish", color = accent)
                                }
                            }
                        }

                        ui.items.isEmpty() -> Box(
                            modifier = Modifier.fillMaxSize(),
                            contentAlignment = Alignment.Center
                        ) {
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Icon(Icons.AutoMirrored.Filled.Comment, null, tint = Color.White.copy(0.3f), modifier = Modifier.size(40.dp))
                                Spacer(Modifier.height(10.dp))
                                Text("Hali izohlar yo'q", color = Color.White.copy(0.6f), fontSize = 13.sp)
                                Text("Birinchi bo'lib izoh qoldiring", color = Color.White.copy(0.35f), fontSize = 11.sp)
                            }
                        }

                        else -> LazyColumn(
                            modifier = Modifier.fillMaxSize(),
                            contentPadding = PaddingValues(vertical = 8.dp)
                        ) {
                            items(ui.items, key = { it.id }) { c ->
                                CommentRow(c)
                            }
                        }
                    }
                }

                // Input row — IME bilan ko'tariladi
                HorizontalDivider(color = Color.White.copy(0.05f))
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .imePadding()
                        .padding(horizontal = 12.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(
                        modifier = Modifier
                            .size(34.dp)
                            .clip(CircleShape)
                            .background(accent.copy(0.18f)),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(Icons.Default.Person, null, tint = Color.White, modifier = Modifier.size(20.dp))
                    }
                    Spacer(Modifier.width(8.dp))
                    OutlinedTextField(
                        value = draft,
                        onValueChange = { draft = it },
                        placeholder = { Text("Izoh qoldiring...", color = Color.White.copy(0.4f), fontSize = 13.sp) },
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(22.dp),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = Color.White,
                            unfocusedTextColor = Color.White,
                            focusedBorderColor = accent.copy(0.6f),
                            unfocusedBorderColor = Color.White.copy(0.1f),
                            focusedContainerColor = Color.White.copy(0.04f),
                            unfocusedContainerColor = Color.White.copy(0.04f),
                            cursorColor = accent
                        ),
                        singleLine = false,
                        maxLines = 4,
                        textStyle = LocalTextStyle.current.copy(fontSize = 13.sp)
                    )
                    Spacer(Modifier.width(6.dp))
                    IconButton(
                        onClick = {
                            viewModel.postComment(draft) { draft = "" }
                        },
                        enabled = draft.isNotBlank() && !ui.isPosting,
                        modifier = Modifier.size(44.dp)
                    ) {
                        if (ui.isPosting) {
                            CircularProgressIndicator(color = accent, strokeWidth = 2.dp, modifier = Modifier.size(20.dp))
                        } else {
                            Icon(
                                Icons.AutoMirrored.Filled.Send,
                                null,
                                tint = if (draft.isNotBlank()) accent else Color.White.copy(0.3f),
                                modifier = Modifier.size(22.dp)
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun CommentRow(c: CommentItem) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 10.dp),
        verticalAlignment = Alignment.Top
    ) {
        Box(
            modifier = Modifier
                .size(34.dp)
                .clip(CircleShape)
                .background(Color.White.copy(0.08f))
                .border(0.5.dp, Color.White.copy(0.15f), CircleShape),
            contentAlignment = Alignment.Center
        ) {
            if (c.avatar.isNotBlank()) {
                AsyncImage(
                    model = c.avatar,
                    contentDescription = null,
                    modifier = Modifier.fillMaxSize().clip(CircleShape),
                    contentScale = ContentScale.Crop
                )
            } else {
                Icon(Icons.Default.Person, null, tint = Color.White.copy(0.7f), modifier = Modifier.size(20.dp))
            }
        }
        Spacer(Modifier.width(10.dp))
        Column(modifier = Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("@${c.author}", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                if (c.createdAt.isNotBlank()) {
                    Spacer(Modifier.width(6.dp))
                    Text(c.createdAt, color = Color.White.copy(0.4f), fontSize = 11.sp)
                }
            }
            Spacer(Modifier.height(2.dp))
            Text(c.text, color = Color.White.copy(0.88f), fontSize = 13.sp, lineHeight = 17.sp)
        }
        Icon(
            Icons.Default.FavoriteBorder,
            null,
            tint = Color.White.copy(0.4f),
            modifier = Modifier.size(16.dp).padding(top = 2.dp)
        )
    }
}

private fun formatCount(n: Int): String = when {
    n >= 1_000_000 -> "${n / 1_000_000}M"
    n >= 1_000 -> "${n / 1_000}k"
    else -> n.toString()
}
