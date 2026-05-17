package com.example.myapplication.ui.home

import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.FavoriteBorder
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

@Composable
fun PopLikeAnimation(offset: Offset) {
    val scale = remember { Animatable(0f) }
    val alpha = remember { Animatable(0f) }

    LaunchedEffect(Unit) {
        launch {
            alpha.animateTo(1f, tween(200))
            delay(400)
            alpha.animateTo(0f, tween(200))
        }
        scale.animateTo(1.2f, spring(dampingRatio = Spring.DampingRatioMediumBouncy, stiffness = Spring.StiffnessLow))
        scale.animateTo(0f, tween(200))
    }

    Box(
        Modifier
            .offset { IntOffset(offset.x.toInt() - 60, offset.y.toInt() - 60) }
            .size(120.dp)
            .graphicsLayer(scaleX = scale.value, scaleY = scale.value, alpha = alpha.value),
        contentAlignment = Alignment.Center
    ) {
        Icon(Icons.Default.Favorite, null, tint = Color.Red, modifier = Modifier.fillMaxSize())
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CommentsBottomSheet(isDarkMode: Boolean, accentBlue: Color, onDismiss: () -> Unit) {
    val comments = remember {
        (1..10).map {
            CommentData(
                it, "user_$it", "https://picsum.photos/seed/c$it/100/100",
                "Ajoyib post bo'lipti! 🔥", "2h", (10..100).random(),
                replies = if(it % 3 == 0) List(3) { rIdx -> CommentData(it*100 + rIdx, "reply_user", "https://picsum.photos/seed/r$rIdx/100/100", "Juda to'g'ri!", "1h") } else emptyList()
            )
        }
    }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        containerColor = if (isDarkMode) Color(0xFF1A1A1A) else Color.White,
        shape = RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp),
        dragHandle = { BottomSheetDefaults.DragHandle(color = Color.Gray.copy(0.4f)) }
    ) {
        Box(modifier = Modifier.fillMaxHeight(0.85f)) {
            Box(modifier = Modifier.matchParentSize().background(
                Brush.verticalGradient(listOf(Color.White.copy(0.08f), Color.Transparent))
            ))
            Column(modifier = Modifier.fillMaxWidth()) {
                Text(
                    "Comments",
                    modifier = Modifier.fillMaxWidth().padding(16.dp),
                    textAlign = TextAlign.Center,
                    fontWeight = FontWeight.Bold,
                    fontSize = 16.sp,
                    color = if(isDarkMode) Color.White else Color.Black
                )

                LazyColumn(modifier = Modifier.weight(1f)) {
                    items(comments) { comment ->
                        CommentItem(comment, isDarkMode, accentBlue)
                    }
                }

                CommentInputSection(isDarkMode, accentBlue)
            }
        }
    }
}

@Composable
fun CommentItem(comment: CommentData, isDarkMode: Boolean, accentBlue: Color) {
    var isRepliesVisible by remember { mutableStateOf(false) }
    val textColor = if (isDarkMode) Color.White else Color.Black

    Column(modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)) {
        Row(verticalAlignment = Alignment.Top) {
            AsyncImage(
                model = comment.avatar,
                contentDescription = null,
                modifier = Modifier.size(36.dp).clip(CircleShape)
            )
            Spacer(Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(comment.user, fontWeight = FontWeight.Bold, fontSize = 13.sp, color = textColor)
                    Spacer(Modifier.width(8.dp))
                    Text(comment.time, color = Color.Gray, fontSize = 12.sp)
                }
                Text(comment.text, fontSize = 14.sp, color = textColor, modifier = Modifier.padding(vertical = 4.dp))

                Text("Reply", color = accentBlue, fontSize = 12.sp, fontWeight = FontWeight.Bold, modifier = Modifier.clickable { })

                if (comment.replies.isNotEmpty()) {
                    Spacer(Modifier.height(8.dp))
                    Text(
                        text = if (isRepliesVisible) "Hide replies" else "Reply (${comment.replies.size})",
                        color = accentBlue, fontSize = 12.sp, fontWeight = FontWeight.Bold,
                        modifier = Modifier.clickable { isRepliesVisible = !isRepliesVisible }
                    )

                    AnimatedVisibility(visible = isRepliesVisible) {
                        Column {
                            comment.replies.forEach { reply ->
                                Row(modifier = Modifier.padding(top = 12.dp, start = 16.dp)) {
                                    AsyncImage(
                                        model = "https://picsum.photos/seed/rp${reply.id}/100/100",
                                        contentDescription = null, modifier = Modifier.size(24.dp).clip(CircleShape)
                                    )
                                    Spacer(Modifier.width(8.dp))
                                    Column {
                                        Text(reply.user, fontWeight = FontWeight.Bold, fontSize = 12.sp, color = textColor)
                                        Text(reply.text, fontSize = 13.sp, color = textColor)
                                    }
                                }
                            }
                        }
                    }
                }
            }
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Icon(Icons.Default.FavoriteBorder, null, tint = Color.Gray, modifier = Modifier.size(16.dp))
                Text(comment.likes.toString(), color = Color.Gray, fontSize = 10.sp)
            }
        }
    }
}

@Composable
fun CommentInputSection(isDarkMode: Boolean, accentBlue: Color) {
    val emojis = listOf("❤️", "🙌", "🔥", "👏", "😢", "😍", "😮")
    Surface(color = if (isDarkMode) Color(0xFF1A1A1A) else Color.White, shadowElevation = 8.dp) {
        Column(modifier = Modifier.padding(12.dp).navigationBarsPadding()) {
            Row(modifier = Modifier.fillMaxWidth().padding(bottom = 8.dp), horizontalArrangement = Arrangement.SpaceAround) {
                emojis.forEach { emoji -> Text(emoji, fontSize = 24.sp, modifier = Modifier.clickable { }) }
            }
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(24.dp))
                    .background(if (isDarkMode) Color.White.copy(0.05f) else Color.Black.copy(0.05f))
                    .padding(horizontal = 16.dp, vertical = 8.dp)
            ) {
                AsyncImage(model = "https://picsum.photos/seed/me/100/100", contentDescription = null, modifier = Modifier.size(32.dp).clip(CircleShape))
                Spacer(Modifier.width(12.dp))
                Text("Add a comment...", color = Color.Gray, fontSize = 14.sp, modifier = Modifier.weight(1f))
                Text("Post", color = accentBlue, fontWeight = FontWeight.Bold)
            }
        }
    }
}
