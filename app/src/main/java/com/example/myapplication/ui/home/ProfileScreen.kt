package com.example.myapplication.ui.home

import android.content.Intent
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyGridScope
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.grid.rememberLazyGridState
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.ClickableText
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
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import coil.compose.AsyncImage
import com.example.myapplication.core.ui.UiState
import kotlin.math.roundToInt

private val ProfileAvatarSize = 110.dp
private val ProfileCoverHeight = 280.dp
private val ProfileCoverCorner = 32.dp
private val ProfileAccent = Color(0xFF4D9FFF)
private val ProfileInfoColumnWidth = 132.dp

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProfileScreen(
    isDarkMode: Boolean,
    isRefreshing: Boolean,
    onRefresh: () -> Unit,
    isMyProfile: Boolean = true,
    targetUsername: String? = null,
    onBack: (() -> Unit)? = null,
    onMessage: ((String) -> Unit)? = null,
    onHashtagClick: (String) -> Unit = {}
) {
    val vm: ProfileViewModel = viewModel()
    val ui = vm.uiState.collectAsState().value
    var isEditMode by remember { mutableStateOf(false) }
    val resolvedIsMyProfile = isMyProfile && targetUsername.isNullOrBlank()
    val context = LocalContext.current
    val snackbarHostState = remember { SnackbarHostState() }

    LaunchedEffect(targetUsername) {
        vm.setProfileTarget(targetUsername)
    }

    LaunchedEffect(ui.snackbarMessage) {
        val message = ui.snackbarMessage ?: return@LaunchedEffect
        snackbarHostState.showSnackbar(message)
        vm.consumeSnackbarMessage()
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
            onPickAvatar = { uri -> vm.uploadAvatar(context, uri) },
            onPickBanner = { uri -> vm.uploadBanner(context, uri) },
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

    val bg = if (isDarkMode) Color(0xFF0D0D0D) else Color.White
    val fg = if (isDarkMode) Color.White else Color.Black
    val surface = if (isDarkMode) Color(0xFF1E1E1E) else Color(0xFFF0F0F0)
    val accent = ProfileAccent
    val isFirstLoad = ui.isLoading && ui.fullName.isBlank() && ui.error == null

    Box(modifier = Modifier.fillMaxSize().background(bg)) {
        PullToRefreshBox(
            isRefreshing = isRefreshing || (ui.isLoading && !isFirstLoad),
            onRefresh = {
                vm.refresh()
                onRefresh()
            },
            modifier = Modifier.fillMaxSize()
        ) {
            when {
                isFirstLoad -> ProfileShimmerSkeleton(bg = bg, surface = surface)

                ui.error != null -> {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text(ui.error, color = fg)
                            TextButton(onClick = vm::refresh) { Text("Retry", color = accent) }
                        }
                    }
                }

                else -> {
                    var selectedTab by remember { mutableIntStateOf(0) }
                    val tabs = listOf(Icons.Default.GridOn, Icons.Default.PlayArrow, Icons.Default.AccountBox, Icons.Default.Info)
                    val gridState = rememberLazyGridState()

                    // Scroll-triggered pagination: the grid content lambda below
                    // doesn't own the scroll state (it's shared with the header),
                    // so watch it here instead.
                    LaunchedEffect(gridState, selectedTab, ui.postsState) {
                        if (selectedTab != 0) return@LaunchedEffect
                        snapshotFlow {
                            val info = gridState.layoutInfo
                            (info.visibleItemsInfo.lastOrNull()?.index ?: 0) to info.totalItemsCount
                        }.collect { (lastVisible, total) ->
                            if (total > 0 && lastVisible >= total - 4) {
                                vm.loadMorePosts()
                            }
                        }
                    }

                    LazyVerticalGrid(
                        state = gridState,
                        columns = GridCells.Fixed(3),
                        modifier = Modifier.fillMaxSize()
                    ) {
                        item(span = { GridItemSpan(maxLineSpan) }) {
                            Column {
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
                                    Spacer(Modifier.height(14.dp))

                                    Text(
                                        text = ui.fullName.ifBlank { "No name set" },
                                        color = fg,
                                        fontSize = 26.sp,
                                        fontWeight = FontWeight.Bold,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis
                                    )
                                    Text(
                                        text = if (ui.username.isBlank()) "@unknown" else "@${ui.username}",
                                        color = accent,
                                        fontSize = 16.sp,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis
                                    )

                                    Spacer(Modifier.height(12.dp))

                                    Row(modifier = Modifier.fillMaxWidth()) {
                                        Column(modifier = Modifier.width(ProfileInfoColumnWidth)) {
                                            if (ui.school.isNotBlank()) {
                                                InfoRow(icon = Icons.Default.School, text = ui.school.uppercase(), fg = fg, accent = accent, bold = true)
                                                Spacer(Modifier.height(6.dp))
                                            }
                                            if (ui.group.isNotBlank()) {
                                                InfoRow(icon = Icons.Default.Groups, text = "Group: ${ui.group}", fg = fg, accent = accent, bold = true)
                                            }
                                        }

                                        Spacer(Modifier.width(12.dp))

                                        Row(
                                            modifier = Modifier.weight(1f),
                                            horizontalArrangement = Arrangement.SpaceBetween
                                        ) {
                                            StatItemHeader(formatCount(ui.postsCount), "Posts", fg)
                                            StatItemHeader(formatCount(ui.followersCount), "Followers", fg)
                                            StatItemHeader(formatCount(ui.followingCount), "Following", fg)
                                        }
                                    }

                                    Spacer(Modifier.height(12.dp))

                                    if (ui.bio.isNotBlank()) {
                                        BioText(bio = ui.bio, fg = fg, accent = accent, onHashtagClick = onHashtagClick)
                                        Spacer(Modifier.height(12.dp))
                                    }

                                    if (resolvedIsMyProfile) {
                                        Row(
                                            modifier = Modifier.fillMaxWidth(),
                                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                                        ) {
                                            OutlinedButton(
                                                onClick = { isEditMode = true },
                                                modifier = Modifier.weight(1f).height(52.dp),
                                                colors = ButtonDefaults.outlinedButtonColors(contentColor = accent),
                                                border = ButtonDefaults.outlinedButtonBorder,
                                                shape = RoundedCornerShape(16.dp)
                                            ) {
                                                Icon(Icons.Default.Edit, contentDescription = null, modifier = Modifier.size(18.dp))
                                                Spacer(Modifier.width(6.dp))
                                                Text("Edit Profile", fontWeight = FontWeight.Bold)
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
                                                modifier = Modifier.weight(1f).height(52.dp),
                                                shape = RoundedCornerShape(16.dp),
                                                colors = ButtonDefaults.buttonColors(containerColor = surface)
                                            ) {
                                                Icon(Icons.Default.Share, contentDescription = null, tint = fg, modifier = Modifier.size(18.dp))
                                                Spacer(Modifier.width(6.dp))
                                                Text("Share Profile", color = fg, fontWeight = FontWeight.Bold)
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
                                                modifier = Modifier.weight(1f).height(52.dp),
                                                shape = RoundedCornerShape(16.dp),
                                                colors = ButtonDefaults.buttonColors(
                                                    containerColor = if (following) Color(0xFF2A2A2A) else accent
                                                )
                                            ) {
                                                Text(
                                                    if (following) "Following" else "Follow",
                                                    color = Color.White,
                                                    fontWeight = FontWeight.Bold
                                                )
                                            }
                                            if (onMessage != null) {
                                                Button(
                                                    onClick = { onMessage(ui.username) },
                                                    modifier = Modifier.weight(1f).height(52.dp),
                                                    shape = RoundedCornerShape(16.dp),
                                                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF2A2A2A))
                                                ) {
                                                    Text("Message", color = Color.White, fontWeight = FontWeight.Bold)
                                                }
                                            }
                                        }
                                    }

                                    Spacer(Modifier.height(20.dp))
                                }

                                if (ui.highlights.isNotEmpty()) {
                                    FavoriteMomentsRow(ui.highlights, surface, fg)
                                    Spacer(Modifier.height(16.dp))
                                }

                                ProfileTabBar(
                                    tabs = tabs,
                                    selectedTab = selectedTab,
                                    onTabSelected = { selectedTab = it },
                                    surface = surface,
                                    accent = accent,
                                    fg = fg
                                )
                                Spacer(Modifier.height(4.dp))
                            }
                        }

                        when (selectedTab) {
                            0 -> profilePostsGridItems(
                                state = ui.postsState,
                                isLoadingMore = ui.isLoadingMorePosts,
                                isDarkMode = isDarkMode,
                                accent = accent,
                                fg = fg,
                                onRetry = { vm.refresh() }
                            )
                            1 -> item(span = { GridItemSpan(maxLineSpan) }) {
                                CenteredHint("Hali reels yo'q", fg, height = 200.dp)
                            }
                            2 -> item(span = { GridItemSpan(maxLineSpan) }) {
                                CenteredHint("Hali belgilangan post yo'q", fg, height = 200.dp)
                            }
                            else -> item(span = { GridItemSpan(maxLineSpan) }) {
                                ProfileInfoTab(location = ui.location, school = ui.school, group = ui.group, fg = fg)
                            }
                        }
                    }
                }
            }
        }

        SnackbarHost(hostState = snackbarHostState, modifier = Modifier.align(Alignment.BottomCenter))
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
    Box(modifier = Modifier.fillMaxWidth().height(ProfileCoverHeight + ProfileAvatarSize / 2)) {
        // Cover photo, rounded off at the bottom so it reads as a card sitting
        // on the dark background rather than a hard-edged banner.
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(ProfileCoverHeight)
                .align(Alignment.TopStart)
                .clip(RoundedCornerShape(bottomStart = ProfileCoverCorner, bottomEnd = ProfileCoverCorner))
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
                .clip(CircleShape)
                .background(bg)
                .border(3.dp, accent, CircleShape)
        ) {
            if (!avatarUrl.isNullOrBlank()) {
                AsyncImage(
                    model = avatarUrl,
                    contentDescription = null,
                    modifier = Modifier.fillMaxSize().padding(3.dp).clip(CircleShape),
                    contentScale = ContentScale.Crop
                )
            } else {
                Box(
                    modifier = Modifier.fillMaxSize().padding(3.dp).clip(CircleShape).background(surface),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        Icons.Default.Person,
                        contentDescription = null,
                        tint = fg.copy(alpha = 0.4f),
                        modifier = Modifier.size(48.dp)
                    )
                }
            }
        }
    }
}

