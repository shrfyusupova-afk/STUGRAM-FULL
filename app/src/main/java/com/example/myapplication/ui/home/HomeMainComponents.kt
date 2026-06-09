package com.example.myapplication.ui.home

import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.*
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.Send
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.ChatBubbleOutline
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.material3.pulltorefresh.PullToRefreshDefaults
import androidx.compose.material3.pulltorefresh.rememberPullToRefreshState
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlin.math.roundToInt

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeTabScreen(
    posts: List<PostData>,
    storyProfiles: List<StoryProfile>,
    recommendedProfiles: List<RecommendedProfile>,
    paddingValues: PaddingValues,
    accentBlue: Color,
    isDarkMode: Boolean,
    contentColor: Color,
    onThemeChange: (Boolean) -> Unit,
    onStoryClick: (Int) -> Unit,
    onCreateClick: () -> Unit,
    onCommentsClick: (PostData) -> Unit,
    isRefreshing: Boolean,
    onRefresh: () -> Unit,
    listState: LazyListState,
    myAvatar: String = "",
    onAddStoryClick: () -> Unit = {},
    onProfileClick: (String) -> Unit = {},
    onPostMoreClick: (PostData) -> Unit = {},
    onNotificationsClick: () -> Unit = {},
    onSavedClick: () -> Unit = {},
    onLoadMore: () -> Unit = {},
    isLoadingMore: Boolean = false,
    hasMore: Boolean = false,
    onHashtagClick: (String) -> Unit = {},
    onMentionClick: (String) -> Unit = {},
    onError: (String) -> Unit = {}
) {
    // Infinite scroll: oxiriga yaqinlashganda yangi postlarni yuklash
    val shouldLoadMore by remember {
        derivedStateOf {
            val layoutInfo = listState.layoutInfo
            val totalItems = layoutInfo.totalItemsCount
            val lastVisibleIndex = layoutInfo.visibleItemsInfo.lastOrNull()?.index ?: 0
            totalItems > 0 && lastVisibleIndex >= totalItems - 3
        }
    }
    LaunchedEffect(shouldLoadMore, hasMore, isLoadingMore) {
        if (shouldLoadMore && hasMore && !isLoadingMore) onLoadMore()
    }
    val pullState = rememberPullToRefreshState()
    PullToRefreshBox(
        isRefreshing = isRefreshing,
        onRefresh = onRefresh,
        state = pullState,
        modifier = Modifier.fillMaxSize(),
        indicator = {
            PullToRefreshDefaults.Indicator(
                state = pullState,
                isRefreshing = isRefreshing,
                color = accentBlue,
                containerColor = if (isDarkMode) Color(0xFF1A1A1A) else Color.White,
                modifier = Modifier.align(Alignment.TopCenter)
            )
        }
    ) {
        LazyColumn(
            state = listState,
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(
                top = paddingValues.calculateTopPadding(),
                bottom = paddingValues.calculateBottomPadding() + 80.dp
            )
        ) {
            item {
                HomeHeaderInline(
                    isDarkMode = isDarkMode,
                    onThemeChange = onThemeChange,
                    accentBlue = accentBlue,
                    contentColor = contentColor,
                    onNotificationsClick = onNotificationsClick,
                    onSavedClick = onSavedClick
                )
            }
            item {
                StoriesRow(
                    storyProfiles = storyProfiles,
                    myAvatar = myAvatar,
                    accentBlue = accentBlue,
                    isDarkMode = isDarkMode,
                    onStoryClick = onStoryClick,
                    onAddStoryClick = onAddStoryClick
                )
            }
            item {
                CreatePostButton(onCreateClick, accentBlue, isDarkMode)
            }
            if (recommendedProfiles.isNotEmpty()) {
                item {
                    RecommendedProfilesSlider(recommendedProfiles, accentBlue, isDarkMode, onError = onError)
                }
            }
            if (posts.isEmpty()) {
                item {
                    EmptyFeedSection(
                        isDarkMode = isDarkMode,
                        accentBlue = accentBlue,
                        onCreateClick = onCreateClick
                    )
                }
            } else {
                itemsIndexed(posts, key = { _, post -> post.id }) { _, post ->
                    DashboardPostItem(
                        post = post,
                        accentBlue = accentBlue,
                        isDarkMode = isDarkMode,
                        onCommentsClick = { onCommentsClick(post) },
                        onProfileClick = { onProfileClick(post.user) },
                        onMoreClick = { onPostMoreClick(post) },
                        onHashtagClick = onHashtagClick,
                        onMentionClick = onMentionClick,
                        onError = onError
                    )
                }
                if (isLoadingMore) {
                    item {
                        Box(
                            modifier = Modifier.fillMaxWidth().padding(vertical = 18.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            CircularProgressIndicator(color = accentBlue, strokeWidth = 2.5.dp, modifier = Modifier.size(28.dp))
                        }
                    }
                } else if (!hasMore && posts.isNotEmpty()) {
                    item {
                        Box(
                            modifier = Modifier.fillMaxWidth().padding(vertical = 18.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text("Hammasi shu", color = contentColor.copy(0.4f), fontSize = 11.sp)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun StoriesRow(
    storyProfiles: List<StoryProfile>,
    myAvatar: String,
    accentBlue: Color,
    isDarkMode: Boolean,
    onStoryClick: (Int) -> Unit,
    onAddStoryClick: () -> Unit
) {
    val labelColor = if (isDarkMode) Color.White else Color.Black

    // Detect if user already has a story in feed (first item with isMine = true)
    val myStoryIndex = storyProfiles.indexOfFirst { it.isMine }
    val hasMyStory = myStoryIndex >= 0
    val myStoryMedia = if (hasMyStory) storyProfiles[myStoryIndex].stories.firstOrNull()?.mediaUrl else null
    val others = storyProfiles.filterIndexed { idx, _ -> idx != myStoryIndex }

    LazyRow(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 10.dp),
        contentPadding = PaddingValues(horizontal = 12.dp),
        horizontalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        item {
            StoryCard(
                title = "Your Story",
                avatarUrl = myAvatar,
                storyMediaUrl = myStoryMedia,
                isMine = true,
                isLive = false,
                isSeen = false,
                accentBlue = accentBlue,
                labelColor = labelColor,
                onClick = {
                    if (hasMyStory) onStoryClick(myStoryIndex)
                    else onAddStoryClick()
                }
            )
        }
        items(others, key = { it.id }) { profile ->
            val originalIndex = storyProfiles.indexOf(profile)
            StoryCard(
                title = profile.name,
                avatarUrl = profile.avatar,
                storyMediaUrl = profile.stories.firstOrNull()?.mediaUrl,
                isMine = false,
                isLive = profile.isLive,
                isSeen = profile.isSeen,
                accentBlue = accentBlue,
                labelColor = labelColor,
                onClick = { onStoryClick(originalIndex) }
            )
        }
    }
}

@Composable
private fun StoryCard(
    title: String,
    avatarUrl: String,
    storyMediaUrl: String?,
    isMine: Boolean,
    isLive: Boolean,
    isSeen: Boolean,
    accentBlue: Color,
    labelColor: Color,
    onClick: () -> Unit
) {
    val hasStory = !storyMediaUrl.isNullOrBlank()
    val ringColor = when {
        isLive -> Color(0xFFFF3B6B)
        hasStory && !isSeen -> accentBlue
        hasStory && isSeen -> Color.White.copy(alpha = 0.25f)
        else -> Color.White.copy(alpha = 0.18f)
    }

    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier.width(90.dp)
    ) {
        Box(
            modifier = Modifier
                .width(90.dp)
                .height(128.dp)
                .clip(RoundedCornerShape(22.dp))
                .border(2.dp, ringColor, RoundedCornerShape(22.dp))
                .clickable { onClick() }
        ) {
            // Background: blurred story media OR avatar OR gradient
            when {
                hasStory -> {
                    AsyncImage(
                        model = storyMediaUrl,
                        contentDescription = null,
                        contentScale = ContentScale.Crop,
                        modifier = Modifier
                            .fillMaxSize()
                            .blur(12.dp)
                    )
                    // Slight scrim so avatar stays readable
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .background(Color.Black.copy(alpha = 0.18f))
                    )
                }
                avatarUrl.isNotBlank() -> {
                    AsyncImage(
                        model = avatarUrl,
                        contentDescription = null,
                        contentScale = ContentScale.Crop,
                        modifier = Modifier
                            .fillMaxSize()
                            .blur(14.dp)
                    )
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .background(Color.Black.copy(alpha = 0.35f))
                    )
                }
                else -> {
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .background(
                                Brush.linearGradient(
                                    listOf(Color(0xFF1F2937), Color(0xFF0B1220))
                                )
                            )
                    )
                }
            }

            // LIVE badge
            if (isLive) {
                Box(
                    modifier = Modifier
                        .align(Alignment.TopCenter)
                        .padding(top = 8.dp)
                        .background(accentBlue, RoundedCornerShape(8.dp))
                        .padding(horizontal = 8.dp, vertical = 3.dp)
                ) {
                    Text(
                        "LIVE",
                        color = Color.White,
                        fontSize = 10.sp,
                        fontWeight = FontWeight.ExtraBold
                    )
                }
            }

            // Center avatar
            Box(
                modifier = Modifier
                    .align(Alignment.Center)
                    .size(58.dp)
                    .clip(CircleShape)
                    .background(Color(0xFF1A1A1A))
                    .border(2.dp, Color.White, CircleShape),
                contentAlignment = Alignment.Center
            ) {
                if (avatarUrl.isNotBlank()) {
                    AsyncImage(
                        model = avatarUrl,
                        contentDescription = null,
                        contentScale = ContentScale.Crop,
                        modifier = Modifier.fillMaxSize().clip(CircleShape)
                    )
                } else {
                    Icon(
                        Icons.Default.Person,
                        contentDescription = null,
                        tint = Color.White.copy(0.6f),
                        modifier = Modifier.size(30.dp)
                    )
                }
            }

            // "+" badge for own story when none yet
            if (isMine && !hasStory) {
                Box(
                    modifier = Modifier
                        .align(Alignment.Center)
                        .offset(x = 18.dp, y = 18.dp)
                        .size(22.dp)
                        .clip(CircleShape)
                        .background(accentBlue)
                        .border(2.dp, Color(0xFF0F0F0F), CircleShape),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        Icons.Default.Add,
                        contentDescription = null,
                        tint = Color.White,
                        modifier = Modifier.size(14.dp)
                    )
                }
            }
        }

        Spacer(Modifier.height(6.dp))
        Text(
            text = title,
            color = labelColor,
            fontSize = 12.sp,
            fontWeight = FontWeight.SemiBold,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.fillMaxWidth(),
            textAlign = TextAlign.Center
        )
    }
}

@Composable
private fun EmptyFeedSection(
    isDarkMode: Boolean,
    accentBlue: Color,
    onCreateClick: () -> Unit
) {
    val textColor = if (isDarkMode) Color.White else Color.Black
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 14.dp),
        shape = RoundedCornerShape(26.dp),
        color = if (isDarkMode) Color.White.copy(alpha = 0.08f) else Color.Black.copy(alpha = 0.04f),
        border = BorderStroke(1.dp, Color.White.copy(alpha = 0.15f))
    ) {
        Column(
            modifier = Modifier.padding(horizontal = 18.dp, vertical = 18.dp),
            horizontalAlignment = Alignment.Start
        ) {
            Text(
                text = "Feed bo'sh",
                color = textColor,
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold
            )
            Spacer(Modifier.height(6.dp))
            Text(
                text = "Backenddan postlar kelganda shu yerda ko'rasiz.",
                color = textColor.copy(alpha = 0.75f),
                fontSize = 13.sp
            )
            Spacer(Modifier.height(12.dp))
            OutlinedButton(
                onClick = onCreateClick,
                border = BorderStroke(1.dp, accentBlue.copy(alpha = 0.6f)),
                colors = ButtonDefaults.outlinedButtonColors(contentColor = accentBlue)
            ) {
                Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(16.dp))
                Spacer(Modifier.width(6.dp))
                Text("Post yaratish")
            }
        }
    }
}

