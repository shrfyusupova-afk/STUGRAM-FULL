package com.example.myapplication.ui.home

import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material3.*
import androidx.compose.material3.OutlinedTextField
import androidx.compose.runtime.*
import androidx.lifecycle.viewmodel.compose.viewModel
import com.example.myapplication.config.AlphaFeatureFlags
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.blur
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.TransformOrigin
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * HomeScreen - Loyihaning asosiy mantiqiy markazi.
 * Ma'lumotlar va holatlar HomeViewModel ichida saqlanadi.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
    isDarkMode: Boolean,
    onThemeChange: (Boolean) -> Unit,
    onNavigateToChat: (String, Boolean) -> Unit,
    onNavigateToGroupChat: (String) -> Unit,
    onNavigateToProfile: (String) -> Unit,
    viewModel: HomeViewModel = viewModel()
) {
    val backgroundColor = if (isDarkMode) GlobalBackgroundColor else Color(0xFFF2F2F2)
    val accentBlue = Color(0xFF00A3FF)
    val contentColor = if (isDarkMode) Color.White else Color.Black

    val listState = rememberLazyListState()

    Box(modifier = Modifier.fillMaxSize()) {
        AnimatedLiquidBackground(isDarkMode = isDarkMode)
        Scaffold(
            containerColor = Color.Transparent,
            bottomBar = {
                // Kamera yoki Story ochiq bo'lsa navigatsiyani yashiramiz
                if (!viewModel.showCameraView && viewModel.activeStoryProfileIndex == null && viewModel.currentTab != 2) {
                    GlassSlidingNavigation(
                        selectedTab = viewModel.currentTab,
                        onTabSelected = { viewModel.onTabSelected(it) },
                        isDarkMode = isDarkMode,
                        modifier = Modifier.padding(bottom = 24.dp)
                    )
                }
            }
        ) { paddingValues ->
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(if (viewModel.currentTab == 2) Color.Black else backgroundColor)
            ) {
                Crossfade(targetState = viewModel.currentTab, label = "main_nav") { targetTab ->
                    when (targetTab) {
                        0 -> HomeTabScreen(
                            posts = viewModel.posts,
                            storyProfiles = viewModel.storyProfiles,
                            recommendedProfiles = viewModel.recommendedProfiles,
                            paddingValues = paddingValues,
                            accentBlue = accentBlue,
                            isDarkMode = isDarkMode,
                            contentColor = contentColor,
                            onThemeChange = onThemeChange,
                            onStoryClick = { viewModel.openStory(it) },
                            onCreateClick = { viewModel.openCreatePostModal() },
                            onCommentsClick = { viewModel.toggleComments(true) },
                            isRefreshing = viewModel.isHomeRefreshing,
                            onRefresh = { viewModel.refreshHome() },
                            listState = listState
                        )
                        1 -> SearchScreen(
                            isDarkMode = isDarkMode,
                            isRefreshing = viewModel.isSearchRefreshing,
                            onRefresh = { viewModel.refreshSearch() },
                            onOpenProfile = onNavigateToProfile
                        )
                        2 -> ReelsScreen(
                            accentBlue = accentBlue,
                            isDarkMode = isDarkMode,
                            onProfileClick = onNavigateToProfile
                        )
                        3 -> MessagesScreen(
                            isDarkMode = isDarkMode,
                            onBack = { viewModel.onTabSelected(0) },
                            onNavigateToChat = onNavigateToChat,
                            onNavigateToGroupChat = { groupName ->
                                if (AlphaFeatureFlags.GROUP_CHAT_ENABLED) {
                                    onNavigateToGroupChat(groupName)
                                }
                            }
                        )
                        4 -> ProfileScreen(
                            isDarkMode = isDarkMode,
                            isRefreshing = viewModel.isProfileRefreshing,
                            onRefresh = { viewModel.refreshProfile() },
                            onBack = { viewModel.onTabSelected(0) }
                        )
                    }
                }

                // Reels shaffof navigatsiya
                if (viewModel.currentTab == 2 && !viewModel.showCameraView && viewModel.activeStoryProfileIndex == null) {
                    Box(modifier = Modifier.align(Alignment.BottomCenter).padding(bottom = 24.dp)) {
                        GlassSlidingNavigation(
                            selectedTab = viewModel.currentTab,
                            onTabSelected = { viewModel.onTabSelected(it) },
                            isDarkMode = true,
                            modifier = Modifier.graphicsLayer(alpha = 0.8f)
                        )
                    }
                }
            }
        }

        // --- Overlays ---
        if (viewModel.showCreatePostModal) {
            CreatePostDialog(
                isDarkMode = isDarkMode,
                isSaving = viewModel.isCreatingPost,
                error = viewModel.createPostError,
                onDismiss = { viewModel.closeCreatePostModal() },
                onSubmit = { viewModel.createTextPost(it) }
            )
        }

        AnimatedContent(
            targetState = viewModel.activeStoryProfileIndex,
            transitionSpec = {
                if (targetState != null) {
                    (slideInVertically(initialOffsetY = { it / 2 }) + fadeIn(tween(400)) + scaleIn(initialScale = 0.85f, transformOrigin = TransformOrigin.Center))
                        .togetherWith(fadeOut(tween(200)))
                } else {
                    fadeIn(tween(200))
                        .togetherWith(slideOutVertically(targetOffsetY = { it / 2 }) + fadeOut(tween(400)) + scaleOut(targetScale = 0.85f, transformOrigin = TransformOrigin.Center))
                }
            },
            label = "story_modal"
        ) { index ->
            if (index != null && AlphaFeatureFlags.STORIES_ENABLED) {
                StoryViewerModal(
                    storyProfiles = viewModel.storyProfiles,
                    startProfileIndex = index,
                    isDarkMode = isDarkMode,
                    accentBlue = accentBlue,
                    myStoryViewers = viewModel.myStoryActivities.first,
                    myStoryLikes = viewModel.myStoryActivities.second,
                    myStoryComments = viewModel.myStoryActivities.third,
                    onDismiss = { viewModel.closeStory() }
                )
            }
        }

        // Comments bottom sheet is hidden in alpha until backend-backed comments flow is wired.
    }
}