@Composable
private fun InfoRow(icon: ImageVector, text: String, fg: Color, accent: Color, bold: Boolean) {
    Row(verticalAlignment = Alignment.Top) {
        Icon(icon, contentDescription = null, tint = accent, modifier = Modifier.size(15.dp))
        Spacer(Modifier.width(6.dp))
        Text(
            text = text,
            color = fg.copy(alpha = 0.9f),
            fontSize = 12.sp,
            fontWeight = if (bold) FontWeight.Bold else FontWeight.Normal
        )
    }
}

/** Bio text with #hashtags rendered in the accent color and made tappable. */
@Composable
private fun BioText(bio: String, fg: Color, accent: Color, onHashtagClick: (String) -> Unit) {
    val annotated = remember(bio, accent) {
        buildAnnotatedString {
            val regex = Regex("#\\w+")
            var lastIndex = 0
            for (match in regex.findAll(bio)) {
                append(bio.substring(lastIndex, match.range.first))
                pushStringAnnotation(tag = "hashtag", annotation = match.value.removePrefix("#"))
                withStyle(SpanStyle(color = accent, fontWeight = FontWeight.SemiBold)) {
                    append(match.value)
                }
                pop()
                lastIndex = match.range.last + 1
            }
            append(bio.substring(lastIndex))
        }
    }
    ClickableText(
        text = annotated,
        style = TextStyle(color = fg.copy(alpha = 0.9f), fontSize = 15.sp, lineHeight = 20.sp),
        maxLines = 3,
        overflow = TextOverflow.Ellipsis,
        onClick = { offset ->
            annotated.getStringAnnotations(tag = "hashtag", start = offset, end = offset)
                .firstOrNull()?.let { onHashtagClick(it.item) }
        }
    )
}

