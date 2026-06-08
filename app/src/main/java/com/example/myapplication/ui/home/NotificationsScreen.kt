package com.example.myapplication.ui.home

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Comment
import androidx.compose.material.icons.filled.AlternateEmail
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.NotificationsOff
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.PersonAdd
import androidx.compose.material.icons.filled.Reply
import androidx.compose.material3.*
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.material3.pulltorefresh.PullToRefreshDefaults
import androidx.compose.material3.pulltorefresh.rememberPullToRefreshState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import coil.compose.AsyncImage

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NotificationsScreen(
    isDarkMode: Boolean,
    onBack: () -> Unit,
    onOpenProfile: (String) -> Unit,
    viewModel: NotificationsViewModel = viewModel()
) {
    val ui by viewModel.uiState.collectAsState()
    val bg = if (isDarkMode) Color(0xFF0F0F0F) else Color.White
    val fg = if (isDarkMode) Color.White else Color.Black
    val secondary = fg.copy(0.6f)
    val accent = Color(0xFF00A3FF)
    val pullState = rememberPullToRefreshState()

    Column(modifier = Modifier.fillMaxSize().background(bg)) {
        // Top bar
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .statusBarsPadding()
                .padding(horizontal = 8.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            IconButton(onClick = onBack) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, null, tint = fg)
            }
            Text(
                "Bildirishnomalar",
                color = fg,
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.weight(1f)
            )
            if (ui.unreadCount > 0) {
                TextButton(onClick = { viewModel.markAllRead() }) {
                    Text("Hammasini ko'rildi", color = accent, fontSize = 12.sp)
                }
            }
        }

        HorizontalDivider(color = fg.copy(0.06f))

        PullToRefreshBox(
            isRefreshing = ui.isRefreshing,
            onRefresh = { viewModel.refresh() },
            state = pullState,
            modifier = Modifier.fillMaxSize(),
            indicator = {
                PullToRefreshDefaults.Indicator(
                    state = pullState,
                    isRefreshing = ui.isRefreshing,
                    color = accent,
                    containerColor = if (isDarkMode) Color(0xFF1A1A1A) else Color.White,
                    modifier = Modifier.align(Alignment.TopCenter)
                )
            }
        ) {
            when {
                ui.isLoading && ui.items.isEmpty() -> Box(
                    Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) { CircularProgressIndicator(color = accent, strokeWidth = 2.5.dp, modifier = Modifier.size(36.dp)) }

                ui.error != null && ui.items.isEmpty() -> Box(
                    Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(ui.error ?: "", color = secondary, fontSize = 14.sp)
                        Spacer(Modifier.height(8.dp))
                        TextButton(onClick = { viewModel.load() }) { Text("Qayta urinish", color = accent) }
                    }
                }

                ui.items.isEmpty() -> Box(
                    Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(64.dp)
                                .background(fg.copy(0.06f), CircleShape),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(Icons.Default.NotificationsOff, null, tint = secondary, modifier = Modifier.size(28.dp))
                        }
                        Text("Hali bildirishnomalar yo'q", color = secondary, fontSize = 14.sp)
                        Text("Yangi faoliyat bo'lganda shu yerda ko'rasiz", color = secondary.copy(0.6f), fontSize = 11.sp)
                    }
                }

                else -> LazyColumn(modifier = Modifier.fillMaxSize()) {
                    items(ui.items, key = { it.id }) { n ->
                        NotificationRow(
                            n = n,
                            isDarkMode = isDarkMode,
                            accent = accent,
                            onClick = {
                                viewModel.markRead(n.id)
                                if (n.actorUsername.isNotBlank()) onOpenProfile(n.actorUsername)
                            }
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun NotificationRow(
    n: NotificationItem,
    isDarkMode: Boolean,
    accent: Color,
    onClick: () -> Unit
) {
    val fg = if (isDarkMode) Color.White else Color.Black
    val unreadTint = accent.copy(0.08f)
    val rowBg = if (n.isRead) Color.Transparent else unreadTint

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(rowBg)
            .clickable(onClick = onClick)
            .padding(horizontal = 14.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Avatar with type badge overlay
        Box(modifier = Modifier.size(46.dp)) {
            Box(
                modifier = Modifier
                    .size(44.dp)
                    .clip(CircleShape)
                    .background(fg.copy(0.08f))
                    .border(0.5.dp, fg.copy(0.12f), CircleShape),
                contentAlignment = Alignment.Center
            ) {
                if (n.actorAvatar.isNotBlank()) {
                    AsyncImage(
                        model = n.actorAvatar,
                        contentDescription = null,
                        modifier = Modifier.fillMaxSize().clip(CircleShape),
                        contentScale = ContentScale.Crop
                    )
                } else {
                    Icon(Icons.Default.Person, null, tint = fg.copy(0.6f), modifier = Modifier.size(26.dp))
                }
            }
            // Type badge
            val (icon, tint) = badgeFor(n.type)
            Box(
                modifier = Modifier
                    .size(20.dp)
                    .align(Alignment.BottomEnd)
                    .background(tint, CircleShape)
                    .border(1.5.dp, if (isDarkMode) Color(0xFF0F0F0F) else Color.White, CircleShape),
                contentAlignment = Alignment.Center
            ) {
                Icon(icon, null, tint = Color.White, modifier = Modifier.size(11.dp))
            }
        }

        Spacer(Modifier.width(12.dp))

        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = buildNotificationLine(n.actorUsername, n.message, fg),
                fontSize = 13.sp,
                lineHeight = 18.sp
            )
            if (n.timeAgo.isNotBlank()) {
                Text(n.timeAgo, color = fg.copy(0.45f), fontSize = 11.sp)
            }
        }

        if (!n.postPreview.isNullOrBlank()) {
            Spacer(Modifier.width(10.dp))
            AsyncImage(
                model = n.postPreview,
                contentDescription = null,
                modifier = Modifier.size(44.dp).clip(RoundedCornerShape(6.dp)),
                contentScale = ContentScale.Crop
            )
        } else if (n.type == "follow") {
            Spacer(Modifier.width(10.dp))
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(8.dp))
                    .background(accent)
                    .padding(horizontal = 14.dp, vertical = 6.dp)
            ) {
                Text("Profil", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
            }
        }
    }
    HorizontalDivider(
        modifier = Modifier.padding(start = 70.dp),
        color = fg.copy(0.04f)
    )
}

private fun badgeFor(type: String): Pair<ImageVector, Color> = when (type) {
    "like" -> Icons.Default.Favorite to Color(0xFFFF3B6B)
    "comment" -> Icons.AutoMirrored.Filled.Comment to Color(0xFF00A3FF)
    "reply" -> Icons.Default.Reply to Color(0xFF00A3FF)
    "follow" -> Icons.Default.PersonAdd to Color(0xFF6E5CFF)
    "mention" -> Icons.Default.AlternateEmail to Color(0xFFFFB300)
    else -> Icons.Default.Person to Color.Gray
}

private fun buildNotificationLine(actor: String, message: String, fg: Color): AnnotatedString = buildAnnotatedString {
    withStyle(SpanStyle(color = fg, fontWeight = FontWeight.Bold)) {
        append("@$actor")
    }
    append(" ")
    withStyle(SpanStyle(color = fg.copy(0.85f))) {
        append(message)
    }
}