@Composable
fun HomeHeaderInline(
    isDarkMode: Boolean,
    onThemeChange: (Boolean) -> Unit,
    accentBlue: Color,
    contentColor: Color,
    onNotificationsClick: () -> Unit = {},
    onSavedClick: () -> Unit = {}
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .statusBarsPadding()
            .padding(horizontal = 16.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(
            "STUGRAM",
            color = accentBlue,
            fontWeight = FontWeight.Black,
            fontSize = 24.sp,
            letterSpacing = 1.sp
        )

        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier
                .clip(RoundedCornerShape(24.dp))
                .background((if (isDarkMode) Color.White else Color.Black).copy(alpha = 0.07f))
                .border(1.dp, Color.White.copy(alpha = 0.22f), RoundedCornerShape(24.dp))
                .padding(horizontal = 4.dp)
        ) {
            IconButton(onClick = { onThemeChange(!isDarkMode) }) {
                Icon(if (isDarkMode) Icons.Default.LightMode else Icons.Default.DarkMode, null, tint = contentColor)
            }
            IconButton(onClick = onSavedClick) {
                Icon(Icons.Default.BookmarkBorder, null, tint = contentColor)
            }
            IconButton(onClick = onNotificationsClick) {
                Icon(Icons.Default.NotificationsNone, null, tint = contentColor)
            }
        }
    }
}

