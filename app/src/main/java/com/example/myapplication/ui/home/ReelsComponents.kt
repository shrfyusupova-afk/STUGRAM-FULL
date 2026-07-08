package com.example.myapplication.ui.home

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.pager.VerticalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.Send
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.FavoriteBorder
import androidx.compose.material.icons.filled.Movie
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.outlined.ChatBubbleOutline
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import coil.compose.AsyncImage
import com.example.myapplication.core.ui.UiState
import com.example.myapplication.ui.comments.CommentsSheet
import com.example.myapplication.ui.reels.ReelsViewModel
import com.example.myapplication.ui.video.FeedVideoPlayer
import kotlinx.coroutines.launch

/**
 * Reels tab: vertical pager over real video posts from GET /api/v1/reels/me,
 * with Media3 playback (auto-play on the settled page, muted by default) and
 * full Loading/Error/Empty states.
 */
@Composable
fun ReelsScreen(
    accentBlue: Color,
    isDarkMode: Boolean,
    onProfileClick: (String) -> Unit,
    viewModel: ReelsViewModel = viewModel()
) {
    Box(modifier = Modifier.fillMaxSize().background(Color.Black)) {
        when (val state = viewModel.reelsState) {
            is UiState.Loading -> {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = accentBlue)
                }
            }
            is UiState.Error -> {
                Column(
                    modifier = Modifier.fillMaxSize().padding(24.dp),
                    verticalArrangement = Arrangement.Center,
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(state.message, color = Color.White.copy(alpha = 0.85f), fontSize = 14.sp)
                    Spacer(Modifier.height(12.dp))
                    Button(
                        onClick = { viewModel.reload() },
                        colors = ButtonDefaults.buttonColors(containerColor = accentBlue)
                    ) { Text("Qayta urinish", color = Color.White) }
                }
            }
            is UiState.Empty -> {
                Column(
                    modifier = Modifier.fillMaxSize().padding(24.dp),
                    verticalArrangement = Arrangement.Center,
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Icon(Icons.Default.Movie, contentDescription = null, tint = accentBlue, modifier = Modifier.size(40.dp))
                    Spacer(Modifier.height(12.dp))
                    Text("Reels hali yo'q — birinchi bo'ling!", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 18.sp)
                    Spacer(Modifier.height(6.dp))
                    Text(
                        "Video post yuklang — u shu yerda ko'rinadi.",
                        color = Color.White.copy(alpha = 0.7f),
                        fontSize = 13.sp
                    )
                }
            }
            is UiState.Success -> {
                val reels = state.data
                val pagerState = rememberPagerState(pageCount = { reels.size })

                // Load the next page when the user is 2 reels from the end.
                LaunchedEffect(pagerState, reels.size) {
                    snapshotFlow { pagerState.settledPage }
                        .collect { settled -> if (settled >= reels.size - 2) viewModel.loadMore() }
                }

                VerticalPager(
                    state = pagerState,
                    modifier = Modifier.fillMaxSize(),
                    beyondViewportPageCount = 1
                ) { page ->
                    val reel = reels[page]
                    ReelItem(
                        reel = reel,
                        isActive = pagerState.settledPage == page,
                        accentBlue = accentBlue,
                        onLike = { postId, like -> viewModel.setLike(postId, like) },
                        onCommentsClick = { viewModel.openComments(reel.id) },
                        onProfileClick = onProfileClick
                    )
                }

                if (viewModel.isLoadingMore) {
                    CircularProgressIndicator(
                        color = accentBlue,
                        strokeWidth = 2.dp,
                        modifier = Modifier.align(Alignment.TopEnd).padding(16.dp).size(20.dp)
                    )
                }
            }
        }
    }

    viewModel.activeCommentsPostId?.let { postId ->
        CommentsSheet(
            postId = postId,
            isDarkMode = isDarkMode,
            accentBlue = accentBlue,
            onDismiss = { viewModel.closeComments() }
        )
    }
}