@Composable
private fun ProfileTabBar(
    tabs: List<ImageVector>,
    selectedTab: Int,
    onTabSelected: (Int) -> Unit,
    surface: Color,
    accent: Color,
    fg: Color
) {
    BoxWithConstraints(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 20.dp, vertical = 8.dp)
            .clip(RoundedCornerShape(28.dp))
            .background(surface)
            .padding(6.dp)
            .height(48.dp)
    ) {
        val tabWidth = maxWidth / tabs.size
        val indicatorOffset by animateDpAsState(
            targetValue = tabWidth * selectedTab,
            animationSpec = spring(stiffness = Spring.StiffnessMediumLow),
            label = "tab_indicator"
        )

        Box(
            modifier = Modifier
                .offset(x = indicatorOffset)
                .width(tabWidth)
                .fillMaxHeight()
                .clip(RoundedCornerShape(20.dp))
                .background(accent)
        )

        Row(modifier = Modifier.fillMaxSize()) {
            tabs.forEachIndexed { index, icon ->
                val selected = selectedTab == index
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxHeight()
                        .clickable { onTabSelected(index) },
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
}

@Composable
private fun ProfileInfoTab(location: String, school: String, group: String, fg: Color) {
    val rows = buildList {
        if (location.isNotBlank()) add(Icons.Default.LocationOn to location)
        if (school.isNotBlank()) add(Icons.Default.School to school)
        if (group.isNotBlank()) add(Icons.Default.Groups to "Group: $group")
    }

    if (rows.isEmpty()) {
        CenteredHint("Hali ma'lumot yo'q", fg, height = 200.dp)
        return
    }

    Column(modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 16.dp)) {
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
            fontSize = 15.sp,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.padding(start = 20.dp, bottom = 10.dp)
        )
        LazyRow(
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            contentPadding = PaddingValues(horizontal = 20.dp)
        ) {
            items(highlights, key = { it.id }) { highlight ->
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Box(
                        modifier = Modifier
                            .width(100.dp)
                            .height(140.dp)
                            .clip(RoundedCornerShape(20.dp))
                            .background(surface)
                    ) {
                        if (!highlight.coverUrl.isNullOrBlank()) {
                            AsyncImage(
                                model = highlight.coverUrl,
                                contentDescription = null,
                                modifier = Modifier.fillMaxSize(),
                                contentScale = ContentScale.Crop
                            )
                        } else {
                            Icon(
                                Icons.Default.AccountBox,
                                contentDescription = null,
                                tint = fg.copy(alpha = 0.2f),
                                modifier = Modifier.align(Alignment.Center).size(32.dp)
                            )
                        }
                    }
                    Spacer(Modifier.height(6.dp))
                    Text(
                        text = highlight.title,
                        color = fg,
                        fontSize = 14.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.widthIn(max = 100.dp)
                    )
                }
            }
        }
    }
}

