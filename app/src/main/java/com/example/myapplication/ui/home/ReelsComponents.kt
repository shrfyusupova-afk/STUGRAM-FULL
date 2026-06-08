package com.example.myapplication.ui.home

import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.interaction.MutableInteractionSource
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
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import coil.compose.AsyncImage
import kotlinx.coroutines.delay

@Composable
fun ReelsScreen(accentBlue: Color, isDarkMode: Boolean, onProfileClick: (String) -> Unit) {
    val vm: ReelsViewModel = viewModel()

    Box(modifier = Modifier.fillMaxSize().background(Color.Black)) {
        when {
            vm.isLoading -> ReelsLoadingState()
            vm.reels.isEmpty() -> ReelsEmptyState(
                message = if (vm.error != null) (vm.error ?: "Reels yuklanmadi")
                          else "Hali reels yo'q.\nKo'proq odamlarni kuzating!",
                onRetry = { vm.loadReels() }
            )
            else -> ReelsPager(reels = vm.reels, onProfileClick = onProfileClick)
        }
    }
}

@Composable
private fun ReelsPager(reels: List<ReelItem>, onProfileClick: (String) -> Unit) {
    val pagerState = rememberPagerState { reels.size }

    Box(modifier = Modifier.fillMaxSize()) {
        VerticalPager(state = pagerState, modifier = Modifier.fillMaxSize()) { page ->
            ReelPage(reel = reels[page], onProfileClick = onProfileClick)
        }

        // Fixed top bar overlay
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .statusBarsPadding()
                .padding(horizontal = 16.dp, vertical = 10.dp)
                .align(Alignment.TopCenter),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Spacer(Modifier.weight(1f))
            Text(
                "Reels",
                color = Color.White,
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold
            )
            Spacer(Modifier.weight(1f))
        }

        // Swipe-up hint on first reel when there's more
        if (pagerState.currentPage == 0 && reels.size > 1) {
            val pulse by rememberInfiniteTransition(label = "pulse").animateFloat(
                initialValue = 0.4f,
                targetValue = 1f,
                animationSpec = infiniteRepeatable(
                    animation = tween(900, easing = FastOutSlowInEasing),
                    repeatMode = RepeatMode.Reverse
                ),
                label = "pulse_a"
            )
            Column(
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .navigationBarsPadding()
                    .padding(bottom = 10.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Icon(Icons.Default.KeyboardArrowUp, null, tint = Color.White.copy(alpha = pulse), modifier = Modifier.size(22.dp))
                Text("Yuqoriga suring", color = Color.White.copy(alpha = pulse), fontSize = 10.sp)
            }
        }
    }
}