@Composable
private fun CreatePostDialog(
    isDarkMode: Boolean,
    isSaving: Boolean,
    error: String?,
    onDismiss: () -> Unit,
    onSubmit: (String) -> Unit
) {
    var caption by remember { mutableStateOf("") }
    AlertDialog(
        onDismissRequest = {
            if (!isSaving) onDismiss()
        },
        containerColor = if (isDarkMode) Color(0xFF171717) else Color.White,
        title = { Text("Create post") },
        text = {
            Column {
                OutlinedTextField(
                    value = caption,
                    onValueChange = { caption = it },
                    label = { Text("Caption") },
                    minLines = 3
                )
                if (!error.isNullOrBlank()) {
                    Spacer(Modifier.height(8.dp))
                    Text(text = error, color = Color.Red, fontSize = 12.sp)
                }
            }
        },
        confirmButton = {
            TextButton(
                onClick = { onSubmit(caption) },
                enabled = !isSaving
            ) { Text(if (isSaving) "Saving..." else "Post") }
        },
        dismissButton = {
            TextButton(
                onClick = onDismiss,
                enabled = !isSaving
            ) { Text("Cancel") }
        }
    )
}

@Composable
private fun AnimatedLiquidBackground(isDarkMode: Boolean) {
    val transition = rememberInfiniteTransition(label = "liquid_bg")
    val drift by transition.animateFloat(
        initialValue = -80f,
        targetValue = 80f,
        animationSpec = infiniteRepeatable(
            animation = tween(5000, easing = EaseInOutSine),
            repeatMode = RepeatMode.Reverse
        ),
        label = "drift"
    )
    val base = if (isDarkMode) Color(0xFF0B0E16) else Color(0xFFF2F6FF)
    val blobA = if (isDarkMode) Color(0xFF1B5EBC) else Color(0xFF7EC8FF)
    val blobB = if (isDarkMode) Color(0xFF36B6FF) else Color(0xFFB8D6FF)

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(base)
    ) {
        Canvas(
            modifier = Modifier
                .fillMaxSize()
                .blur(80.dp)
        ) {
            drawCircle(
                brush = Brush.radialGradient(listOf(blobA.copy(alpha = 0.50f), Color.Transparent)),
                radius = size.minDimension * 0.45f,
                center = Offset(size.width * 0.25f + drift, size.height * 0.3f)
            )
            drawCircle(
                brush = Brush.radialGradient(listOf(blobB.copy(alpha = 0.45f), Color.Transparent)),
                radius = size.minDimension * 0.5f,
                center = Offset(size.width * 0.75f - drift, size.height * 0.68f)
            )
        }
    }
}
