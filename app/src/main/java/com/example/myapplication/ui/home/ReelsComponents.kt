package com.example.myapplication.ui.home

import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.*
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.pager.VerticalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.Send
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
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

@Composable
fun ReelsScreen(accentBlue: Color, isDarkMode: Boolean, onProfileClick: (String) -> Unit) {
    val reels = remember { (1..10).map { PostData(it.toString(), "user_$it", "https://picsum.photos/seed/reel$it/800/1400", isVideo = true) } }
    val pagerState = rememberPagerState(pageCount = { reels.size })
    var showSettingsModal by remember { mutableStateOf(false) }
    var showCommentsSheet by remember { mutableStateOf(false) }
    var isAutoScroll by remember { mutableStateOf(false) }

    LaunchedEffect(isAutoScroll, pagerState.currentPage) {
        if (isAutoScroll) {
            while (true) {
                delay(5000)
                if (pagerState.currentPage < reels.size - 1) {
                    pagerState.animateScrollToPage(pagerState.currentPage + 1)
                } else {
                    pagerState.animateScrollToPage(0)
                }
            }
        }
    }

    // Reels butun ekranni egallashi uchun Scaffold'siz to'g'ridan-to'g'ri Box ishlatamiz
    Box(modifier = Modifier.fillMaxSize().background(Color.Black)) {
        VerticalPager(
            state = pagerState,
            modifier = Modifier.fillMaxSize(),
            beyondViewportPageCount = 1
        ) { page ->
            ReelItem(
                reel = reels[page],
                accentBlue = accentBlue,
                onMoreClick = { showSettingsModal = true },
                onCommentsClick = { showCommentsSheet = true },
                onProfileClick = onProfileClick
            )
        }
    }

    if (showSettingsModal) {
        ReelsSettingsModal(
            onDismiss = { showSettingsModal = false },
            accentBlue = accentBlue,
            isAutoScroll = isAutoScroll,
            onToggleAutoScroll = { isAutoScroll = !isAutoScroll }
        )
    }

    if (showCommentsSheet) {
        CommentsBottomSheet(
            isDarkMode = isDarkMode,
            accentBlue = accentBlue,
            onDismiss = { showCommentsSheet = false }
        )
    }
}

@Composable
fun ReelItem(
    reel: PostData,
    accentBlue: Color,
    onMoreClick: () -> Unit,
    onCommentsClick: () -> Unit,
    onProfileClick: (String) -> Unit
) {
    var isCaptionExpanded by remember { mutableStateOf(false) }
    var isLikedInternal by remember { mutableStateOf(false) }
    var showLikeHeart by remember { mutableStateOf(false) }
    var heartOffset by remember { mutableStateOf(androidx.compose.ui.geometry.Offset.Zero) }
    val scope = rememberCoroutineScope()

    Box(modifier = Modifier.fillMaxSize()) {
        // Asosiy kontent (Video o'rniga rasm)
        AsyncImage(
            model = reel.image,
            contentDescription = null,
            modifier = Modifier
                .fillMaxSize()
                .pointerInput(Unit) {
                    detectTapGestures(
                        onDoubleTap = { offset ->
                            isLikedInternal = true
                            heartOffset = offset
                            showLikeHeart = true
                            scope.launch { delay(800); showLikeHeart = false }
                        }
                    )
                },
            contentScale = ContentScale.Crop
        )

        // Gradient qoplamalar (Yaxshiroq o'qilishi uchun)
        Box(modifier = Modifier.fillMaxSize().background(
            Brush.verticalGradient(
                listOf(Color.Black.copy(0.3f), Color.Transparent, Color.Black.copy(0.6f))
            )
        ))

        // O'ng tomondagi tugmalar (Interaksiya)
        Column(
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .padding(end = 12.dp, bottom = 100.dp), // Navigatsiyadan yuqorida turishi uchun
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(20.dp)
        ) {
            ReelInteractionButton(
                icon = if (isLikedInternal) Icons.Default.Favorite else Icons.Default.FavoriteBorder,
                label = (reel.likes + if (isLikedInternal) 1 else 0).toString(),
                tint = if (isLikedInternal) Color.Red else Color.White,
                onClick = { isLikedInternal = !isLikedInternal }
            )
            ReelInteractionButton(Icons.Default.ChatBubbleOutline, reel.comments.toString(), onClick = onCommentsClick)
            ReelInteractionButton(Icons.AutoMirrored.Rounded.Send, "Send")
            IconButton(onClick = onMoreClick) {
                Icon(Icons.Default.MoreVert, null, tint = Color.White, modifier = Modifier.size(28.dp))
            }
        }

        // Pastki ma'lumotlar (User, Caption)
        Column(
            modifier = Modifier
                .align(Alignment.BottomStart)
                .padding(start = 16.dp, bottom = 100.dp, end = 80.dp) // O'ng tomondagi tugmalarga tegmasligi uchun
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                AsyncImage(
                    model = "https://picsum.photos/seed/a1/100/100",
                    contentDescription = null,
                    modifier = Modifier
                        .size(36.dp)
                        .clip(CircleShape)
                        .border(1.5.dp, Color.White, CircleShape)
                        .clickable { onProfileClick(reel.user) }
                )
                Spacer(Modifier.width(10.dp))
                Text(
                    text = reel.user,
                    color = Color.White,
                    fontWeight = FontWeight.Bold,
                    fontSize = 15.sp,
                    modifier = Modifier.clickable { onProfileClick(reel.user) }
                )
                Spacer(Modifier.width(12.dp))
                Surface(
                    color = Color.White.copy(alpha = 0.2f),
                    shape = RoundedCornerShape(8.dp),
                    border = BorderStroke(1.dp, Color.White.copy(alpha = 0.3f))
                ) {
                    Text(
                        "Follow",
                        color = Color.White,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp).clickable { }
                    )
                }
            }
            Spacer(Modifier.height(12.dp))
            Text(
                text = reel.caption,
                color = Color.White,
                fontSize = 14.sp,
                maxLines = if (isCaptionExpanded) 10 else 2,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier
                    .animateContentSize()
                    .clickable(
                        interactionSource = remember { MutableInteractionSource() },
                        indication = null
                    ) { isCaptionExpanded = !isCaptionExpanded }
            )
        }

        if (showLikeHeart) {
            PopLikeAnimation(heartOffset)
        }
    }
}