@Composable
private fun ReelPage(reel: ReelItem, onProfileClick: (String) -> Unit) {
    var isLiked by remember(reel.id) { mutableStateOf(false) }
    var likeCount by remember(reel.id) { mutableStateOf(reel.likes) }
    var heartTrigger by remember { mutableIntStateOf(0) }
    var heartVisible by remember { mutableStateOf(false) }
    var captionExpanded by remember { mutableStateOf(false) }

    LaunchedEffect(heartTrigger) {
        if (heartTrigger > 0) {
            heartVisible = true
            delay(700)
            heartVisible = false
        }
    }

    val heartScale by animateFloatAsState(
        targetValue = if (heartVisible) 1f else 0f,
        animationSpec = spring(dampingRatio = Spring.DampingRatioMediumBouncy, stiffness = Spring.StiffnessMedium),
        label = "heart_scale"
    )

    Box(
        modifier = Modifier
            .fillMaxSize()
            .pointerInput(reel.id) {
                detectTapGestures(
                    onDoubleTap = {
                        if (!isLiked) {
                            isLiked = true
                            likeCount++
                        }
                        heartTrigger++
                    }
                )
            }
    ) {
        // Full-screen background media
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

        // Top scrim (for status bar readability)
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(180.dp)
                .align(Alignment.TopCenter)
                .background(
                    Brush.verticalGradient(listOf(Color.Black.copy(0.55f), Color.Transparent))
                )
        )

        // Bottom scrim (for overlay content readability)
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(400.dp)
                .align(Alignment.BottomCenter)
                .background(
                    Brush.verticalGradient(listOf(Color.Transparent, Color.Black.copy(0.88f)))
                )
        )

        // Play indicator for video reels
        if (reel.isVideo) {
            Box(
                modifier = Modifier
                    .size(60.dp)
                    .align(Alignment.Center)
                    .background(Color.Black.copy(0.3f), CircleShape)
                    .border(1.5.dp, Color.White.copy(0.4f), CircleShape),
                contentAlignment = Alignment.Center
            ) {
                Icon(Icons.Default.PlayArrow, null, tint = Color.White, modifier = Modifier.size(34.dp))
            }
        }

        // Double-tap heart burst
        if (heartScale > 0f) {
            Icon(
                Icons.Default.Favorite,
                null,
                tint = Color.White.copy(0.92f),
                modifier = Modifier
                    .align(Alignment.Center)
                    .size(110.dp)
                    .graphicsLayer { scaleX = heartScale; scaleY = heartScale; alpha = heartScale }
            )
        }

        // Right-side action bar
        Column(
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .navigationBarsPadding()
                .padding(end = 12.dp, bottom = 90.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            // Author avatar with follow badge
            ReelAvatarButton(
                avatarUrl = reel.authorAvatar,
                onClick = { if (reel.authorUsername.isNotBlank()) onProfileClick(reel.authorUsername) }
            )

            Spacer(Modifier.height(10.dp))

            // Like
            ReelCountAction(
                icon = if (isLiked) Icons.Default.Favorite else Icons.Default.FavoriteBorder,
                count = likeCount,
                tint = if (isLiked) Color(0xFFFF4B77) else Color.White,
                onClick = {
                    isLiked = !isLiked
                    likeCount += if (isLiked) 1 else -1
                }
            )

            // Comment
            ReelCountAction(
                icon = Icons.AutoMirrored.Filled.Comment,
                count = reel.comments,
                tint = Color.White,
                onClick = {}
            )

            // Bookmark
            ReelIconAction(Icons.Default.BookmarkBorder, Color.White) {}

            // Share
            ReelIconAction(Icons.Default.Share, Color.White) {}

            Spacer(Modifier.height(4.dp))

            // Rotating music disc
            RotatingDisc()
        }

        // Bottom-left: username, caption, audio
        Column(
            modifier = Modifier
                .align(Alignment.BottomStart)
                .navigationBarsPadding()
                .padding(start = 14.dp, end = 88.dp, bottom = 24.dp)
        ) {
            // Username
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.clickable(
                    indication = null,
                    interactionSource = remember { MutableInteractionSource() }
                ) { if (reel.authorUsername.isNotBlank()) onProfileClick(reel.authorUsername) }
            ) {
                Text(
                    "@${reel.authorUsername}",
                    color = Color.White,
                    fontWeight = FontWeight.Bold,
                    fontSize = 15.sp
                )
            }

            // Caption (expandable)
            if (reel.caption.isNotBlank()) {
                Spacer(Modifier.height(5.dp))
                Text(
                    text = reel.caption,
                    color = Color.White.copy(0.9f),
                    fontSize = 13.sp,
                    lineHeight = 18.sp,
                    maxLines = if (captionExpanded) Int.MAX_VALUE else 2,
                    overflow = if (captionExpanded) TextOverflow.Visible else TextOverflow.Ellipsis,
                    modifier = Modifier.clickable(
                        indication = null,
                        interactionSource = remember { MutableInteractionSource() }
                    ) { captionExpanded = !captionExpanded }
                )
            }

            // Audio strip
            Spacer(Modifier.height(10.dp))
            Row(
                modifier = Modifier
                    .background(Color.White.copy(0.12f), RoundedCornerShape(20.dp))
                    .padding(horizontal = 10.dp, vertical = 5.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(Icons.Default.MusicNote, null, tint = Color.White, modifier = Modifier.size(11.dp))
                Spacer(Modifier.width(5.dp))
                Text(
                    "Original Audio • @${reel.authorUsername}",
                    color = Color.White.copy(0.9f),
                    fontSize = 11.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }
        }
    }
}

