package com.example.myapplication.ui.home

import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.TransformOrigin
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.unit.dp

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
    viewModel: HomeViewModel = viewModel()
) {
    val backgroundColor = if (isDarkMode) GlobalBackgroundColor else Color(0xFFF2F2F2)
    val accentBlue = Color(0xFF00A3FF)
    val contentColor = if (isDarkMode) Color.White else Color.Black

    val listState = rememberLazyListState()

    Box(modifier = Modifier.fillMaxSize()) {
        Scaffold(
            containerColor = if (viewModel.currentTab == 2) Color.Black else backgroundColor,
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
                            onCreateClick = { viewModel.toggleCamera(true) },
                            onCommentsClick = { viewModel.toggleComments(true) },
                            isRefreshing = viewModel.isHomeRefreshing,
                            onRefresh = { viewModel.refreshHome() },
                            listState = listState
                        )
                        1 -> SearchScreen(
                            isDarkMode = isDarkMode,
                            isRefreshing = viewModel.isSearchRefreshing,
                            onRefresh = { viewModel.refreshSearch() }
                        )
                        2 -> ReelsScreen(accentBlue, isDarkMode) { viewModel.onTabSelected(4) }
                        3 -> MessagesScreen(isDarkMode, { viewModel.onTabSelected(0) }, onNavigateToChat, onNavigateToGroupChat)
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
        AnimatedVisibility(
            visible = viewModel.showCameraView,
            enter = slideInVertically(initialOffsetY = { it }) + fadeIn(),
            exit = slideOutVertically(targetOffsetY = { it }) + fadeOut()
        ) {
            CameraScreen(onDismiss = { viewModel.toggleCamera(false) }, accentBlue = accentBlue)
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
            if (index != null) {
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

        if (viewModel.showCommentsSheet) {
            CommentsBottomSheet(isDarkMode, accentBlue) { viewModel.toggleComments(false) }
        }
    }
}