private fun LazyGridScope.profilePostsGridItems(
    state: UiState<List<ProfilePostItem>>,
    isLoadingMore: Boolean,
    isDarkMode: Boolean,
    accent: Color,
    fg: Color,
    onRetry: () -> Unit
) {
    when (state) {
        is UiState.Loading -> {
            items(9) { PostCellSkeleton(isDarkMode) }
        }
        is UiState.Error -> {
            item(span = { GridItemSpan(maxLineSpan) }) {
                Column(
                    modifier = Modifier.fillMaxWidth().height(200.dp),
                    verticalArrangement = Arrangement.Center,
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(state.message, color = fg.copy(alpha = 0.8f), fontSize = 14.sp)
                    Spacer(Modifier.height(8.dp))
                    TextButton(onClick = onRetry) { Text("Qayta urinish", color = accent) }
                }
            }
        }
        is UiState.Empty -> item(span = { GridItemSpan(maxLineSpan) }) {
            CenteredHint("Hali post yo'q", fg, height = 200.dp)
        }
        is UiState.Success -> {
            items(state.data, key = { it.id }) { post -> PostCell(post, isDarkMode, fg) }
            if (isLoadingMore) {
                item(span = { GridItemSpan(maxLineSpan) }) {
                    Box(Modifier.fillMaxWidth().padding(16.dp), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator(color = accent, strokeWidth = 2.dp, modifier = Modifier.size(22.dp))
                    }
                }
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
private fun CenteredHint(text: String, fg: Color, height: Dp = 0.dp) {
    Box(
        modifier = if (height > 0.dp) Modifier.fillMaxWidth().height(height) else Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        Text(text, color = fg.copy(alpha = 0.6f), fontSize = 14.sp)
    }
}

@Composable
private fun StatItemHeader(value: String, label: String, contentColor: Color) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(text = value, fontSize = 22.sp, fontWeight = FontWeight.Bold, color = contentColor)
        Text(text = label, fontSize = 13.sp, color = Color(0xFF8A8A8A), fontWeight = FontWeight.Medium)
    }
}

/** 1200 -> "1.2K", 1500000 -> "1.5M". */
private fun formatCount(count: Int): String {
    val n = count.toDouble()
    return when {
        n >= 1_000_000 -> formatWithSuffix(n / 1_000_000, "M")
        n >= 1_000 -> formatWithSuffix(n / 1_000, "K")
        else -> count.toString()
    }
}

private fun formatWithSuffix(value: Double, suffix: String): String {
    val rounded = (value * 10).roundToInt() / 10.0
    val text = if (rounded % 1.0 == 0.0) rounded.toInt().toString() else rounded.toString()
    return "$text$suffix"
}

@Composable
private fun ProfileShimmerSkeleton(bg: Color, surface: Color) {
    val transition = rememberInfiniteTransition(label = "profile_skeleton")
    val alpha by transition.animateFloat(
        initialValue = 0.4f,
        targetValue = 0.85f,
        animationSpec = infiniteRepeatable(tween(800), RepeatMode.Reverse),
        label = "skeleton_alpha"
    )
    val blockColor = surface.copy(alpha = alpha)

    Column(modifier = Modifier.fillMaxSize().background(bg)) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(ProfileCoverHeight)
                .clip(RoundedCornerShape(bottomStart = ProfileCoverCorner, bottomEnd = ProfileCoverCorner))
                .background(blockColor)
        )
        Row(modifier = Modifier.padding(start = 20.dp, top = 0.dp).offset(y = -(ProfileAvatarSize / 2))) {
            Box(modifier = Modifier.size(ProfileAvatarSize).clip(CircleShape).background(bg).padding(3.dp).clip(CircleShape).background(blockColor))
        }
        Column(modifier = Modifier.padding(horizontal = 20.dp).offset(y = -(ProfileAvatarSize / 2) + 10.dp)) {
            Box(modifier = Modifier.width(160.dp).height(20.dp).clip(RoundedCornerShape(6.dp)).background(blockColor))
            Spacer(Modifier.height(8.dp))
            Box(modifier = Modifier.width(100.dp).height(14.dp).clip(RoundedCornerShape(6.dp)).background(blockColor))
            Spacer(Modifier.height(16.dp))
            Box(modifier = Modifier.fillMaxWidth().height(60.dp).clip(RoundedCornerShape(12.dp)).background(blockColor))
            Spacer(Modifier.height(16.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Box(modifier = Modifier.weight(1f).height(52.dp).clip(RoundedCornerShape(16.dp)).background(blockColor))
                Box(modifier = Modifier.weight(1f).height(52.dp).clip(RoundedCornerShape(16.dp)).background(blockColor))
            }
        }
    }
}