@Composable
private fun ReelAvatarButton(avatarUrl: String, onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .width(46.dp)
            .height(56.dp)
    ) {
        Box(
            modifier = Modifier
                .size(46.dp)
                .clip(CircleShape)
                .border(2.dp, Color.White, CircleShape)
                .background(Color.White.copy(0.15f))
                .clickable(
                    indication = null,
                    interactionSource = remember { MutableInteractionSource() },
                    onClick = onClick
                )
                .align(Alignment.TopCenter),
            contentAlignment = Alignment.Center
        ) {
            if (avatarUrl.isNotBlank()) {
                AsyncImage(
                    model = avatarUrl,
                    contentDescription = null,
                    modifier = Modifier.fillMaxSize().clip(CircleShape),
                    contentScale = ContentScale.Crop
                )
            } else {
                Icon(Icons.Default.Person, null, tint = Color.White, modifier = Modifier.size(26.dp))
            }
        }
        Box(
            modifier = Modifier
                .size(20.dp)
                .align(Alignment.BottomCenter)
                .background(Color(0xFFFF3B6B), CircleShape)
                .border(1.5.dp, Color.Black, CircleShape),
            contentAlignment = Alignment.Center
        ) {
            Icon(Icons.Default.Add, null, tint = Color.White, modifier = Modifier.size(12.dp))
        }
    }
}

@Composable
private fun ReelCountAction(
    icon: ImageVector,
    count: Int,
    tint: Color,
    onClick: () -> Unit
) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(2.dp)
    ) {
        IconButton(
            onClick = onClick,
            modifier = Modifier.size(48.dp)
        ) {
            Icon(icon, null, tint = tint, modifier = Modifier.size(30.dp))
        }
        Text(reelFormatCount(count), color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
private fun ReelIconAction(icon: ImageVector, tint: Color, onClick: () -> Unit) {
    IconButton(onClick = onClick, modifier = Modifier.size(48.dp)) {
        Icon(icon, null, tint = tint, modifier = Modifier.size(27.dp))
    }
}

@Composable
private fun RotatingDisc() {
    val rotation by rememberInfiniteTransition(label = "disc").animateFloat(
        initialValue = 0f,
        targetValue = 360f,
        animationSpec = infiniteRepeatable(
            animation = tween(3200, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "disc_rot"
    )
    Box(
        modifier = Modifier
            .size(42.dp)
            .graphicsLayer { rotationZ = rotation }
            .clip(CircleShape)
            .background(Color(0xFF2C2C2C)),
        contentAlignment = Alignment.Center
    ) {
        // Vinyl rings
        Box(modifier = Modifier.size(36.dp).border(1.dp, Color.White.copy(0.1f), CircleShape))
        Box(modifier = Modifier.size(28.dp).border(1.dp, Color.White.copy(0.1f), CircleShape))
        // Center hole
        Box(modifier = Modifier.size(12.dp).background(Color(0xFF111111), CircleShape).border(1.dp, Color.White.copy(0.25f), CircleShape))
    }
}

@Composable
private fun ReelsLoadingState() {
    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(16.dp)) {
            CircularProgressIndicator(
                color = Color(0xFFFF3B6B),
                strokeWidth = 3.dp,
                modifier = Modifier.size(44.dp)
            )
            Text("Reels yuklanmoqda...", color = Color.White.copy(0.6f), fontSize = 13.sp)
        }
    }
}

@Composable
private fun ReelsEmptyState(message: String, onRetry: () -> Unit) {
    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier.padding(32.dp),
            verticalArrangement = Arrangement.spacedBy(18.dp)
        ) {
            Box(
                modifier = Modifier
                    .size(84.dp)
                    .background(
                        Brush.radialGradient(listOf(Color(0xFFFF3B6B).copy(0.15f), Color.Transparent)),
                        CircleShape
                    ),
                contentAlignment = Alignment.Center
            ) {
                Icon(Icons.Default.Movie, null, tint = Color(0xFFFF3B6B).copy(0.7f), modifier = Modifier.size(42.dp))
            }
            Text(
                message,
                color = Color.White.copy(0.75f),
                fontSize = 14.sp,
                textAlign = TextAlign.Center,
                lineHeight = 20.sp
            )
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(28.dp))
                    .background(Color(0xFFFF3B6B))
                    .clickable(onClick = onRetry)
                    .padding(horizontal = 32.dp, vertical = 13.dp)
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.Refresh, null, tint = Color.White, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(8.dp))
                    Text("Yangilash", color = Color.White, fontSize = 15.sp, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

private fun reelFormatCount(count: Int): String = when {
    count >= 1_000_000 -> "${count / 1_000_000}M"
    count >= 1_000 -> "${count / 1_000}k"
    else -> count.toString()
}
