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
import kotlinx.coroutines.launch

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
    onNavigateToCreatePost: () -> Unit = {},
    onNavigateToNotifications: () -> Unit = {},
    onNavigateToSaved: () -> Unit = {},
    onNavigateToHashtag: (String) -> Unit = {},
    onNavigateToFollowList: (String, String) -> Unit = { _, _ -> },
    viewModel: HomeViewModel = viewModel()
) {
    val backgroundColor = if (isDarkMode) GlobalBackgroundColor else Color(0xFFF2F2F2)
    val accentBlue = Color(0xFF00A3FF)
    val contentColor = if (isDarkMode) Color.White else Color.Black

    val listState = rememberLazyListState()
    var commentsForPost by remember { mutableStateOf<PostData?>(null) }
    var moreMenuForPost by remember { mutableStateOf<PostData?>(null) }
    var editingPost by remember { mutableStateOf<PostData?>(null) }
    var deletingPost by remember { mutableStateOf<PostData?>(null) }
    val snackbarHostState = remember { SnackbarHostState() }
    val coroutineScope = rememberCoroutineScope()

    Box(modifier = Modifier.fillMaxSize()) {
        AnimatedLiquidBackground(isDarkMode = isDarkMode)
        Scaffold(
            containerColor = Color.Transparent,
            snackbarHost = { SnackbarHost(snackbarHostState) },
            bottomBar = {
                // Kamera yoki Story ochiq bo'lsa navigatsiyani yashiramiz
                if (!viewModel.showCameraView && viewModel.activeStoryProfileIndex == null && viewModel.currentTab != 2) {
                    Box(modifier = Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                        GlassSlidingNavigation(
                            selectedTab = viewModel.currentTab,
                            onTabSelected = { viewModel.onTabSelected(it) },
                            onCreatePost = onNavigateToCreatePost,
                            isDarkMode = isDarkMode,
                            modifier = Modifier.padding(bottom = 24.dp)
                        )
                    }
                }
            }
        ) { paddingValues ->
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(if (viewModel.currentTab == 2) Color.Black else backgroundColor)
            ) {
                AnimatedContent(
                    targetState = viewModel.currentTab,
                    transitionSpec = {
                        val dir = if (targetState > initialState) 1 else -1
                        (slideInHorizontally(tween(300)) { dir * 48 } + fadeIn(tween(240)))
                            .togetherWith(slideOutHorizontally(tween(300)) { -dir * 48 } + fadeOut(tween(200)))
                    },
                    label = "main_nav"
                ) { targetTab ->
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
                            onCreateClick = onNavigateToCreatePost,
                            onCommentsClick = { post -> commentsForPost = post },
                            isRefreshing = viewModel.isHomeRefreshing,
                            onRefresh = { viewModel.refreshHome() },
                            listState = listState,
                            myAvatar = viewModel.myAvatar,
                            onAddStoryClick = onNavigateToCreatePost,
                            onProfileClick = onNavigateToProfile,
                            onPostMoreClick = { post -> moreMenuForPost = post },
                            onNotificationsClick = onNavigateToNotifications,
                            onSavedClick = onNavigateToSaved,
                            onLoadMore = { viewModel.loadMoreIfNeeded() },
                            isLoadingMore = viewModel.isLoadingMore,
                            hasMore = viewModel.hasMorePosts,
                            onHashtagClick = onNavigateToHashtag,
                            onMentionClick = onNavigateToProfile,
                            onError = { msg -> coroutineScope.launch { snackbarHostState.showSnackbar(msg, duration = SnackbarDuration.Short) } }
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
                            onProfileClick = onNavigateToProfile,
                            onHashtagClick = onNavigateToHashtag
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
                            onBack = { viewModel.onTabSelected(0) },
                            onOpenFollowList = onNavigateToFollowList,
                            onOpenChat = { username -> onNavigateToChat(username, false) }
                        )
                    }
                }

                // Reels shaffof navigatsiya
                if (viewModel.currentTab == 2 && !viewModel.showCameraView && viewModel.activeStoryProfileIndex == null) {
                    val reelsNavAlpha by animateFloatAsState(
                        targetValue = 0.82f,
                        animationSpec = tween(300),
                        label = "reels_nav_alpha"
                    )
                    Box(
                        modifier = Modifier
                            .align(Alignment.BottomCenter)
                            .fillMaxWidth()
                            .padding(bottom = 24.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        GlassSlidingNavigation(
                            selectedTab = viewModel.currentTab,
                            onTabSelected = { viewModel.onTabSelected(it) },
                            onCreatePost = onNavigateToCreatePost,
                            isDarkMode = true,
                            modifier = Modifier.graphicsLayer(alpha = reelsNavAlpha)
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

        // Comments sheet — pasdan tepaga sirpanib chiqadi
        commentsForPost?.let { post ->
            CommentsBottomSheet(
                postId = post.id,
                initialCount = post.comments,
                visible = true,
                accent = accentBlue,
                onDismiss = { commentsForPost = null }
            )
        }

        // Post "⋯" menu sheet — Edit / Delete (o'z postlari uchun) yoki Report / Block
        moreMenuForPost?.let { post ->
            val isOwn = post.user.equals(viewModel.myUsername, ignoreCase = true) &&
                viewModel.myUsername.isNotBlank()
            PostMoreMenuSheet(
                isOwn = isOwn,
                postId = post.id,
                onDismiss = { moreMenuForPost = null },
                onEdit = {
                    editingPost = post
                    moreMenuForPost = null
                },
                onDelete = {
                    deletingPost = post
                    moreMenuForPost = null
                },
                onBlock = {
                    viewModel.blockUserOfPost(post)
                    moreMenuForPost = null
                }
            )
        }

        // Edit caption dialog
        editingPost?.let { post ->
            EditCaptionDialog(
                initialCaption = post.caption,
                onConfirm = { newCaption ->
                    viewModel.updatePostCaption(post.id, newCaption)
                    editingPost = null
                },
                onDismiss = { editingPost = null }
            )
        }

        // Delete confirmation
        deletingPost?.let { post ->
            ConfirmDeleteDialog(
                onConfirm = {
                    viewModel.deletePost(post.id)
                    deletingPost = null
                },
                onDismiss = { deletingPost = null }
            )
        }
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