@Composable
fun ReelInteractionButton(icon: ImageVector, label: String, tint: Color = Color.White, onClick: () -> Unit = {}) {
    Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.clickable { onClick() }) {
        Icon(icon, null, tint = tint, modifier = Modifier.size(30.dp))
        Spacer(Modifier.height(4.dp))
        Text(label, color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ReelsSettingsModal(onDismiss: () -> Unit, accentBlue: Color, isAutoScroll: Boolean, onToggleAutoScroll: () -> Unit) {
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        containerColor = Color(0xFF1A1A1A),
        shape = RoundedCornerShape(topStart = 32.dp, topEnd = 32.dp)
    ) {
        Column(modifier = Modifier.padding(24.dp).fillMaxWidth().navigationBarsPadding(), horizontalAlignment = Alignment.CenterHorizontally) {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                ReelSettingMainItem(Icons.Default.BookmarkBorder, "Save", Modifier.weight(1f))
                ReelSettingMainItem(if (isAutoScroll) Icons.Default.PauseCircleFilled else Icons.Default.PlayCircleFilled, if (isAutoScroll) "Stop Auto" else "Auto Scroll", Modifier.weight(1f), onClick = { onToggleAutoScroll(); onDismiss() })
                ReelSettingMainItem(Icons.Default.QrCode, "QR Code", Modifier.weight(1f))
            }
            Spacer(Modifier.height(24.dp))
            ReelSettingListItem(Icons.Default.Report, "Report")
            ReelSettingListItem(Icons.Default.StarOutline, "Add to Favorites")
            ReelSettingListItem(Icons.Default.PersonRemoveAlt1, "Unfollow")
            Spacer(Modifier.height(32.dp))
        }
    }
}

@Composable
fun ReelSettingMainItem(icon: ImageVector, label: String, modifier: Modifier = Modifier, onClick: () -> Unit = {}) {
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(16.dp))
            .background(Color.White.copy(0.08f))
            .clickable { onClick() }
            .padding(12.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Icon(icon, null, tint = Color.White, modifier = Modifier.size(28.dp))
        Spacer(Modifier.height(8.dp))
        Text(label, color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
    }
}

@Composable
fun ReelSettingListItem(icon: ImageVector, label: String, onClick: () -> Unit = {}) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onClick() }
            .padding(vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(icon, null, tint = Color.White, modifier = Modifier.size(24.dp))
        Spacer(Modifier.width(16.dp))
        Text(label, color = Color.White, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
    }
}
