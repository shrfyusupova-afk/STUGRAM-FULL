package com.example.myapplication.ui.home

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import kotlinx.coroutines.launch

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
    if (storyProfiles.isEmpty()) {
        LaunchedEffect(Unit) { onDismiss() }
        return
    }

    val safeStart = startProfileIndex.coerceIn(0, storyProfiles.lastIndex)
    val pagerState = rememberPagerState(initialPage = safeStart, pageCount = { storyProfiles.size })
    val scope = rememberCoroutineScope()

    Box(modifier = Modifier.fillMaxSize().background(Color.Black)) {
        HorizontalPager(
            state = pagerState,
            modifier = Modifier.fillMaxSize(),
            beyondViewportPageCount = 1
        ) { profileIdx ->
            StoryProfileViewer(
                profile = storyProfiles[profileIdx],
                isActive = profileIdx == pagerState.settledPage,
                onPrevProfile = {
                    if (pagerState.currentPage > 0)
                        scope.launch { pagerState.animateScrollToPage(pagerState.currentPage - 1) }
                    else onDismiss()
                },
                onNextProfile = {
                    if (pagerState.currentPage < storyProfiles.lastIndex)
                        scope.launch { pagerState.animateScrollToPage(pagerState.currentPage + 1) }
                    else onDismiss()
                },
                onDismiss = onDismiss
            )
        }
    }
}

@Composable
private fun StoryProfileViewer(
    profile: StoryProfile,
    isActive: Boolean,
    onPrevProfile: () -> Unit,
    onNextProfile: () -> Unit,
    onDismiss: () -> Unit
) {
    var currentIdx by remember { mutableIntStateOf(0) }
    val progress = remember { Animatable(0f) }

    LaunchedEffect(currentIdx, isActive) {
        if (!isActive) {
            progress.snapTo(0f)
            return@LaunchedEffect
        }
        progress.snapTo(0f)
        progress.animateTo(
            targetValue = 1f,
            animationSpec = tween(durationMillis = 5000, easing = LinearEasing)
        )
        if (currentIdx < profile.stories.lastIndex) currentIdx++
        else onNextProfile()
    }

    val story = profile.stories.getOrNull(currentIdx)

    Box(modifier = Modifier.fillMaxSize().background(Color.Black)) {
        // Story media
        if (story != null && story.mediaUrl.isNotBlank()) {
            AsyncImage(
                model = story.mediaUrl,
                contentDescription = null,
                modifier = Modifier.fillMaxSize(),
                contentScale = ContentScale.Fit
            )
        }

        // Tap zones: left = prev, right = next (full height, behind header)
        Row(modifier = Modifier.fillMaxSize()) {
            Box(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxHeight()
                    .clickable(
                        indication = null,
                        interactionSource = remember { MutableInteractionSource() }
                    ) {
                        if (currentIdx > 0) currentIdx-- else onPrevProfile()
                    }
            )
            Box(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxHeight()
                    .clickable(
                        indication = null,
                        interactionSource = remember { MutableInteractionSource() }
                    ) {
                        if (currentIdx < profile.stories.lastIndex) currentIdx++
                        else onNextProfile()
                    }
            )
        }

        // Header (on top of tap zones — close button intercepts its own touches)
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .align(Alignment.TopStart)
                .statusBarsPadding()
                .padding(start = 12.dp, end = 12.dp, top = 12.dp)
        ) {
            // Progress bars
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                profile.stories.forEachIndexed { idx, _ ->
                    val p = when {
                        idx < currentIdx -> 1f
                        idx == currentIdx -> progress.value
                        else -> 0f
                    }
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .height(2.dp)
                            .clip(CircleShape)
                            .background(Color.White.copy(0.35f))
                    ) {
                        Box(
                            modifier = Modifier
                                .fillMaxHeight()
                                .fillMaxWidth(p.coerceIn(0f, 1f))
                                .background(Color.White)
                        )
                    }
                }
            }

            Spacer(Modifier.height(10.dp))

            // User row
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Box(
                    modifier = Modifier
                        .size(36.dp)
                        .clip(CircleShape)
                        .background(Color.White.copy(0.2f)),
                    contentAlignment = Alignment.Center
                ) {
                    if (profile.avatar.isNotBlank()) {
                        AsyncImage(
                            model = profile.avatar,
                            contentDescription = null,
                            modifier = Modifier.fillMaxSize(),
                            contentScale = ContentScale.Crop
                        )
                    } else {
                        Icon(
                            Icons.Default.Person,
                            contentDescription = null,
                            tint = Color.White.copy(0.8f),
                            modifier = Modifier.size(20.dp)
                        )
                    }
                }
                Spacer(Modifier.width(10.dp))
                Text(
                    text = profile.name,
                    color = Color.White,
                    fontWeight = FontWeight.Bold,
                    fontSize = 14.sp
                )
                Spacer(Modifier.weight(1f))
                Box(
                    modifier = Modifier
                        .size(36.dp)
                        .clip(CircleShape)
                        .background(Color.Black.copy(0.4f))
                        .clickable { onDismiss() },
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        Icons.Default.Close,
                        contentDescription = "Close",
                        tint = Color.White,
                        modifier = Modifier.size(20.dp)
                    )
                }
            }
        }
    }
}
