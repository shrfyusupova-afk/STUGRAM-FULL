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
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.automirrored.filled.VolumeOff
import androidx.compose.material.icons.automirrored.filled.VolumeUp
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
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import coil.compose.AsyncImage
import kotlinx.coroutines.delay

private val ReelPink = Color(0xFFFF3B6B)
private val ReelBg = Color.Black

@Composable
fun ReelsScreen(accentBlue: Color, isDarkMode: Boolean, onProfileClick: (String) -> Unit) {
    val vm: ReelsViewModel = viewModel()

    Box(modifier = Modifier.fillMaxSize().background(ReelBg)) {
        when {
            vm.isLoading -> ReelsLoadingState()
            vm.reels.isEmpty() -> ReelsEmptyState(
                message = if (vm.error != null) (vm.error ?: "Reels yuklanmadi")
                          else "Hali reels yo'q.\nKo'proq odamlarni kuzating!",
                onRetry = { vm.loadReels() }
            )
            else -> ReelsPager(
                reels = vm.reels,
                isMuted = vm.isMuted,
                onToggleMute = { vm.toggleMute() },
                onSave = { vm.toggleSave(it) },
                isSaved = { vm.isSaved(it) },
                onNotInterested = { vm.markNotInterested(it) },
                onProfileClick = onProfileClick
            )
        }
    }
}

/**
 * Public fullscreen reel viewer used from SearchScreen when the user taps a video post.
 * Reuses the same overlay/interaction stack as the main Reels tab but adds a close button.
 */
@Composable
fun ReelFullscreenViewer(
    reel: ReelItem,
    onDismiss: () -> Unit,
    onProfileClick: (String) -> Unit
) {
    var isMuted by remember { mutableStateOf(true) }
    var isSaved by remember(reel.id) { mutableStateOf(false) }

    Box(modifier = Modifier.fillMaxSize().background(ReelBg)) {
        ReelPage(
            reel = reel,
            rank = 0,
            isMuted = isMuted,
            isSaved = isSaved,
            onToggleMute = { isMuted = !isMuted },
            onToggleSave = { isSaved = !isSaved },
            onNotInterested = onDismiss,
            onProfileClick = onProfileClick
        )

        // Close button overlay (top-left)
        Box(
            modifier = Modifier
                .statusBarsPadding()
                .padding(start = 12.dp, top = 8.dp)
                .size(40.dp)
                .background(Color.Black.copy(0.45f), CircleShape)
                .clickable(onClick = onDismiss),
            contentAlignment = Alignment.Center
        ) {
            Icon(Icons.Default.Close, null, tint = Color.White, modifier = Modifier.size(22.dp))
        }
    }
}

// ─────────────────────────────────────────────────────────────────────
// Pager — main tab
// ─────────────────────────────────────────────────────────────────────