@Composable
fun CreatePostButton(onClick: () -> Unit, accentBlue: Color, isDarkMode: Boolean) {
    Surface(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth().padding(horizontal = 24.dp, vertical = 8.dp).height(50.dp),
        shape = RoundedCornerShape(16.dp),
        color = if (isDarkMode) Color.White.copy(0.10f) else Color.White.copy(0.62f),
        border = BorderStroke(1.dp, Color.White.copy(0.2f))
    ) {
        Box {
            Box(modifier = Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(Color.White.copy(0.1f), Color.Transparent))))
            Row(
                modifier = Modifier.fillMaxSize().padding(horizontal = 16.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.AddPhotoAlternate, null, tint = accentBlue, modifier = Modifier.size(24.dp))
                    Spacer(Modifier.width(12.dp))
                    Text("Nima yangiliklar?", color = if (isDarkMode) Color.Gray else Color.DarkGray, fontSize = 14.sp)
                }
                Icon(Icons.Default.AutoAwesome, null, tint = accentBlue.copy(0.5f), modifier = Modifier.size(20.dp))
            }
        }
    }
}

@Composable
fun DashboardPostItem(
    post: PostData,
    accentBlue: Color,
    isDarkMode: Boolean,
    onCommentsClick: () -> Unit,
    onProfileClick: () -> Unit,
    onMoreClick: () -> Unit = {},
    onShareClick: () -> Unit = {},
    onHashtagClick: (String) -> Unit = {},
    onMentionClick: (String) -> Unit = {},
    onError: (String) -> Unit = {}
) {
    val glassBaseColor = if (isDarkMode) Color.Black.copy(alpha = 0.5f) else Color.White.copy(alpha = 0.75f)
    val textColor = if (isDarkMode) Color.White else Color.Black
    val iconColor = if (isDarkMode) Color.White else Color.Black

    var isLiked by remember(post.id) { mutableStateOf(false) }
    var likeCount by remember(post.id) { mutableIntStateOf(post.likes) }
    val scope = rememberCoroutineScope()
    val api = remember { com.example.myapplication.data.remote.RetrofitClient.instance }

    val revealProgress by animateFloatAsState(
        targetValue = 1f,
        animationSpec = tween(durationMillis = 360, easing = FastOutSlowInEasing),
        label = "post_reveal"
    )

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 10.dp)
            .aspectRatio(1f)
            .shadow(14.dp, RoundedCornerShape(32.dp))
            .clip(RoundedCornerShape(32.dp))
            .graphicsLayer {
                alpha = revealProgress
                translationY = (1f - revealProgress) * 30f
                scaleX = 0.98f + (0.02f * revealProgress)
                scaleY = 0.98f + (0.02f * revealProgress)
            },
        shape = RoundedCornerShape(32.dp),
        colors = CardDefaults.cardColors(containerColor = if (isDarkMode) Color.Black else Color.White)
    ) {
        Box(modifier = Modifier.fillMaxSize()) {
            // Media carousel — bir nechta media bo'lsa swipe qilinadigan pager
            val mediaItems = post.media.ifEmpty {
                if (!post.image.isNullOrBlank()) listOf(PostMedia(post.image, post.isVideo))
                else emptyList()
            }
            if (mediaItems.isEmpty()) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(if (isDarkMode) Color(0xFF1D1D1D) else Color(0xFFF0F0F0))
                )
            } else if (mediaItems.size == 1) {
                AsyncImage(
                    model = mediaItems[0].url,
                    contentDescription = null,
                    modifier = Modifier.fillMaxSize(),
                    contentScale = ContentScale.Crop
                )
            } else {
                val mediaPagerState = androidx.compose.foundation.pager.rememberPagerState(pageCount = { mediaItems.size })
                androidx.compose.foundation.pager.HorizontalPager(
                    state = mediaPagerState,
                    modifier = Modifier.fillMaxSize()
                ) { page ->
                    AsyncImage(
                        model = mediaItems[page].url,
                        contentDescription = null,
                        modifier = Modifier.fillMaxSize(),
                        contentScale = ContentScale.Crop
                    )
                }
                // Counter badge (1/3)
                Surface(
                    modifier = Modifier
                        .align(Alignment.TopEnd)
                        .padding(top = 56.dp, end = 16.dp),
                    color = Color.Black.copy(0.55f),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Text(
                        "${mediaPagerState.currentPage + 1}/${mediaItems.size}",
                        color = Color.White,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
                    )
                }
                // Page indicator dots (bottom-center, above caption panel)
                Row(
                    modifier = Modifier
                        .align(Alignment.BottomCenter)
                        .padding(bottom = 110.dp),
                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    repeat(mediaItems.size) { index ->
                        val isActive = mediaPagerState.currentPage == index
                        Box(
                            modifier = Modifier
                                .size(if (isActive) 7.dp else 5.dp)
                                .background(
                                    if (isActive) Color.White else Color.White.copy(0.5f),
                                    CircleShape
                                )
                        )
                    }
                }
            }

            // Header Overlay
            Row(
                modifier = Modifier.fillMaxWidth().padding(12.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Surface(
                    color = glassBaseColor,
                    shape = RoundedCornerShape(50.dp),
                    border = BorderStroke(0.5.dp, Color.White.copy(0.2f))
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Box(
                            modifier = Modifier
                                .size(26.dp)
                                .clip(CircleShape)
                                .background(Color.White.copy(alpha = 0.2f))
                                .clickable { onProfileClick() },
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.Person,
                                contentDescription = null,
                                tint = Color.White,
                                modifier = Modifier.size(16.dp)
                            )
                        }
                        Spacer(Modifier.width(8.dp))
                        Text(
                            text = "@${post.user.replace(" ", "_").lowercase()}",
                            color = textColor,
                            fontWeight = FontWeight.ExtraBold,
                            fontSize = 13.sp,
                            modifier = Modifier.clickable { onProfileClick() }
                        )
                        Spacer(Modifier.width(4.dp))
                        Icon(Icons.Filled.CheckCircle, null, tint = Color(0xFF3B82F6), modifier = Modifier.size(16.dp))
                    }
                }

                Surface(
                    modifier = Modifier.size(36.dp),
                    color = glassBaseColor,
                    shape = CircleShape,
                    border = BorderStroke(0.5.dp, Color.White.copy(0.2f)),
                    onClick = onMoreClick
                ) {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Icon(Icons.Default.MoreHoriz, null, tint = iconColor, modifier = Modifier.size(18.dp))
                    }
                }
            }

            // Bottom Panel
            Surface(
                modifier = Modifier.align(Alignment.BottomCenter).padding(10.dp).fillMaxWidth(),
                color = glassBaseColor,
                shape = RoundedCornerShape(26.dp),
                border = BorderStroke(0.5.dp, Color.White.copy(0.2f))
            ) {
                Column(modifier = Modifier.padding(8.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        PostStatItem(
                            icon = if (isLiked) Icons.Default.Favorite else Icons.Default.FavoriteBorder,
                            count = likeCount.toString(),
                            isDarkMode = isDarkMode,
                            tint = if (isLiked) Color(0xFFFF3B6B) else iconColor,
                            onClick = {
                                val previousLiked = isLiked
                                isLiked = !previousLiked
                                likeCount += if (!previousLiked) 1 else -1
                                scope.launch {
                                    try {
                                        val resp = if (!previousLiked) api.likePost(post.id) else api.unlikePost(post.id)
                                        if (!resp.isSuccessful) {
                                            isLiked = previousLiked
                                            likeCount += if (previousLiked) 1 else -1
                                            onError(
                                                if (!previousLiked) "Like qo'shilmadi (${resp.code()})"
                                                else "Like olib tashlanmadi (${resp.code()})"
                                            )
                                        }
                                    } catch (e: Exception) {
                                        isLiked = previousLiked
                                        likeCount += if (previousLiked) 1 else -1
                                        onError("Tarmoq xatosi: ${e.message ?: "noma'lum"}")
                                    }
                                }
                            }
                        )
                        Spacer(Modifier.width(12.dp))
                        Icon(
                            Icons.Outlined.ChatBubbleOutline,
                            null,
                            tint = iconColor,
                            modifier = Modifier
                                .size(20.dp)
                                .clickable(
                                    indication = null,
                                    interactionSource = remember { MutableInteractionSource() },
                                    onClick = onCommentsClick
                                )
                        )
                        Spacer(Modifier.width(12.dp))
                        Icon(
                            Icons.AutoMirrored.Rounded.Send,
                            null,
                            tint = iconColor,
                            modifier = Modifier
                                .size(20.dp)
                                .clickable(
                                    indication = null,
                                    interactionSource = remember { MutableInteractionSource() },
                                    onClick = onShareClick
                                )
                        )
                    }
                    Spacer(Modifier.height(4.dp))
                    if (post.caption.isNotBlank()) {
                        ClickableHashtagMentionText(
                            text = post.caption,
                            textColor = textColor,
                            linkColor = accentBlue,
                            fontSize = 13.sp,
                            maxLines = 1,
                            onHashtagClick = onHashtagClick,
                            onMentionClick = onMentionClick
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun PostStatItem(icon: ImageVector, count: String, isDarkMode: Boolean, tint: Color? = null, onClick: (() -> Unit)? = null) {
    val textColor = if (isDarkMode) Color.White else Color.Black
    val rowModifier = if (onClick != null) Modifier.clickable { onClick() } else Modifier
    Row(verticalAlignment = Alignment.CenterVertically, modifier = rowModifier) {
        Icon(icon, null, tint = tint ?: textColor, modifier = Modifier.size(20.dp))
        Spacer(Modifier.width(4.dp))
        Text(count, color = textColor, fontWeight = FontWeight.Bold, fontSize = 12.sp)
    }
}

@Composable
fun RecommendedProfilesSlider(
    profiles: List<RecommendedProfile>,
    accentBlue: Color,
    isDarkMode: Boolean,
    onError: (String) -> Unit = {}
) {
    Column(modifier = Modifier.padding(vertical = 12.dp)) {
        Text("Tavsiya etilganlar", fontSize = 17.sp, fontWeight = FontWeight.Bold, color = if (isDarkMode) Color.White else Color.Black, modifier = Modifier.padding(start = 20.dp, bottom = 12.dp))
        LazyRow(contentPadding = PaddingValues(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(16.dp)) {
            items(profiles) { profile -> RecommendedProfileCard(profile, accentBlue, isDarkMode, onError) }
        }
    }
}

@Composable
fun RecommendedProfileCard(
    profile: RecommendedProfile,
    accentBlue: Color,
    isDarkMode: Boolean,
    onError: (String) -> Unit = {}
) {
    var isFollowed by remember(profile.id) { mutableStateOf(profile.followStatus == "following") }
    var isBusy by remember(profile.id) { mutableStateOf(false) }
    val cardBg = if (isDarkMode) Color(0xFF1A1A1A) else Color.White
    val textColor = if (isDarkMode) Color.White else Color.Black
    val scope = rememberCoroutineScope()
    val api = remember { com.example.myapplication.data.remote.RetrofitClient.instance }

    Card(
        modifier = Modifier
            .width(180.dp)
            .height(260.dp),
        shape = RoundedCornerShape(24.dp),
        colors = CardDefaults.cardColors(containerColor = cardBg),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(modifier = Modifier.fillMaxSize()) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f)
                    .padding(8.dp)
                    .clip(RoundedCornerShape(18.dp))
            ) {
                AsyncImage(
                    model = profile.avatar,
                    contentDescription = null,
                    modifier = Modifier.fillMaxSize(),
                    contentScale = ContentScale.Crop
                )
            }

            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 12.dp, vertical = 4.dp)
            ) {
                Text(
                    text = profile.name,
                    color = textColor,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Text(
                    text = "@${profile.username}",
                    color = accentBlue,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Medium,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }

            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(12.dp)
            ) {
                val buttonColor by animateColorAsState(
                    if (isFollowed) Color.White.copy(alpha = 0.1f) else accentBlue,
                    animationSpec = tween(150, easing = FastOutSlowInEasing),
                    label = "buttonColor"
                )
                
                Surface(
                    onClick = {
                        if (isBusy) return@Surface
                        val previous = isFollowed
                        isFollowed = !previous
                        isBusy = true
                        scope.launch {
                            try {
                                val resp = if (!previous) api.followUser(profile.id) else api.unfollowUser(profile.id)
                                if (!resp.isSuccessful) {
                                    isFollowed = previous
                                    onError(
                                        if (!previous) "Obuna bo'lib bo'lmadi (${resp.code()})"
                                        else "Obunani bekor qilib bo'lmadi (${resp.code()})"
                                    )
                                }
                            } catch (e: Exception) {
                                isFollowed = previous
                                onError("Tarmoq xatosi: ${e.message ?: "noma'lum"}")
                            } finally {
                                isBusy = false
                            }
                        }
                    },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(36.dp),
                    shape = RoundedCornerShape(12.dp),
                    color = buttonColor,
                    border = if (isFollowed) BorderStroke(1.dp, Color.White.copy(alpha = 0.2f)) else null
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .background(
                                Brush.verticalGradient(
                                    listOf(Color.White.copy(alpha = 0.15f), Color.Transparent)
                                )
                            ),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = if (isFollowed) "Following" else "Follow",
                            color = if (isFollowed) accentBlue else Color.White,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.ExtraBold
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun GlassSlidingNavigation(
    selectedTab: Int,
    onTabSelected: (Int) -> Unit,
    onCreatePost: () -> Unit = {},
    isDarkMode: Boolean,
    modifier: Modifier = Modifier
) {
    val items = listOf(
        TabItem("Home", Icons.Rounded.Home),
        TabItem("Search", Icons.Rounded.Search),
        TabItem("Reels", Icons.Rounded.Movie),
        TabItem("Messages", Icons.Rounded.ChatBubble),
        TabItem("Profile", Icons.Rounded.Person)
    )

    val accentBlue = Color(0xFF00A3FF)
    val accentEnd  = Color(0xFF5EA3FF)
    val contentColor = if (isDarkMode) Color.White else Color.Black
    val surfaceTint  = if (isDarkMode) Color(0xFF0F0F0F).copy(0.78f) else Color.White.copy(0.72f)
    val borderTint   = if (isDarkMode) Color.White.copy(0.10f) else Color.Black.copy(0.06f)
    val density = LocalDensity.current

    // Spring-animated index — snappy, barely-bouncy Telegram-style pill
    val animatedIndex by animateFloatAsState(
        targetValue = selectedTab.toFloat(),
        animationSpec = spring(
            dampingRatio = 0.82f,
            stiffness = 500f
        ),
        label = "nav_index"
    )

    Box(
        modifier = modifier
            .width(320.dp)
            .height(66.dp)
            .shadow(
                elevation = 18.dp,
                shape = RoundedCornerShape(33.dp),
                ambientColor = accentBlue.copy(0.15f),
                spotColor = accentBlue.copy(0.25f)
            )
            .clip(RoundedCornerShape(33.dp))
            // Liquid-glass body: subtle gradient + translucent tint
            .background(
                Brush.linearGradient(
                    listOf(
                        surfaceTint,
                        surfaceTint.copy(alpha = (surfaceTint.alpha - 0.08f).coerceAtLeast(0.5f))
                    )
                )
            )
            .border(1.dp, borderTint, RoundedCornerShape(33.dp))
    ) {
        // Glassy top highlight (the "wet" sheen on liquid glass)
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(28.dp)
                .align(Alignment.TopCenter)
                .background(
                    Brush.verticalGradient(
                        listOf(Color.White.copy(0.10f), Color.Transparent)
                    )
                )
        )

        BoxWithConstraints(modifier = Modifier.fillMaxSize()) {
            val tabWidthDp = maxWidth / items.size
            val tabWidthPx = with(density) { tabWidthDp.toPx() }
            val pillOffsetPx = (animatedIndex * tabWidthPx)
                .coerceIn(0f, (items.size - 1) * tabWidthPx)

            // Soft outer glow behind the sliding pill — creates the "liquid" feel
            Box(
                modifier = Modifier
                    .offset { IntOffset(pillOffsetPx.roundToInt(), 0) }
                    .width(tabWidthDp)
                    .fillMaxHeight()
                    .padding(horizontal = 6.dp, vertical = 10.dp)
                    .blur(18.dp)
                    .background(
                        Brush.radialGradient(listOf(accentBlue.copy(0.55f), Color.Transparent)),
                        CircleShape
                    )
            )

            // The sliding pill itself — gradient fill with inner sheen
            Box(
                modifier = Modifier
                    .offset { IntOffset(pillOffsetPx.roundToInt(), 0) }
                    .width(tabWidthDp)
                    .fillMaxHeight()
                    .padding(horizontal = 8.dp, vertical = 10.dp)
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .clip(RoundedCornerShape(50))
                        .background(
                            Brush.linearGradient(listOf(accentBlue, accentEnd))
                        )
                        .border(
                            1.dp,
                            Brush.verticalGradient(listOf(Color.White.copy(0.45f), Color.White.copy(0.05f))),
                            RoundedCornerShape(50)
                        )
                ) {
                    // Inner top sheen on the pill (liquid glass highlight)
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(14.dp)
                            .align(Alignment.TopCenter)
                            .clip(RoundedCornerShape(topStart = 50f, topEnd = 50f, bottomStart = 50f, bottomEnd = 50f))
                            .background(
                                Brush.verticalGradient(
                                    listOf(Color.White.copy(0.35f), Color.Transparent)
                                )
                            )
                    )
                }
            }

            // Icons row sits on top of the pill
            Row(modifier = Modifier.fillMaxSize(), verticalAlignment = Alignment.CenterVertically) {
                items.forEachIndexed { index, item ->
                    val isSelected = selectedTab == index
                    val tint by animateColorAsState(
                        targetValue = if (isSelected) Color.White else contentColor.copy(0.6f),
                        animationSpec = tween(150, easing = FastOutSlowInEasing),
                        label = "icon_tint_$index"
                    )
                    val scale by animateFloatAsState(
                        targetValue = if (isSelected) 1.12f else 1f,
                        animationSpec = spring(
                            dampingRatio = 0.82f,
                            stiffness = 500f
                        ),
                        label = "icon_scale_$index"
                    )
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .fillMaxHeight()
                            .clickable(
                                indication = null,
                                interactionSource = remember { MutableInteractionSource() }
                            ) { onTabSelected(index) },
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            item.icon,
                            contentDescription = item.name,
                            tint = tint,
                            modifier = Modifier
                                .size(26.dp)
                                .graphicsLayer { scaleX = scale; scaleY = scale }
                        )
                    }
                }
            }
        }
    }
}

