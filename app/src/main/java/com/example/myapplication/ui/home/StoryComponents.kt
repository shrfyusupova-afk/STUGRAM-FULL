package com.example.myapplication.ui.home

import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.*
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.waitForUpOrCancellation
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.Send
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.*
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import kotlinx.coroutines.delay

@Composable
fun RectangleStoryItem(story: StoryProfile, accentBlue: Color, isDarkMode: Boolean, onClick: () -> Unit) {
    val borderColor = if (story.isLive) accentBlue else if (story.isSeen) Color.Gray.copy(0.3f) else accentBlue
    
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Box(
            modifier = Modifier
                .width(100.dp)
                .height(150.dp)
                .clip(RoundedCornerShape(20.dp))
                .clickable { onClick() }
        ) {
            // Animated ring for live or new stories
            if (story.isLive || !story.isSeen) {
                AnimatedStoryRing {
                    StoryContent(story, borderColor, accentBlue)
                }
            } else {
                StoryContent(story, borderColor, accentBlue)
            }
        }
    }
}

@Composable
private fun StoryContent(story: StoryProfile, borderColor: Color, accentBlue: Color) {
    Box(modifier = Modifier.fillMaxSize().border(2.dp, borderColor, RoundedCornerShape(20.dp))) {
        AsyncImage(
            model = story.stories.firstOrNull()?.mediaUrl,
            contentDescription = null,
            modifier = Modifier.fillMaxSize().blur(4.dp),
            contentScale = ContentScale.Crop
        )
        Box(modifier = Modifier.fillMaxSize().background(Color.Black.copy(0.3f)))
        Box(modifier = Modifier.align(Alignment.Center).offset(y = 20.dp).size(44.dp).clip(CircleShape).border(2.dp, Color.White, CircleShape)) {
            AsyncImage(model = story.avatar, contentDescription = null, modifier = Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
        }
        if (story.isLive) {
            Surface(color = Color.Red, shape = RoundedCornerShape(4.dp), modifier = Modifier.align(Alignment.TopCenter).padding(top = 8.dp)) {
                Text("LIVE", color = Color.White, fontSize = 8.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp))
            }
        }
    }
}