@Composable
private fun ReelsPager(
    reels: List<ReelItem>,
    isMuted: Boolean,
    onToggleMute: () -> Unit,
    onSave: (String) -> Unit,
    isSaved: (String) -> Boolean,
    onNotInterested: (String) -> Unit,
    onProfileClick: (String) -> Unit
) {
    val pagerState = rememberPagerState { reels.size }

    Box(modifier = Modifier.fillMaxSize()) {
        VerticalPager(state = pagerState, modifier = Modifier.fillMaxSize()) { page ->
            val reel = reels[page]
            ReelPage(
                reel = reel,
                rank = page,
                isMuted = isMuted,
                isSaved = isSaved(reel.id),
                onToggleMute = onToggleMute,
                onToggleSave = { onSave(reel.id) },
                onNotInterested = { onNotInterested(reel.id) },
                onProfileClick = onProfileClick
            )
        }

        // Fixed top bar: "For You" / "Following" tabs
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .statusBarsPadding()
                .padding(horizontal = 16.dp, vertical = 10.dp)
                .align(Alignment.TopCenter),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.Center
        ) {
            ReelTopTab(label = "Kuzatilayotgan", active = false) {}
            Spacer(Modifier.width(20.dp))
            ReelTopTab(label = "Siz uchun", active = true) {}
        }

        // Mute toggle — top-right
        Box(
            modifier = Modifier
                .align(Alignment.TopEnd)
                .statusBarsPadding()
                .padding(end = 12.dp, top = 8.dp)
                .size(38.dp)
                .background(Color.Black.copy(0.45f), CircleShape)
                .clickable(onClick = onToggleMute),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                if (isMuted) Icons.AutoMirrored.Filled.VolumeOff else Icons.AutoMirrored.Filled.VolumeUp,
                null,
                tint = Color.White,
                modifier = Modifier.size(20.dp)
            )
        }

        // Swipe-up hint on first reel
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
private fun ReelTopTab(label: String, active: Boolean, onClick: () -> Unit) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier.clickable(
            indication = null,
            interactionSource = remember { MutableInteractionSource() },
            onClick = onClick
        )
    ) {
        Text(
            label,
            color = if (active) Color.White else Color.White.copy(0.55f),
            fontWeight = if (active) FontWeight.ExtraBold else FontWeight.Medium,
            fontSize = 15.sp
        )
        Spacer(Modifier.height(4.dp))
        Box(
            modifier = Modifier
                .width(28.dp)
                .height(2.5.dp)
                .background(if (active) Color.White else Color.Transparent, RoundedCornerShape(2.dp))
        )
    }
}

// ─────────────────────────────────────────────────────────────────────
// ReelPage — single reel surface (reused for tab + fullscreen viewer)
// ─────────────────────────────────────────────────────────────────────

