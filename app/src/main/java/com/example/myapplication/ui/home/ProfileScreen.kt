package com.example.myapplication.ui.home

import android.content.Intent
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.grid.rememberLazyGridState
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.AccountBox
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.GridOn
import androidx.compose.material.icons.filled.Groups
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.School
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.*
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import coil.compose.AsyncImage
import com.example.myapplication.core.ui.UiState
import kotlinx.coroutines.launch

private val ProfileAvatarSize = 88.dp
private val ProfileInfoColumnWidth = 116.dp

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProfileScreen(
    isDarkMode: Boolean,
    isRefreshing: Boolean,
    onRefresh: () -> Unit,
    isMyProfile: Boolean = true,
    targetUsername: String? = null,
    onBack: (() -> Unit)? = null,
    onMessage: ((String) -> Unit)? = null
) {
    val vm: ProfileViewModel = viewModel()
    val ui = vm.uiState.collectAsState().value
    var isEditMode by remember { mutableStateOf(false) }
    val resolvedIsMyProfile = isMyProfile && targetUsername.isNullOrBlank()
    val context = LocalContext.current

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
            avatarUrl = ui.avatarUrl,
            bannerUrl = ui.bannerUrl,
            isUploadingAvatar = ui.isUploadingAvatar,
            isUploadingBanner = ui.isUploadingBanner,
            onPickAvatar = vm::uploadAvatar,
            onPickBanner = vm::uploadBanner,
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
    val surface = if (isDarkMode) Color(0xFF1A1A1A) else Color(0xFFF0F0F0)

    PullToRefreshBox(
        isRefreshing = isRefreshing || ui.isLoading,
        onRefresh = {
            vm.refresh()
            onRefresh()
        },
        modifier = Modifier.fillMaxSize()
    ) {
        Box(modifier = Modifier.fillMaxSize().background(bg)) {
            Column(modifier = Modifier.fillMaxSize()) {
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
                        ProfileHeader(
                            avatarUrl = ui.avatarUrl,
                            bannerUrl = ui.bannerUrl,
                            surface = surface,
                            accent = accent,
                            fg = fg,
                            bg = bg,
                            onBack = onBack
                        )

                        Column(modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp)) {
                            Spacer(Modifier.height(10.dp))

                            Row(modifier = Modifier.fillMaxWidth()) {
                                Column(modifier = Modifier.width(ProfileInfoColumnWidth)) {
                                    if (ui.location.isNotBlank()) {
                                        InfoRow(icon = Icons.Default.LocationOn, text = ui.location, fg = fg, bold = true)
                                        Spacer(Modifier.height(6.dp))
                                    }
                                    if (ui.school.isNotBlank()) {
                                        InfoRow(icon = Icons.Default.School, text = ui.school.uppercase(), fg = fg, bold = true)
                                        Spacer(Modifier.height(6.dp))
                                    }
                                    if (ui.group.isNotBlank()) {
                                        InfoRow(icon = Icons.Default.Groups, text = "Group: ${ui.group}", fg = fg, bold = true)
                                    }
                                }

                                Spacer(Modifier.width(12.dp))

                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        text = ui.fullName.ifBlank { "No name set" },
                                        color = fg,
                                        fontSize = 20.sp,
                                        fontWeight = FontWeight.Black,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis
                                    )
                                    Text(
                                        text = if (ui.username.isBlank()) "@unknown" else "@${ui.username}",
                                        color = accent,
                                        fontSize = 14.sp,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis
                                    )
                                    Spacer(Modifier.height(10.dp))
                                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                        StatItemHeader(ui.postsCount.toString(), "Posts", fg)
                                        StatItemHeader(ui.followersCount.toString(), "Followers", fg)
                                        StatItemHeader(ui.followingCount.toString(), "Following", fg)
                                    }
                                }
                            }

                            Spacer(Modifier.height(12.dp))

                            if (ui.bio.isNotBlank()) {
                                Text(ui.bio, color = fg, fontSize = 14.sp)
                                Spacer(Modifier.height(12.dp))
                            }

                            if (resolvedIsMyProfile) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                                ) {
                                    OutlinedButton(
                                        onClick = { isEditMode = true },
                                        modifier = Modifier.weight(1f).height(46.dp),
                                        colors = ButtonDefaults.outlinedButtonColors(contentColor = accent),
                                        border = ButtonDefaults.outlinedButtonBorder,
                                        shape = RoundedCornerShape(14.dp)
                                    ) {
                                        Icon(Icons.Default.Edit, contentDescription = null, modifier = Modifier.size(18.dp))
                                        Spacer(Modifier.width(6.dp))
                                        Text("Edit")
                                    }
                                    Button(
                                        onClick = {
                                            val shareText = if (ui.username.isBlank()) {
                                                "Stugram ilovasidagi profilimni ko'ring!"
                                            } else {
                                                "Stugram ilovasida @${ui.username} profilini ko'ring!"
                                            }
                                            val intent = Intent(Intent.ACTION_SEND).apply {
                                                type = "text/plain"
                                                putExtra(Intent.EXTRA_TEXT, shareText)
                                            }
                                            context.startActivity(Intent.createChooser(intent, "Ulashish"))
                                        },
                                        modifier = Modifier.weight(1f).height(46.dp),
                                        shape = RoundedCornerShape(14.dp),
                                        colors = ButtonDefaults.buttonColors(containerColor = surface)
                                    ) {
                                        Icon(Icons.Default.Share, contentDescription = null, tint = fg, modifier = Modifier.size(18.dp))
                                        Spacer(Modifier.width(6.dp))
                                        Text("Share", color = fg)
                                    }
                                }
                            } else {
                                val following = ui.followStatus == "following"
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                                ) {
                                    Button(
                                        onClick = { vm.followOrUnfollow() },
                                        enabled = !ui.isSaving,
                                        modifier = Modifier.weight(1f).height(46.dp),
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
                                    if (onMessage != null) {
                                        Button(
                                            onClick = { onMessage(ui.username) },
                                            modifier = Modifier.weight(1f).height(46.dp),
                                            shape = RoundedCornerShape(14.dp),
                                            colors = ButtonDefaults.buttonColors(containerColor = surface)
                                        ) {
                                            Text("Message", color = fg)
                                        }
                                    }
                                }
                            }

                            if (!ui.saveError.isNullOrBlank()) {
                                Spacer(Modifier.height(8.dp))
                                Text(ui.saveError ?: "", color = Color.Red, fontSize = 12.sp)
                            }
                            Spacer(Modifier.height(16.dp))
                        }

                        if (ui.highlights.isNotEmpty()) {
                            FavoriteMomentsRow(ui.highlights, surface, fg)
                            Spacer(Modifier.height(16.dp))
                        }

                        val tabs = listOf(Icons.Default.GridOn, Icons.Default.PlayArrow, Icons.Default.AccountBox, Icons.Default.Info)
                        val pagerState = rememberPagerState(pageCount = { tabs.size })
                        val pagerScope = rememberCoroutineScope()

                        Row(modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp)) {
                            tabs.forEachIndexed { index, icon ->
                                val selected = pagerState.currentPage == index
                                Box(
                                    modifier = Modifier
                                        .weight(1f)
                                        .padding(vertical = 10.dp),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Box(
                                        modifier = Modifier
                                            .size(38.dp)
                                            .clip(RoundedCornerShape(12.dp))
                                            .background(if (selected) accent else Color.Transparent)
                                            .clickable {
                                                pagerScope.launch { pagerState.animateScrollToPage(index) }
                                            },
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Icon(
                                            icon,
                                            contentDescription = null,
                                            tint = if (selected) Color.White else fg.copy(alpha = 0.6f),
                                            modifier = Modifier.size(20.dp)
                                        )
                                    }
                                }
                            }
                        }

                        HorizontalPager(
                            state = pagerState,
                            modifier = Modifier.weight(1f).fillMaxWidth()
                        ) { page ->
                            when (page) {
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
                                2 -> CenteredHint("Hali belgilangan post yo'q", fg)
                                else -> ProfileInfoTab(
                                    location = ui.location,
                                    school = ui.school,
                                    group = ui.group,
                                    bio = ui.bio,
                                    fg = fg
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ProfileHeader(
    avatarUrl: String?,
    bannerUrl: String?,
    surface: Color,
    accent: Color,
    fg: Color,
    bg: Color,
    onBack: (() -> Unit)?
) {
    val bannerHeight = 140.dp

    Box(modifier = Modifier.fillMaxWidth().height(bannerHeight + ProfileAvatarSize / 2)) {
        // Banner: real photo if set, otherwise a plain flat surface (no fake photo).
        // Drawn edge-to-edge; the status bar overlays directly on top of it.
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(bannerHeight)
                .align(Alignment.TopStart)
                .background(surface)
        ) {
            if (!bannerUrl.isNullOrBlank()) {
                AsyncImage(
                    model = bannerUrl,
                    contentDescription = null,
                    modifier = Modifier.fillMaxSize(),
                    contentScale = ContentScale.Crop
                )
            }
        }

        if (onBack != null) {
            IconButton(
                onClick = onBack,
                modifier = Modifier
                    .align(Alignment.TopStart)
                    .statusBarsPadding()
                    .padding(start = 8.dp, top = 4.dp)
                    .size(36.dp)
                    .clip(CircleShape)
                    .background(Color.Black.copy(alpha = 0.35f))
            ) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = null, tint = Color.White)
            }
        }

        // Avatar: real photo if set, otherwise a generic person silhouette.
        Box(
            modifier = Modifier
                .align(Alignment.BottomStart)
                .padding(start = 20.dp)
                .size(ProfileAvatarSize)
                .background(bg, CircleShape)
                .padding(3.dp)
                .border(2.dp, accent, CircleShape)
                .padding(2.dp)
                .clip(CircleShape)
        ) {
            if (!avatarUrl.isNullOrBlank()) {
                AsyncImage(
                    model = avatarUrl,
                    contentDescription = null,
                    modifier = Modifier.fillMaxSize(),
                    contentScale = ContentScale.Crop
                )
            } else {
                Box(
                    modifier = Modifier.fillMaxSize().background(surface),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        Icons.Default.Person,
                        contentDescription = null,
                        tint = fg.copy(alpha = 0.4f),
                        modifier = Modifier.size(44.dp)
                    )
                }
            }
        }
    }
}