@Composable
fun AnimatedStoryRing(content: @Composable () -> Unit) {
    val infiniteTransition = rememberInfiniteTransition(label = "ring")
    val angle by infiniteTransition.animateFloat(
        initialValue = 0f,
        targetValue = 360f,
        animationSpec = infiniteRepeatable(
            animation = tween(3000, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ), label = "angle"
    )

    val gradient = Brush.sweepGradient(
        colors = listOf(Color(0xFF833AB4), Color(0xFFFD1D1D), Color(0xFFFCB045), Color(0xFF833AB4))
    )

    Box(
        modifier = Modifier
            .fillMaxSize()
            .drawWithContent {
                rotate(angle) {
                    drawCircle(
                        brush = gradient,
                        radius = size.minDimension / 2,
                        style = Stroke(width = 4.dp.toPx())
                    )
                }
                drawContent()
            },
        contentAlignment = Alignment.Center
    ) {
        content()
    }
}

@OptIn(ExperimentalFoundationApi::class, ExperimentalMaterial3Api::class)
@Composable
fun StoryViewerModal(
    storyProfiles: List<StoryProfile>,
    startProfileIndex: Int,
    isDarkMode: Boolean,
    accentBlue: Color,
    myStoryViewers: List<StoryActivityUser>,
    myStoryLikes: List<StoryActivityUser>,
    myStoryComments: List<StoryActivityUser>,
    onDismiss: () -> Unit
) {
    if (storyProfiles.isEmpty()) return

    var profileIndex by remember { mutableIntStateOf(startProfileIndex.coerceIn(0, storyProfiles.lastIndex)) }
    var storyIndex by remember { mutableIntStateOf(0) }
    var progress by remember(profileIndex, storyIndex) { mutableFloatStateOf(0f) }
    var showMyStoryStats by remember { mutableStateOf(false) }
    var profileChangeDirection by remember { mutableIntStateOf(0) }
    var isPressPaused by remember { mutableStateOf(false) }

    val currentProfile = storyProfiles[profileIndex]
    val currentStory = currentProfile.stories.getOrNull(storyIndex)

    LaunchedEffect(profileIndex) {
        if (storyIndex > currentProfile.stories.lastIndex) storyIndex = 0
    }

    LaunchedEffect(profileIndex, storyIndex) {
        progress = 0f
        val durationMs = 5000f
        val step = 50L
        while (progress < 1f) {
            delay(step)
            if (isPressPaused) continue
            progress += step / durationMs
        }
        progress = 1f

        if (storyIndex < currentProfile.stories.lastIndex) {
            storyIndex++
        } else if (profileIndex < storyProfiles.lastIndex) {
            profileChangeDirection = 1
            profileIndex++
            storyIndex = 0
        } else {
            onDismiss()
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black)
    ) {
        AnimatedContent(
            targetState = profileIndex,
            transitionSpec = {
                if (targetState == initialState) {
                    fadeIn() togetherWith fadeOut()
                } else {
                    if (profileChangeDirection >= 0) {
                        slideInHorizontally { it / 3 } + fadeIn() togetherWith slideOutHorizontally { -it / 3 } + fadeOut()
                    } else {
                        slideInHorizontally { -it / 3 } + fadeIn() togetherWith slideOutHorizontally { it / 3 } + fadeOut()
                    }
                }
            },
            label = "story_profile_transition",
            modifier = Modifier.fillMaxSize()
        ) { animatedProfileIndex ->
            val profile = storyProfiles[animatedProfileIndex]
            val media = profile.stories.getOrNull(storyIndex.coerceAtMost(profile.stories.lastIndex))
            Box(modifier = Modifier.fillMaxSize()) {
                AsyncImage(
                    model = media?.mediaUrl,
                    contentDescription = null,
                    modifier = Modifier.fillMaxSize(),
                    contentScale = ContentScale.Crop
                )
                Box(modifier = Modifier.matchParentSize().background(Brush.verticalGradient(listOf(Color.Black.copy(0.45f), Color.Transparent, Color.Black.copy(0.6f)))))
            }
        }

        Column(
            modifier = Modifier
                .fillMaxWidth()
                .statusBarsPadding()
                .padding(horizontal = 12.dp, vertical = 8.dp)
        ) {
            Row(horizontalArrangement = Arrangement.spacedBy(4.dp), modifier = Modifier.fillMaxWidth()) {
                repeat(currentProfile.stories.size) { index ->
                    val fill = when {
                        index < storyIndex -> 1f
                        index > storyIndex -> 0f
                        else -> progress.coerceIn(0f, 1f)
                    }

                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .height(3.dp)
                            .clip(RoundedCornerShape(2.dp))
                            .background(Color.White.copy(0.25f))
                    ) {
                        Box(
                            modifier = Modifier
                                .fillMaxHeight()
                                .fillMaxWidth(fill)
                                .background(Color.White)
                        )
                    }
                }
            }

            Spacer(Modifier.height(10.dp))

            Surface(
                color = if (isDarkMode) Color.Black.copy(0.25f) else Color.White.copy(0.2f),
                shape = RoundedCornerShape(22.dp),
                border = BorderStroke(1.dp, Color.White.copy(0.2f)),
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        AsyncImage(
                            model = currentProfile.avatar,
                            contentDescription = null,
                            modifier = Modifier
                                .size(34.dp)
                                .clip(CircleShape)
                                .border(1.5.dp, accentBlue, CircleShape),
                            contentScale = ContentScale.Crop
                        )
                        Spacer(Modifier.width(8.dp))
                        Text(currentProfile.name, color = Color.White, fontWeight = FontWeight.Bold)
                    }

                    IconButton(onClick = onDismiss, modifier = Modifier.size(30.dp)) {
                        Icon(Icons.Default.Close, null, tint = Color.White)
                    }
                }
            }
        }

        Row(
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .navigationBarsPadding()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            if (currentProfile.isMine) {
                Surface(
                    onClick = { showMyStoryStats = true },
                    modifier = Modifier.weight(1f).height(48.dp),
                    color = Color.White.copy(0.14f),
                    shape = RoundedCornerShape(24.dp),
                    border = BorderStroke(1.dp, Color.White.copy(0.2f))
                ) {
                    Row(
                        modifier = Modifier.fillMaxSize().padding(horizontal = 14.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text("${myStoryViewers.size} kishi ko'rdi", color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                        Icon(Icons.Default.KeyboardArrowUp, null, tint = Color.White)
                    }
                }
            } else {
                Surface(
                    modifier = Modifier.weight(1f).height(48.dp),
                    color = Color.White.copy(0.14f),
                    shape = RoundedCornerShape(24.dp),
                    border = BorderStroke(1.dp, Color.White.copy(0.2f))
                ) {
                    Row(modifier = Modifier.fillMaxSize().padding(horizontal = 14.dp), verticalAlignment = Alignment.CenterVertically) {
                        Text("Izoh yozing...", color = Color.White.copy(0.8f), fontSize = 14.sp)
                    }
                }

                IconButton(onClick = { }, modifier = Modifier.size(46.dp).clip(CircleShape).background(Color.White.copy(0.14f))) {
                    Icon(Icons.Default.FavoriteBorder, null, tint = Color.White)
                }
            }

            IconButton(onClick = { }, modifier = Modifier.size(46.dp).clip(CircleShape).background(Color.White.copy(0.14f))) {
                Icon(Icons.AutoMirrored.Rounded.Send, null, tint = Color.White)
            }
        }

        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(top = 80.dp, bottom = 90.dp)
                .pointerInput(profileIndex, storyIndex) {
                    awaitEachGesture {
                        awaitFirstDown(requireUnconsumed = false)
                        isPressPaused = true
                        val up = waitForUpOrCancellation()
                        isPressPaused = false
                        if (up != null) {
                            val isLeft = up.position.x < size.width / 2f
                            if (isLeft) {
                                if (storyIndex > 0) {
                                    storyIndex--
                                } else if (profileIndex > 0) {
                                    profileChangeDirection = -1
                                    profileIndex--
                                    storyIndex = storyProfiles[profileIndex].stories.lastIndex.coerceAtLeast(0)
                                } else {
                                    progress = 0f
                                }
                            } else {
                                if (storyIndex < currentProfile.stories.lastIndex) {
                                    storyIndex++
                                } else if (profileIndex < storyProfiles.lastIndex) {
                                    profileChangeDirection = 1
                                    profileIndex++
                                    storyIndex = 0
                                } else {
                                    onDismiss()
                                }
                            }
                        }
                    }
                }
        )
    }

    if (showMyStoryStats && currentProfile.isMine) {
        MyStoryActivityBottomSheet(
            stories = currentProfile.stories,
            viewers = myStoryViewers,
            isDarkMode = isDarkMode,
            accentBlue = accentBlue,
            onDismiss = { showMyStoryStats = false }
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MyStoryActivityBottomSheet(
    stories: List<StoryMedia>,
    viewers: List<StoryActivityUser>,
    isDarkMode: Boolean,
    accentBlue: Color,
    onDismiss: () -> Unit
) {
    val sheetBg = if (isDarkMode) Color(0xFF0F1014) else Color.White
    val textColor = if (isDarkMode) Color.White else Color.Black

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        containerColor = sheetBg,
        shape = RoundedCornerShape(topStart = 20.dp, topEnd = 20.dp),
        dragHandle = { BottomSheetDefaults.DragHandle(color = Color.Gray.copy(0.5f)) }
    ) {
        Column(modifier = Modifier.fillMaxWidth().fillMaxHeight(0.9f)) {
            // --- TOP STORY THUMBNAILS (Rasmda ko'rsatilgandek) ---
            LazyRow(
                modifier = Modifier.fillMaxWidth().padding(vertical = 12.dp),
                contentPadding = PaddingValues(horizontal = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                items(stories) { story ->
                    Box(
                        modifier = Modifier
                            .width(65.dp)
                            .height(110.dp)
                            .clip(RoundedCornerShape(8.dp))
                            .background(Color.Gray.copy(0.2f))
                    ) {
                        AsyncImage(
                            model = story.mediaUrl,
                            contentDescription = null,
                            modifier = Modifier.fillMaxSize(),
                            contentScale = ContentScale.Crop
                        )
                        // View count overlay
                        Box(
                            modifier = Modifier.align(Alignment.BottomCenter).fillMaxWidth().background(Color.Black.copy(0.4f)).padding(2.dp)
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.Center, modifier = Modifier.fillMaxWidth()) {
                                Icon(Icons.Default.People, null, tint = Color.White, modifier = Modifier.size(10.dp))
                                Spacer(Modifier.width(2.dp))
                                Text("28", color = Color.White, fontSize = 9.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
                // Camera icon box
                item {
                    Box(
                        modifier = Modifier
                            .width(65.dp)
                            .height(110.dp)
                            .clip(RoundedCornerShape(8.dp))
                            .background(Color.Gray.copy(0.1f))
                            .border(1.dp, Color.Gray.copy(0.3f), RoundedCornerShape(8.dp)),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(Icons.Default.PhotoCamera, null, tint = textColor.copy(0.7f))
                    }
                }
            }

            HorizontalDivider(color = Color.Gray.copy(0.2f), thickness = 0.5.dp)

            // --- TAB BAR / STATS BAR ---
            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.BarChart, null, tint = textColor, modifier = Modifier.size(24.dp))
                    Spacer(Modifier.width(24.dp))
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.People, null, tint = accentBlue, modifier = Modifier.size(22.dp))
                        Spacer(Modifier.width(6.dp))
                        Text(viewers.size.toString(), color = accentBlue, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                    }
                }
                IconButton(onClick = { }) {
                    Icon(Icons.Default.DeleteOutline, null, tint = textColor)
                }
            }

            Text(
                "Who viewed your story",
                color = textColor,
                fontWeight = FontWeight.Bold,
                fontSize = 15.sp,
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
            )

            // --- VIEWERS LIST ---
            LazyColumn(modifier = Modifier.weight(1f)) {
                items(viewers) { user ->
                    ViewerItem(user, textColor, accentBlue)
                }
                item { Spacer(Modifier.height(32.dp)) }
            }
        }
    }
}

@Composable
fun ViewerItem(user: StoryActivityUser, textColor: Color, accentBlue: Color) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.weight(1f)) {
            Box(modifier = Modifier.size(48.dp)) {
                AsyncImage(
                    model = user.avatar,
                    contentDescription = null,
                    modifier = Modifier.fillMaxSize().clip(CircleShape),
                    contentScale = ContentScale.Crop
                )
                // Heart icon for likers
                Box(
                    modifier = Modifier
                        .align(Alignment.BottomEnd)
                        .size(18.dp)
                        .clip(CircleShape)
                        .background(Color(0xFFE91E63))
                        .border(2.dp, Color.Black, CircleShape),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(Icons.Default.Favorite, null, tint = Color.White, modifier = Modifier.size(10.dp))
                }
            }
            Spacer(Modifier.width(12.dp))
            Column {
                Text(user.name, color = textColor, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                Text(user.subtitle, color = Color.Gray, fontSize = 12.sp)
            }
        }
        
        Row(verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = { }) {
                Icon(Icons.Default.MoreVert, null, tint = textColor.copy(0.7f))
            }
            IconButton(onClick = { }) {
                Icon(Icons.AutoMirrored.Rounded.Send, null, tint = textColor.copy(0.7f), modifier = Modifier.size(22.dp))
            }
        }
    }
}
