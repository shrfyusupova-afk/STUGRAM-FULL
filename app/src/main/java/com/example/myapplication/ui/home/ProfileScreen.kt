package com.example.myapplication.ui.home

import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.grid.rememberLazyGridState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.*
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import coil.compose.AsyncImage
import com.example.myapplication.core.ui.UiState

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProfileScreen(
    isDarkMode: Boolean,
    isRefreshing: Boolean,
    onRefresh: () -> Unit,
    isMyProfile: Boolean = true,
    targetUsername: String? = null,
    onBack: (() -> Unit)? = null
) {
    val vm: ProfileViewModel = viewModel()
    val ui = vm.uiState.collectAsState().value
    var isEditMode by remember { mutableStateOf(false) }
    val resolvedIsMyProfile = isMyProfile && targetUsername.isNullOrBlank()

    LaunchedEffect(targetUsername) {
        vm.setProfileTarget(targetUsername)
    }

    if (isEditMode && resolvedIsMyProfile) {
        EditProfileScreen(
            isDarkMode = isDarkMode,
            initialName = ui.fullName,
            initialUsername = ui.username,
            initialBio = ui.bio,
            initialBirthday = "",
            initialLocation = ui.location,
            initialSchool = ui.school,
            onBack = { isEditMode = false },
            isSaving = ui.isSaving,
            errorMessage = ui.saveError,
            onSave = { name, username, bio, _, location, school ->
                vm.updateProfile(
                    fullName = name,
                    username = username,
                    bio = bio,
                    location = location,
                    school = school,
                    onSuccess = { isEditMode = false }
                )
            }
        )
        return
    }

    val bg = if (isDarkMode) Color(0xFF0F0F0F) else Color.White
    val fg = if (isDarkMode) Color.White else Color.Black
    val accent = Color(0xFF00A3FF)

    PullToRefreshBox(
        isRefreshing = isRefreshing || ui.isLoading,
        onRefresh = {
            vm.refresh()
            onRefresh()
        },
        modifier = Modifier.fillMaxSize()
    ) {
        Box(modifier = Modifier.fillMaxSize().background(bg)) {
            Column(modifier = Modifier.fillMaxSize().statusBarsPadding()) {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    if (onBack != null) {
                        IconButton(onClick = onBack) {
                            Icon(Icons.AutoMirrored.Filled.ArrowBack, null, tint = fg)
                        }
                    } else {
                        Spacer(Modifier.size(40.dp))
                    }
                    Text("Profile", color = fg, fontWeight = FontWeight.Bold, fontSize = 20.sp)
                    Spacer(Modifier.size(40.dp))
                }

                when {
                    ui.error != null -> {
                        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Text(ui.error, color = fg)
                                TextButton(onClick = vm::refresh) { Text("Retry", color = accent) }
                            }
                        }
                    }

                    else -> {
                        Column(modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp)) {
                            Text(
                                text = ui.fullName.ifBlank { "No name set" },
                                color = fg,
                                fontSize = 24.sp,
                                fontWeight = FontWeight.Black
                            )
                            Text(
                                text = if (ui.username.isBlank()) "@unknown" else "@${ui.username}",
                                color = accent,
                                fontSize = 15.sp
                            )
                            if (ui.bio.isNotBlank()) {
                                Spacer(Modifier.height(8.dp))
                                Text(ui.bio, color = fg, fontSize = 14.sp)
                            }
                            if (ui.location.isNotBlank() || ui.school.isNotBlank()) {
                                Spacer(Modifier.height(8.dp))
                                Text(
                                    listOf(ui.location, ui.school).filter { it.isNotBlank() }.joinToString(" • "),
                                    color = fg.copy(alpha = 0.7f),
                                    fontSize = 12.sp
                                )
                            }
                            Spacer(Modifier.height(12.dp))
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly) {
                                StatItemHeader(ui.postsCount.toString(), "Posts", fg)
                                StatItemHeader(ui.followersCount.toString(), "Followers", fg)
                                StatItemHeader(ui.followingCount.toString(), "Following", fg)
                            }
                            Spacer(Modifier.height(16.dp))

                            if (resolvedIsMyProfile) {
                                OutlinedButton(
                                    onClick = { isEditMode = true },
                                    modifier = Modifier.fillMaxWidth().height(46.dp),
                                    colors = ButtonDefaults.outlinedButtonColors(contentColor = accent),
                                    border = ButtonDefaults.outlinedButtonBorder,
                                    shape = RoundedCornerShape(14.dp)
                                ) {
                                    Text("Edit Profile")
                                }
                            } else {
                                val following = ui.followStatus == "following"
                                Button(
                                    onClick = { vm.followOrUnfollow() },
                                    enabled = !ui.isSaving,
                                    modifier = Modifier.fillMaxWidth().height(46.dp),
                                    shape = RoundedCornerShape(14.dp),
                                    colors = ButtonDefaults.buttonColors(
                                        containerColor = if (following) fg.copy(alpha = 0.2f) else accent
                                    )
                                ) {
                                    Text(
                                        if (following) "Unfollow" else "Follow",
                                        color = if (following) fg else Color.White
                                    )
                                }
                            }

                            if (!ui.saveError.isNullOrBlank()) {
                                Spacer(Modifier.height(8.dp))
                                Text(ui.saveError ?: "", color = Color.Red, fontSize = 12.sp)
                            }
                            Spacer(Modifier.height(16.dp))
                        }

                        val tabs = listOf("Posts", "Reels", "Tagged")
                        var selectedTab by remember { mutableStateOf(0) }
                        Row(modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp)) {
                            tabs.forEachIndexed { index, label ->
                                Box(
                                    modifier = Modifier.weight(1f).clickable { selectedTab = index }.padding(vertical = 12.dp),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text(label, color = if (selectedTab == index) accent else fg.copy(alpha = 0.6f), fontSize = 13.sp)
                                }
                            }
                        }

                        when (selectedTab) {
                            0 -> ProfilePostsGrid(
                                state = ui.postsState,
                                isLoadingMore = ui.isLoadingMorePosts,
                                isDarkMode = isDarkMode,
                                accent = accent,
                                fg = fg,
                                onRetry = { vm.refresh() },
                                onLoadMore = { vm.loadMorePosts() }
                            )
                            1 -> CenteredHint("Hali reels yo'q", fg)
                            else -> CenteredHint("Hali belgilangan post yo'q", fg)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ProfilePostsGrid(
    state: UiState<List<ProfilePostItem>>,
    isLoadingMore: Boolean,
    isDarkMode: Boolean,
    accent: Color,
    fg: Color,
    onRetry: () -> Unit,
    onLoadMore: () -> Unit
) {
    when (state) {
        is UiState.Loading -> {
            LazyVerticalGrid(
                columns = GridCells.Fixed(3),
                modifier = Modifier.fillMaxSize().padding(2.dp)
            ) {
                items(9) { PostCellSkeleton(isDarkMode) }
            }
        }
        is UiState.Error -> {
            Column(
                modifier = Modifier.fillMaxSize(),
                verticalArrangement = Arrangement.Center,
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text(state.message, color = fg.copy(alpha = 0.8f), fontSize = 14.sp)
                Spacer(Modifier.height(8.dp))
                TextButton(onClick = onRetry) { Text("Qayta urinish", color = accent) }
            }
        }
        is UiState.Empty -> CenteredHint("Hali post yo'q", fg)
        is UiState.Success -> {
            val gridState = rememberLazyGridState()
            LazyVerticalGrid(
                state = gridState,
                columns = GridCells.Fixed(3),
                modifier = Modifier.fillMaxSize().padding(2.dp)
            ) {
                items(state.data, key = { it.id }) { post -> PostCell(post, isDarkMode, fg) }
                if (isLoadingMore) {
                    item(span = { GridItemSpan(maxLineSpan) }) {
                        Box(Modifier.fillMaxWidth().padding(16.dp), contentAlignment = Alignment.Center) {
                            CircularProgressIndicator(color = accent, strokeWidth = 2.dp, modifier = Modifier.size(22.dp))
                        }
                    }
                }
            }
            LaunchedEffect(gridState, state.data.size) {
                snapshotFlow { gridState.layoutInfo.visibleItemsInfo.lastOrNull()?.index }
                    .collect { last -> if (last != null && last >= state.data.size - 3) onLoadMore() }
            }
        }
    }
}

@Composable
private fun PostCell(post: ProfilePostItem, isDarkMode: Boolean, fg: Color) {
    Box(
        modifier = Modifier
            .padding(2.dp)
            .aspectRatio(1f)
            .clip(RoundedCornerShape(6.dp))
            .background(if (isDarkMode) Color(0xFF1A1A1A) else Color(0xFFF0F0F0))
    ) {
        if (!post.mediaUrl.isNullOrBlank()) {
            AsyncImage(
                model = post.mediaUrl,
                contentDescription = null,
                modifier = Modifier.fillMaxSize(),
                contentScale = ContentScale.Crop
            )
        } else {
            Text(
                text = post.caption.ifBlank { "(izohsiz)" },
                color = fg.copy(alpha = 0.8f),
                fontSize = 11.sp,
                maxLines = 4,
                overflow = TextOverflow.Ellipsis,
                textAlign = TextAlign.Center,
                modifier = Modifier.align(Alignment.Center).padding(6.dp)
            )
        }
        if (post.isVideo) {
            Icon(
                Icons.Default.PlayArrow,
                contentDescription = null,
                tint = Color.White,
                modifier = Modifier.align(Alignment.TopEnd).padding(4.dp).size(16.dp)
            )
        }
    }
}

@Composable
private fun PostCellSkeleton(isDarkMode: Boolean) {
    val transition = rememberInfiniteTransition(label = "cell_skeleton")
    val alpha by transition.animateFloat(
        initialValue = 0.3f,
        targetValue = 0.7f,
        animationSpec = infiniteRepeatable(tween(700), RepeatMode.Reverse),
        label = "cell_alpha"
    )
    val base = if (isDarkMode) Color.White else Color.Black
    Box(
        modifier = Modifier
            .padding(2.dp)
            .aspectRatio(1f)
            .clip(RoundedCornerShape(6.dp))
            .background(base.copy(alpha = 0.08f * alpha + 0.03f))
    )
}

@Composable
private fun CenteredHint(text: String, fg: Color) {
    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Text(text, color = fg.copy(alpha = 0.6f), fontSize = 14.sp)
    }
}

@Composable
private fun StatItemHeader(value: String, label: String, contentColor: Color) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(text = value, fontSize = 21.sp, fontWeight = FontWeight.ExtraBold, color = contentColor)
        Text(text = label, fontSize = 13.sp, color = Color.Gray, fontWeight = FontWeight.ExtraBold)
    }
}