@Composable
private fun ReelItem(
    reel: PostData,
    isActive: Boolean,
    accentBlue: Color,
    onLike: suspend (String, Boolean) -> Boolean,
    onCommentsClick: () -> Unit,
    onProfileClick: (String) -> Unit
) {
    val scope = rememberCoroutineScope()
    var isLiked by remember(reel.id) { mutableStateOf(false) }
    var likeCount by remember(reel.id) { mutableIntStateOf(reel.likes) }
    var isCaptionExpanded by remember(reel.id) { mutableStateOf(false) }

    Box(modifier = Modifier.fillMaxSize()) {
        val videoUrl = reel.videoUrl
        if (videoUrl != null) {
            FeedVideoPlayer(
                videoUrl = videoUrl,
                isActive = isActive,
                modifier = Modifier.fillMaxSize(),
                accent = accentBlue
            )
        }

        // Readability gradients (top + bottom), drawn over the video but under controls.
        Box(
            modifier = Modifier.fillMaxSize().background(
                Brush.verticalGradient(
                    listOf(Color.Black.copy(0.25f), Color.Transparent, Color.Black.copy(0.55f))
                )
            )
        )

        // Right-side interactions
        Column(
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .padding(end = 12.dp, bottom = 110.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(20.dp)
        ) {
            ReelInteractionButton(
                icon = if (isLiked) Icons.Default.Favorite else Icons.Default.FavoriteBorder,
                label = likeCount.toString(),
                tint = if (isLiked) Color.Red else Color.White,
                onClick = {
                    val prevLiked = isLiked
                    val prevCount = likeCount
                    isLiked = !isLiked
                    likeCount = (likeCount + if (isLiked) 1 else -1).coerceAtLeast(0)
                    scope.launch {
                        if (!onLike(reel.id, isLiked)) {
                            isLiked = prevLiked
                            likeCount = prevCount
                        }
                    }
                }
            )
            ReelInteractionButton(
                icon = Icons.Outlined.ChatBubbleOutline,
                label = reel.comments.toString(),
                onClick = onCommentsClick
            )
            ReelInteractionButton(icon = Icons.AutoMirrored.Rounded.Send, label = "Ulashish")
        }

        // Bottom-left author + caption
        Column(
            modifier = Modifier
                .align(Alignment.BottomStart)
                .padding(start = 16.dp, bottom = 110.dp, end = 80.dp)
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                if (reel.avatar.isNullOrBlank()) {
                    Box(
                        modifier = Modifier
                            .size(36.dp)
                            .clip(CircleShape)
                            .background(Color.White.copy(alpha = 0.25f))
                            .clickable { onProfileClick(reel.user) },
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(Icons.Default.Person, null, tint = Color.White, modifier = Modifier.size(20.dp))
                    }
                } else {
                    AsyncImage(
                        model = reel.avatar,
                        contentDescription = null,
                        modifier = Modifier
                            .size(36.dp)
                            .clip(CircleShape)
                            .clickable { onProfileClick(reel.user) },
                        contentScale = ContentScale.Crop
                    )
                }
                Spacer(Modifier.width(10.dp))
                Text(
                    text = "@${reel.user}",
                    color = Color.White,
                    fontWeight = FontWeight.Bold,
                    fontSize = 15.sp,
                    modifier = Modifier.clickable { onProfileClick(reel.user) }
                )
            }
            if (reel.caption.isNotBlank()) {
                Spacer(Modifier.height(10.dp))
                Text(
                    text = reel.caption,
                    color = Color.White,
                    fontSize = 14.sp,
                    maxLines = if (isCaptionExpanded) 10 else 2,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.clickable { isCaptionExpanded = !isCaptionExpanded }
                )
            }
        }
    }
}

@Composable
private fun ReelInteractionButton(
    icon: ImageVector,
    label: String,
    tint: Color = Color.White,
    onClick: () -> Unit = {}
) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier.clickable { onClick() }
    ) {
        Icon(icon, contentDescription = label, tint = tint, modifier = Modifier.size(30.dp))
        Spacer(Modifier.height(4.dp))
        Text(label, color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
    }
}
