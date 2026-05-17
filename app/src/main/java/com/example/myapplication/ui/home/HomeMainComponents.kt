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
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

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
    onCommentsClick: () -> Unit,
    isRefreshing: Boolean,
    onRefresh: () -> Unit,
    listState: LazyListState
) {
    PullToRefreshBox(
        isRefreshing = isRefreshing,
        onRefresh = onRefresh,
        modifier = Modifier.fillMaxSize(),
        indicator = {
            PullToRefreshDefaults.Indicator(
                state = rememberPullToRefreshState(),
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
                HomeHeaderInline(isDarkMode, onThemeChange, accentBlue, contentColor)
            }
            item {
                EmptyStoriesSection(isDarkMode = isDarkMode, accentBlue = accentBlue)
            }
            item {
                CreatePostButton(onCreateClick, accentBlue, isDarkMode)
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
                itemsIndexed(posts) { index, post ->
                    DashboardPostItem(post, accentBlue, isDarkMode, onCommentsClick) {
                        // Profile click logic
                    }
                }
            }
        }
    }
}

@Composable
private fun EmptyStoriesSection(isDarkMode: Boolean, accentBlue: Color) {
    val textColor = if (isDarkMode) Color.White else Color.Black
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp),
        shape = RoundedCornerShape(20.dp),
        color = if (isDarkMode) Color.White.copy(alpha = 0.08f) else Color.Black.copy(alpha = 0.04f),
        border = BorderStroke(1.dp, Color.White.copy(alpha = 0.15f))
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 14.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(Icons.Default.AutoStories, contentDescription = null, tint = accentBlue, modifier = Modifier.size(20.dp))
            Spacer(Modifier.width(10.dp))
            Text(
                text = "Stories hozircha yo'q",
                color = textColor.copy(alpha = 0.85f),
                fontSize = 13.sp,
                fontWeight = FontWeight.Medium
            )
        }
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
    contentColor: Color
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
            Icon(
                Icons.Default.NotificationsNone,
                null,
                tint = contentColor.copy(alpha = 0.6f),
                modifier = Modifier.padding(horizontal = 12.dp)
            )
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
    onProfileClick: () -> Unit
) {
    val glassBaseColor = if (isDarkMode) Color.Black.copy(alpha = 0.5f) else Color.White.copy(alpha = 0.75f)
    val textColor = if (isDarkMode) Color.White else Color.Black
    val iconColor = if (isDarkMode) Color.White else Color.Black

    val revealProgress by animateFloatAsState(
        targetValue = 1f,
        animationSpec = tween(durationMillis = 500, easing = EaseOutCubic),
        label = "post_reveal"
    )

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 10.dp)
            .aspectRatio(1f)
            .shadow(14.dp, RoundedCornerShape(32.dp))
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
            Box(modifier = Modifier.fillMaxSize()) {
                AsyncImage(
                    model = post.image,
                    contentDescription = null,
                    modifier = Modifier.fillMaxSize(),
                    contentScale = ContentScale.Crop
                )
                if (post.image.isNullOrBlank()) {
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .background(if (isDarkMode) Color(0xFF1D1D1D) else Color(0xFFF0F0F0))
                    )
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
                    border = BorderStroke(0.5.dp, Color.White.copy(0.2f))
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
                            icon = Icons.Default.FavoriteBorder,
                            count = post.likes.toString(),
                            isDarkMode = isDarkMode,
                            tint = iconColor
                        )
                        Spacer(Modifier.width(12.dp))
                        Icon(Icons.Outlined.ChatBubbleOutline, null, tint = iconColor, modifier = Modifier.size(20.dp))
                        Spacer(Modifier.width(12.dp))
                        Icon(Icons.AutoMirrored.Rounded.Send, null, tint = iconColor, modifier = Modifier.size(20.dp))
                    }
                    Spacer(Modifier.height(4.dp))
                    Text(text = post.caption, color = textColor, fontSize = 13.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
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
fun RecommendedProfilesSlider(profiles: List<RecommendedProfile>, accentBlue: Color, isDarkMode: Boolean) {
    Column(modifier = Modifier.padding(vertical = 12.dp)) {
        Text("Tavsiya etilganlar", fontSize = 17.sp, fontWeight = FontWeight.Bold, color = if (isDarkMode) Color.White else Color.Black, modifier = Modifier.padding(start = 20.dp, bottom = 12.dp))
        LazyRow(contentPadding = PaddingValues(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(16.dp)) {
            items(profiles) { profile -> RecommendedProfileCard(profile, accentBlue, isDarkMode) }
        }
    }
}

@Composable
fun RecommendedProfileCard(profile: RecommendedProfile, accentBlue: Color, isDarkMode: Boolean) {
    var isFollowed by remember { mutableStateOf(false) }
    val cardBg = if (isDarkMode) Color(0xFF1A1A1A) else Color.White
    val textColor = if (isDarkMode) Color.White else Color.Black

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
                    model = profile.image,
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
                    animationSpec = tween(300),
                    label = "buttonColor"
                )
                
                Surface(
                    onClick = { isFollowed = !isFollowed },
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

    val backgroundColor = if (isDarkMode) Color(0xFF0F0F0F).copy(0.84f) else Color.White.copy(0.78f)
    val contentColor = if (isDarkMode) Color.White else Color.Black
    val accentBlue = Color(0xFF00A3FF)

    Surface(
        modifier = modifier.width(320.dp).height(66.dp),
        shape = RoundedCornerShape(33.dp),
        color = backgroundColor,
        border = BorderStroke(1.dp, Color.White.copy(0.1f)),
        shadowElevation = 8.dp
    ) {
        Row(modifier = Modifier.fillMaxSize(), verticalAlignment = Alignment.CenterVertically) {
            items.forEachIndexed { index, item ->
                val isSelected = selectedTab == index
                val glow by animateFloatAsState(
                    targetValue = if (isSelected) 1f else 0f,
                    animationSpec = tween(220),
                    label = "nav_glow"
                )
                Box(modifier = Modifier.weight(1f).fillMaxHeight().clickable { onTabSelected(index) }, contentAlignment = Alignment.Center) {
                    Box(
                        modifier = Modifier
                            .size(36.dp)
                            .blur(14.dp)
                            .background(
                                accentBlue.copy(alpha = 0.28f * glow),
                                CircleShape
                            )
                    )
                    val color by animateColorAsState(if (isSelected) accentBlue else contentColor.copy(0.6f), label = "iconColor")
                    Icon(item.icon, null, tint = color, modifier = Modifier.size(26.dp))
                }
            }
        }
    }
}