@Composable
private fun ReelPage(
    reel: ReelItem,
    rank: Int,
    isMuted: Boolean,
    isSaved: Boolean,
    onToggleMute: () -> Unit,
    onToggleSave: () -> Unit,
    onNotInterested: () -> Unit,
    onProfileClick: (String) -> Unit
) {
    var isLiked by remember(reel.id) { mutableStateOf(false) }
    var likeCount by remember(reel.id) { mutableStateOf(reel.likes) }
    var heartTrigger by remember { mutableIntStateOf(0) }
    var heartVisible by remember { mutableStateOf(false) }
    var captionExpanded by remember { mutableStateOf(false) }
    var isPaused by remember(reel.id) { mutableStateOf(false) }
    var showMoreMenu by remember { mutableStateOf(false) }
    var showComments by remember { mutableStateOf(false) }
    var showShare by remember { mutableStateOf(false) }
    var isFollowed by remember(reel.id) { mutableStateOf(false) }

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
                    onTap = { isPaused = !isPaused },
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
        // Background media
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

        // Top + bottom scrims
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(180.dp)
                .align(Alignment.TopCenter)
                .background(Brush.verticalGradient(listOf(Color.Black.copy(0.55f), Color.Transparent)))
        )
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(400.dp)
                .align(Alignment.BottomCenter)
                .background(Brush.verticalGradient(listOf(Color.Transparent, Color.Black.copy(0.88f))))
        )

        // "For you" recommended badge (top-ranked picks)
        if (rank < 3) {
            Row(
                modifier = Modifier
                    .align(Alignment.TopStart)
                    .statusBarsPadding()
                    .padding(start = 12.dp, top = 56.dp)
                    .background(Color.Black.copy(0.55f), RoundedCornerShape(20.dp))
                    .padding(horizontal = 10.dp, vertical = 5.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(Icons.Default.AutoAwesome, null, tint = ReelPink, modifier = Modifier.size(12.dp))
                Spacer(Modifier.width(4.dp))
                Text("Siz uchun tanlandi", color = Color.White, fontSize = 10.sp, fontWeight = FontWeight.SemiBold)
            }
        }

        // Pause indicator (center)
        if (isPaused) {
            Box(
                modifier = Modifier
                    .size(74.dp)
                    .align(Alignment.Center)
                    .background(Color.Black.copy(0.45f), CircleShape)
                    .border(1.5.dp, Color.White.copy(0.5f), CircleShape),
                contentAlignment = Alignment.Center
            ) {
                Icon(Icons.Default.PlayArrow, null, tint = Color.White, modifier = Modifier.size(44.dp))
            }
        } else if (reel.isVideo) {
            // Subtle play hint for video reels when playing
            Box(
                modifier = Modifier
                    .size(56.dp)
                    .align(Alignment.Center)
                    .background(Color.Black.copy(0.18f), CircleShape),
                contentAlignment = Alignment.Center
            ) {
                Icon(Icons.Default.PlayArrow, null, tint = Color.White.copy(0.5f), modifier = Modifier.size(28.dp))
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
            ReelAvatarButton(
                avatarUrl = reel.authorAvatar,
                showFollow = !isFollowed,
                onClick = { if (reel.authorUsername.isNotBlank()) onProfileClick(reel.authorUsername) },
                onFollowClick = { isFollowed = true }
            )

            Spacer(Modifier.height(10.dp))

            ReelCountAction(
                icon = if (isLiked) Icons.Default.Favorite else Icons.Default.FavoriteBorder,
                count = likeCount,
                tint = if (isLiked) ReelPink else Color.White,
                onClick = {
                    isLiked = !isLiked
                    likeCount += if (isLiked) 1 else -1
                }
            )

            ReelCountAction(
                icon = Icons.AutoMirrored.Filled.Comment,
                count = reel.comments,
                tint = Color.White,
                onClick = { showComments = true }
            )

            ReelIconAction(
                icon = if (isSaved) Icons.Default.Bookmark else Icons.Default.BookmarkBorder,
                tint = if (isSaved) Color(0xFFFFD54F) else Color.White,
                onClick = onToggleSave
            )

            ReelIconAction(Icons.AutoMirrored.Filled.Send, Color.White) { showShare = true }

            ReelIconAction(Icons.Default.MoreVert, Color.White) { showMoreMenu = true }

            Spacer(Modifier.height(4.dp))

            RotatingDisc(avatarUrl = reel.authorAvatar)
        }

        // Bottom-left: username + caption + audio
        Column(
            modifier = Modifier
                .align(Alignment.BottomStart)
                .navigationBarsPadding()
                .padding(start = 14.dp, end = 88.dp, bottom = 24.dp)
        ) {
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
                if (!isFollowed) {
                    Spacer(Modifier.width(10.dp))
                    Box(
                        modifier = Modifier
                            .border(1.dp, Color.White, RoundedCornerShape(6.dp))
                            .clickable { isFollowed = true }
                            .padding(horizontal = 10.dp, vertical = 3.dp)
                    ) {
                        Text("Kuzatish", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                    }
                }
            }

            if (reel.caption.isNotBlank()) {
                Spacer(Modifier.height(5.dp))
                Text(
                    text = highlightHashtagsAndMentions(reel.caption),
                    fontSize = 13.sp,
                    lineHeight = 18.sp,
                    color = Color.White.copy(0.92f),
                    maxLines = if (captionExpanded) Int.MAX_VALUE else 2,
                    overflow = if (captionExpanded) TextOverflow.Visible else TextOverflow.Ellipsis,
                    modifier = Modifier.clickable(
                        indication = null,
                        interactionSource = remember { MutableInteractionSource() }
                    ) { captionExpanded = !captionExpanded }
                )
            }

            Spacer(Modifier.height(10.dp))

            // Audio strip — animated marquee feel
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

    // Sheets
    if (showMoreMenu) {
        ReelMoreMenuSheet(
            isSaved = isSaved,
            onDismiss = { showMoreMenu = false },
            onSave = { onToggleSave(); showMoreMenu = false },
            onNotInterested = { showMoreMenu = false; onNotInterested() },
            onReport = { showMoreMenu = false }
        )
    }
    if (showComments) {
        ReelCommentsSheet(
            authorUsername = reel.authorUsername,
            commentCount = reel.comments,
            onDismiss = { showComments = false }
        )
    }
    if (showShare) {
        ReelShareSheet(
            reelId = reel.id,
            authorUsername = reel.authorUsername,
            onDismiss = { showShare = false }
        )
    }
}

// ─────────────────────────────────────────────────────────────────────
// Right-side action buttons
// ─────────────────────────────────────────────────────────────────────

@Composable
private fun ReelAvatarButton(
    avatarUrl: String,
    showFollow: Boolean,
    onClick: () -> Unit,
    onFollowClick: () -> Unit
) {
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
        if (showFollow) {
            Box(
                modifier = Modifier
                    .size(20.dp)
                    .align(Alignment.BottomCenter)
                    .background(ReelPink, CircleShape)
                    .border(1.5.dp, Color.Black, CircleShape)
                    .clickable(onClick = onFollowClick),
                contentAlignment = Alignment.Center
            ) {
                Icon(Icons.Default.Add, null, tint = Color.White, modifier = Modifier.size(12.dp))
            }
        }
    }
}

@Composable
private fun ReelCountAction(icon: ImageVector, count: Int, tint: Color, onClick: () -> Unit) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(2.dp)
    ) {
        IconButton(onClick = onClick, modifier = Modifier.size(48.dp)) {
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
private fun RotatingDisc(avatarUrl: String) {
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
        Box(modifier = Modifier.size(36.dp).border(1.dp, Color.White.copy(0.1f), CircleShape))
        Box(modifier = Modifier.size(28.dp).border(1.dp, Color.White.copy(0.1f), CircleShape))
        if (avatarUrl.isNotBlank()) {
            AsyncImage(
                model = avatarUrl,
                contentDescription = null,
                modifier = Modifier.size(18.dp).clip(CircleShape).border(1.dp, Color.White.copy(0.4f), CircleShape),
                contentScale = ContentScale.Crop
            )
        } else {
            Box(modifier = Modifier.size(12.dp).background(Color(0xFF111111), CircleShape).border(1.dp, Color.White.copy(0.25f), CircleShape))
        }
    }
}

// ─────────────────────────────────────────────────────────────────────
// Bottom sheets
// ─────────────────────────────────────────────────────────────────────

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ReelMoreMenuSheet(
    isSaved: Boolean,
    onDismiss: () -> Unit,
    onSave: () -> Unit,
    onNotInterested: () -> Unit,
    onReport: () -> Unit
) {
    val sheetState = rememberModalBottomSheetState()
    val clipboard = LocalClipboardManager.current

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = Color(0xFF161616),
        dragHandle = { ReelDragHandle() }
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .navigationBarsPadding()
                .padding(bottom = 12.dp)
        ) {
            ReelMenuRow(
                icon = if (isSaved) Icons.Default.Bookmark else Icons.Default.BookmarkBorder,
                label = if (isSaved) "Saqlangan" else "Saqlash",
                onClick = onSave
            )
            ReelMenuRow(
                icon = Icons.Default.Link,
                label = "Havolani nusxalash",
                onClick = {
                    clipboard.setText(AnnotatedString("https://stugram.app/r/"))
                    onDismiss()
                }
            )
            ReelMenuRow(
                icon = Icons.Default.VisibilityOff,
                label = "Qiziq emas",
                onClick = onNotInterested
            )
            ReelMenuRow(
                icon = Icons.Default.Flag,
                label = "Shikoyat qilish",
                tint = Color(0xFFFF5252),
                onClick = onReport
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ReelCommentsSheet(
    authorUsername: String,
    commentCount: Int,
    onDismiss: () -> Unit
) {
    val sheetState = rememberModalBottomSheetState()
    var draft by remember { mutableStateOf("") }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = Color(0xFF111111),
        dragHandle = { ReelDragHandle() }
    ) {
        Column(modifier = Modifier.fillMaxWidth().navigationBarsPadding().imePadding()) {
            Text(
                "Izohlar  ·  ${reelFormatCount(commentCount)}",
                color = Color.White,
                fontWeight = FontWeight.Bold,
                fontSize = 15.sp,
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 6.dp)
            )
            HorizontalDivider(color = Color.White.copy(0.05f))

            if (commentCount == 0) {
                Box(
                    modifier = Modifier.fillMaxWidth().height(180.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(Icons.AutoMirrored.Filled.Comment, null, tint = Color.White.copy(0.3f), modifier = Modifier.size(36.dp))
                        Spacer(Modifier.height(8.dp))
                        Text("Hali izohlar yo'q", color = Color.White.copy(0.6f), fontSize = 13.sp)
                        Text("Birinchi bo'lib izoh qoldiring", color = Color.White.copy(0.4f), fontSize = 11.sp)
                    }
                }
            } else {
                // Mock comments preview — real backend not wired
                Column(modifier = Modifier.padding(vertical = 6.dp)) {
                    listOf(
                        "Zo'r 🔥" to "ali_2008",
                        "Qaerda olingan bu?" to "shahnoza_uz",
                        "Eng yaxshi reel @${authorUsername} ❤️" to "sanjar.k"
                    ).forEach { (text, user) ->
                        ReelCommentRow(user = user, text = text)
                    }
                }
            }

            HorizontalDivider(color = Color.White.copy(0.05f))
            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Box(
                    modifier = Modifier
                        .size(32.dp)
                        .clip(CircleShape)
                        .background(ReelPink.copy(0.2f)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(Icons.Default.Person, null, tint = Color.White, modifier = Modifier.size(20.dp))
                }
                Spacer(Modifier.width(8.dp))
                OutlinedTextField(
                    value = draft,
                    onValueChange = { draft = it },
                    placeholder = { Text("Izoh qoldiring...", color = Color.White.copy(0.4f), fontSize = 13.sp) },
                    modifier = Modifier.weight(1f).height(48.dp),
                    shape = RoundedCornerShape(24.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = Color.White,
                        unfocusedTextColor = Color.White,
                        focusedBorderColor = ReelPink.copy(0.4f),
                        unfocusedBorderColor = Color.White.copy(0.1f),
                        focusedContainerColor = Color.White.copy(0.04f),
                        unfocusedContainerColor = Color.White.copy(0.04f),
                        cursorColor = ReelPink
                    ),
                    singleLine = true,
                    textStyle = LocalTextStyle.current.copy(fontSize = 13.sp)
                )
                Spacer(Modifier.width(6.dp))
                IconButton(
                    onClick = { draft = "" },
                    enabled = draft.isNotBlank(),
                    modifier = Modifier.size(44.dp)
                ) {
                    Icon(
                        Icons.AutoMirrored.Filled.Send,
                        null,
                        tint = if (draft.isNotBlank()) ReelPink else Color.White.copy(0.3f),
                        modifier = Modifier.size(22.dp)
                    )
                }
            }
        }
    }
}

@Composable
private fun ReelCommentRow(user: String, text: String) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
        verticalAlignment = Alignment.Top
    ) {
        Box(
            modifier = Modifier
                .size(30.dp)
                .clip(CircleShape)
                .background(Color.White.copy(0.1f)),
            contentAlignment = Alignment.Center
        ) {
            Icon(Icons.Default.Person, null, tint = Color.White.copy(0.7f), modifier = Modifier.size(20.dp))
        }
        Spacer(Modifier.width(10.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text("@$user", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
            Text(text, color = Color.White.copy(0.85f), fontSize = 13.sp, lineHeight = 17.sp)
        }
        Icon(Icons.Default.FavoriteBorder, null, tint = Color.White.copy(0.4f), modifier = Modifier.size(16.dp))
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ReelShareSheet(
    reelId: String,
    authorUsername: String,
    onDismiss: () -> Unit
) {
    val sheetState = rememberModalBottomSheetState()
    val clipboard = LocalClipboardManager.current

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = Color(0xFF161616),
        dragHandle = { ReelDragHandle() }
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .navigationBarsPadding()
                .padding(horizontal = 16.dp, vertical = 8.dp)
        ) {
            Text(
                "Reel ulashish",
                color = Color.White,
                fontWeight = FontWeight.Bold,
                fontSize = 15.sp,
                modifier = Modifier.padding(bottom = 12.dp)
            )
            ReelShareTile(
                icon = Icons.Default.Link,
                label = "Havolani nusxalash",
                hint = "stugram.app/r/${reelId.take(8)}",
                onClick = {
                    clipboard.setText(AnnotatedString("https://stugram.app/r/$reelId"))
                    onDismiss()
                }
            )
            ReelShareTile(
                icon = Icons.AutoMirrored.Filled.Send,
                label = "Xabar orqali yuborish",
                hint = "Do'stlarga yuboring",
                onClick = onDismiss
            )
            ReelShareTile(
                icon = Icons.Default.AddCircle,
                label = "Storyga qo'shish",
                hint = "Sizning hikoyangizga",
                onClick = onDismiss
            )
            ReelShareTile(
                icon = Icons.Default.Download,
                label = "Yuklab olish",
                hint = "Telefoningizga saqlang",
                onClick = onDismiss
            )
            Spacer(Modifier.height(8.dp))
        }
    }
}

@Composable
private fun ReelShareTile(icon: ImageVector, label: String, hint: String, onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .clickable(onClick = onClick)
            .padding(vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier
                .size(40.dp)
                .background(Color.White.copy(0.08f), CircleShape),
            contentAlignment = Alignment.Center
        ) {
            Icon(icon, null, tint = Color.White, modifier = Modifier.size(20.dp))
        }
        Spacer(Modifier.width(12.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(label, color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
            Text(hint, color = Color.White.copy(0.5f), fontSize = 11.sp)
        }
        Icon(Icons.Default.ChevronRight, null, tint = Color.White.copy(0.4f), modifier = Modifier.size(20.dp))
    }
}

@Composable
private fun ReelMenuRow(icon: ImageVector, label: String, tint: Color = Color.White, onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 20.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(icon, null, tint = tint, modifier = Modifier.size(22.dp))
        Spacer(Modifier.width(14.dp))
        Text(label, color = tint, fontSize = 15.sp, fontWeight = FontWeight.Medium)
    }
}

@Composable
private fun ReelDragHandle() {
    Box(modifier = Modifier.fillMaxWidth().padding(top = 8.dp, bottom = 6.dp), contentAlignment = Alignment.Center) {
        Box(modifier = Modifier.width(38.dp).height(4.dp).background(Color.White.copy(0.25f), RoundedCornerShape(2.dp)))
    }
}

// ─────────────────────────────────────────────────────────────────────
// States
// ─────────────────────────────────────────────────────────────────────

@Composable
private fun ReelsLoadingState() {
    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(16.dp)) {
            CircularProgressIndicator(
                color = ReelPink,
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
                        Brush.radialGradient(listOf(ReelPink.copy(0.15f), Color.Transparent)),
                        CircleShape
                    ),
                contentAlignment = Alignment.Center
            ) {
                Icon(Icons.Default.Movie, null, tint = ReelPink.copy(0.7f), modifier = Modifier.size(42.dp))
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
                    .background(ReelPink)
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

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────

private fun highlightHashtagsAndMentions(text: String): AnnotatedString = buildAnnotatedString {
    val regex = Regex("([#@][\\w_]+)")
    var last = 0
    for (match in regex.findAll(text)) {
        if (match.range.first > last) append(text.substring(last, match.range.first))
        withStyle(SpanStyle(color = Color(0xFF7DD3FC), fontWeight = FontWeight.SemiBold)) {
            append(match.value)
        }
        last = match.range.last + 1
    }
    if (last < text.length) append(text.substring(last))
}

private fun reelFormatCount(count: Int): String = when {
    count >= 1_000_000 -> "${count / 1_000_000}M"
    count >= 1_000 -> "${count / 1_000}k"
    else -> count.toString()
}