@Composable
private fun InfoRow(icon: ImageVector, text: String, fg: Color, bold: Boolean) {
    Row(verticalAlignment = Alignment.Top) {
        Icon(icon, contentDescription = null, tint = fg.copy(alpha = 0.7f), modifier = Modifier.size(15.dp))
        Spacer(Modifier.width(6.dp))
        Text(
            text = text,
            color = fg.copy(alpha = 0.85f),
            fontSize = 12.sp,
            fontWeight = if (bold) FontWeight.Bold else FontWeight.Normal
        )
    }
}

@Composable
private fun ProfileInfoTab(location: String, school: String, group: String, bio: String, fg: Color) {
    val rows = buildList {
        if (location.isNotBlank()) add(Icons.Default.LocationOn to location)
        if (school.isNotBlank()) add(Icons.Default.School to school)
        if (group.isNotBlank()) add(Icons.Default.Groups to "Group: $group")
    }

    if (rows.isEmpty() && bio.isBlank()) {
        CenteredHint("Hali ma'lumot yo'q", fg)
        return
    }

    Column(modifier = Modifier.fillMaxSize().padding(horizontal = 20.dp, vertical = 16.dp)) {
        if (bio.isNotBlank()) {
            Text(bio, color = fg, fontSize = 14.sp)
            Spacer(Modifier.height(16.dp))
        }
        rows.forEach { (icon, text) ->
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(vertical = 6.dp)) {
                Icon(icon, contentDescription = null, tint = fg.copy(alpha = 0.7f), modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(10.dp))
                Text(text, color = fg.copy(alpha = 0.9f), fontSize = 14.sp)
            }
        }
    }
}

@Composable
private fun FavoriteMomentsRow(highlights: List<HighlightItem>, surface: Color, fg: Color) {
    Column {
        Text(
            text = "Favorite Moments",
            color = fg.copy(alpha = 0.8f),
            fontSize = 13.sp,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.padding(start = 20.dp, bottom = 10.dp)
        )
        LazyRow(
            horizontalArrangement = Arrangement.spacedBy(14.dp),
            contentPadding = PaddingValues(horizontal = 20.dp)
        ) {
            items(highlights, key = { it.id }) { highlight ->
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Box(
                        modifier = Modifier
                            .size(72.dp)
                            .clip(RoundedCornerShape(18.dp))
                            .background(surface)
                    ) {
                        if (!highlight.coverUrl.isNullOrBlank()) {
                            AsyncImage(
                                model = highlight.coverUrl,
                                contentDescription = null,
                                modifier = Modifier.fillMaxSize(),
                                contentScale = ContentScale.Crop
                            )
                        }
                    }
                    Spacer(Modifier.height(6.dp))
                    Text(
                        text = highlight.title,
                        color = fg.copy(alpha = 0.8f),
                        fontSize = 11.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.widthIn(max = 72.dp)
                    )
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
