package com.example.myapplication.ui.home

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.pager.VerticalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Comment
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import coil.compose.AsyncImage

@Composable
fun ReelsScreen(accentBlue: Color, isDarkMode: Boolean, onProfileClick: (String) -> Unit) {
    val vm: ReelsViewModel = viewModel()

    Box(modifier = Modifier.fillMaxSize().background(Color.Black)) {
        when {
            vm.isLoading -> Box(Modifier.fillMaxSize(), Alignment.Center) {
                CircularProgressIndicator(color = accentBlue)
            }
            vm.reels.isEmpty() -> ReelsEmptyState(
                message = if (vm.error != null) (vm.error ?: "Reels yuklanmadi")
                          else "Hali reels yo'q.\nKo'proq odamlarni kuzating!",
                accentBlue = accentBlue,
                onRetry = { vm.loadReels() }
            )
            else -> ReelsPager(reels = vm.reels, accentBlue = accentBlue, onProfileClick = onProfileClick)
        }
    }
}

@Composable
private fun ReelsPager(
    reels: List<ReelItem>,
    accentBlue: Color,
    onProfileClick: (String) -> Unit
) {
    val pagerState = rememberPagerState { reels.size }
    VerticalPager(state = pagerState, modifier = Modifier.fillMaxSize()) { page ->
        ReelPage(reel = reels[page], accentBlue = accentBlue, onProfileClick = onProfileClick)
    }
}

@Composable
private fun ReelPage(
    reel: ReelItem,
    accentBlue: Color,
    onProfileClick: (String) -> Unit
) {
    var isLiked by remember { mutableStateOf(false) }
    val likeCount = reel.likes + if (isLiked) 1 else 0

    Box(modifier = Modifier.fillMaxSize()) {
        // Background media / gradient
        if (!reel.mediaUrl.isNullOrBlank()) {
            AsyncImage(
                model = reel.mediaUrl,
                contentDescription = null,
                modifier = Modifier.fillMaxSize(),
                contentScale = ContentScale.Crop
            )
        } else {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(
                        Brush.verticalGradient(
                            listOf(Color(0xFF1A1A2E), Color(0xFF16213E), Color(0xFF0F3460))
                        )
                    )
            )
        }

        // Dark gradient at bottom for readability
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(300.dp)
                .align(Alignment.BottomCenter)
                .background(Brush.verticalGradient(listOf(Color.Transparent, Color.Black.copy(0.85f))))
        )

        // Play icon indicator for video reels
        if (reel.isVideo) {
            Box(
                modifier = Modifier
                    .size(64.dp)
                    .align(Alignment.Center)
                    .background(Color.Black.copy(0.35f), CircleShape),
                contentAlignment = Alignment.Center
            ) {
                Icon(Icons.Default.PlayArrow, null, tint = Color.White, modifier = Modifier.size(40.dp))
            }
        }

        // Right-side action buttons
        Column(
            modifier = Modifier
                .align(Alignment.CenterEnd)
                .padding(end = 14.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(20.dp)
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                IconButton(onClick = { isLiked = !isLiked }, modifier = Modifier.size(44.dp)) {
                    Icon(
                        if (isLiked) Icons.Default.Favorite else Icons.Default.FavoriteBorder,
                        null,
                        tint = if (isLiked) Color(0xFFFF4B77) else Color.White,
                        modifier = Modifier.size(28.dp)
                    )
                }
                Text(reelFormatCount(likeCount), color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Medium)
            }
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                IconButton(onClick = {}, modifier = Modifier.size(44.dp)) {
                    Icon(Icons.AutoMirrored.Filled.Comment, null, tint = Color.White, modifier = Modifier.size(26.dp))
                }
                Text(reelFormatCount(reel.comments), color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Medium)
            }
            IconButton(onClick = {}, modifier = Modifier.size(44.dp)) {
                Icon(Icons.Default.Share, null, tint = Color.White, modifier = Modifier.size(26.dp))
            }
        }

        // Bottom author + caption overlay
        Column(
            modifier = Modifier
                .align(Alignment.BottomStart)
                .padding(start = 14.dp, end = 80.dp, bottom = 90.dp)
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.clickable { if (reel.authorUsername.isNotBlank()) onProfileClick(reel.authorUsername) }
            ) {
                Box(
                    modifier = Modifier
                        .size(36.dp)
                        .clip(CircleShape)
                        .background(Color.White.copy(0.2f)),
                    contentAlignment = Alignment.Center
                ) {
                    if (reel.authorAvatar.isNotBlank()) {
                        AsyncImage(
                            model = reel.authorAvatar,
                            contentDescription = null,
                            modifier = Modifier.fillMaxSize().clip(CircleShape),
                            contentScale = ContentScale.Crop
                        )
                    } else {
                        Icon(Icons.Default.Person, null, tint = Color.White, modifier = Modifier.size(22.dp))
                    }
                }
                Spacer(Modifier.width(8.dp))
                Text("@${reel.authorUsername}", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 14.sp)
            }
            if (reel.caption.isNotBlank()) {
                Spacer(Modifier.height(6.dp))
                Text(
                    reel.caption,
                    color = Color.White.copy(0.9f),
                    fontSize = 13.sp,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )
            }
        }
    }
}

@Composable
private fun ReelsEmptyState(message: String, accentBlue: Color, onRetry: () -> Unit) {
    Box(Modifier.fillMaxSize(), Alignment.Center) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier.padding(24.dp)
        ) {
            Icon(Icons.Default.Movie, null, tint = accentBlue.copy(0.5f), modifier = Modifier.size(56.dp))
            Spacer(Modifier.height(16.dp))
            Text(
                message,
                color = Color.White.copy(0.8f),
                fontSize = 14.sp,
                textAlign = TextAlign.Center
            )
            Spacer(Modifier.height(16.dp))
            OutlinedButton(
                onClick = onRetry,
                border = androidx.compose.foundation.BorderStroke(1.dp, accentBlue.copy(0.5f)),
                colors = ButtonDefaults.outlinedButtonColors(contentColor = accentBlue)
            ) {
                Icon(Icons.Default.Refresh, null, modifier = Modifier.size(16.dp))
                Spacer(Modifier.width(6.dp))
                Text("Yangilash")
            }
        }
    }
}

private fun reelFormatCount(count: Int): String = when {
    count >= 1_000_000 -> "${count / 1_000_000}M"
    count >= 1_000 -> "${count / 1_000}k"
    else -> count.toString()
}
