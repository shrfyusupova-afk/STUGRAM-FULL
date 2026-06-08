package com.example.myapplication.ui.home

import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.*
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.*
import androidx.compose.foundation.pager.*
import androidx.compose.foundation.shape.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.ChatBubbleOutline
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.*
import androidx.compose.ui.draw.*
import androidx.compose.ui.graphics.*
import androidx.compose.ui.graphics.vector.*
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.*
import androidx.compose.ui.platform.*
import androidx.compose.ui.text.font.*
import androidx.compose.ui.text.style.*
import androidx.compose.ui.unit.*
import androidx.lifecycle.viewmodel.compose.viewModel
import coil.compose.*
import coil.request.*
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

private val SBg      = Color(0xFF0F0F0F)
private val SSurface = Color(0xFF1A1A1A)
private val SAccent  = Color(0xFF2979FF)
private val SFg      = Color.White
private val SSec     = Color(0xFF9E9E9E)
private val SInputBg = Color.White.copy(alpha = 0.06f)

// ── Main Search Screen ────────────────────────────────────────────────
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SearchScreen(
    isDarkMode: Boolean,
    isRefreshing: Boolean,
    onRefresh: () -> Unit,
    onOpenProfile: (String) -> Unit
) {
    val vm: SearchViewModel = viewModel()
    val ui = vm.uiState.collectAsState().value
    var selectedPost by remember { mutableStateOf<PostData?>(null) }
    var viewingReel by remember { mutableStateOf<ReelItem?>(null) }

    selectedPost?.let { post ->
        PostDetailSheet(
            post = post,
            onDismiss = { selectedPost = null },
            onOpenProfile = { selectedPost = null; onOpenProfile(it) }
        )
    }

    // Video post → fullscreen reels viewer (animated expand from grid)
    AnimatedVisibility(
        visible = viewingReel != null,
        enter = fadeIn(tween(220)) + scaleIn(tween(280, easing = FastOutSlowInEasing), initialScale = 0.92f),
        exit = fadeOut(tween(180)) + scaleOut(tween(220), targetScale = 0.94f)
    ) {
        viewingReel?.let { reel ->
            ReelFullscreenViewer(
                reel = reel,
                onDismiss = { viewingReel = null },
                onProfileClick = { viewingReel = null; onOpenProfile(it) }
            )
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(SBg)
            .statusBarsPadding()
    ) {
        // ── Search bar ───────────────────────────────────────────────
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            OutlinedTextField(
                value = ui.query,
                onValueChange = {
                    vm.onQueryChange(it)
                    if (!ui.isFilterActive && it.trim().length >= 2) vm.search()
                    else if (ui.isFilterActive && it.trim().length >= 2) vm.searchAdvanced()
                },
                placeholder = { Text("Qidirish...", color = SSec) },
                leadingIcon = { Icon(Icons.Default.Search, null, tint = SSec, modifier = Modifier.size(18.dp)) },
                trailingIcon = {
                    if (ui.query.isNotEmpty()) {
                        IconButton(onClick = { vm.onQueryChange("") }, modifier = Modifier.size(18.dp)) {
                            Icon(Icons.Default.Clear, null, tint = SSec)
                        }
                    }
                },
                modifier = Modifier.weight(1f).height(52.dp),
                shape = RoundedCornerShape(14.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedContainerColor = SInputBg,
                    unfocusedContainerColor = SInputBg,
                    focusedBorderColor = SAccent,
                    unfocusedBorderColor = Color.Transparent,
                    focusedTextColor = SFg,
                    unfocusedTextColor = SFg
                ),
                singleLine = true
            )
            Box {
                IconButton(
                    onClick = { vm.toggleFilterPanel() },
                    modifier = Modifier
                        .size(52.dp)
                        .clip(RoundedCornerShape(14.dp))
                        .background(if (ui.showFilterPanel) SAccent else SInputBg)
                ) {
                    Icon(
                        Icons.Default.FilterList,
                        contentDescription = "Filter",
                        tint = when {
                            ui.showFilterPanel -> Color.White
                            ui.isFilterActive -> SAccent
                            else -> SSec
                        },
                        modifier = Modifier.size(22.dp)
                    )
                }
                if (ui.isFilterActive && !ui.showFilterPanel) {
                    Box(
                        modifier = Modifier
                            .size(9.dp)
                            .align(Alignment.TopEnd)
                            .background(SAccent, CircleShape)
                    )
                }
            }
        }

        // ── Filter panel ─────────────────────────────────────────────
        AnimatedVisibility(visible = ui.showFilterPanel, enter = expandVertically(), exit = shrinkVertically()) {
            FilterPanel(
                isDarkMode = isDarkMode,
                panelBg = Color(0xFF161616),
                contentColor = SFg,
                secondary = SSec,
                accent = SAccent,
                selectedRegion = ui.selectedRegion,
                selectedDistrict = ui.selectedDistrict,
                schoolInput = ui.schoolInput,
                onRegionChange = vm::onRegionChange,
                onDistrictChange = vm::onDistrictChange,
                onSchoolInputChange = vm::onSchoolInputChange,
                onApply = vm::applyFilter,
                onClear = { vm.clearFilter(); vm.toggleFilterPanel() }
            )
        }

        // ── Active filter chips ──────────────────────────────────────
        if (ui.isFilterActive) {
            Row(
                modifier = Modifier.fillMaxWidth().padding(start = 16.dp, end = 16.dp, bottom = 6.dp),
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                if (ui.selectedRegion != null) FilterChip(ui.selectedRegion, SAccent, SFg)
                if (ui.selectedDistrict != null) FilterChip(ui.selectedDistrict, SAccent, SFg)
                if (ui.schoolInput.isNotBlank()) FilterChip(ui.schoolInput, SAccent, SFg)
                TextButton(
                    onClick = { vm.clearFilter() },
                    contentPadding = PaddingValues(horizontal = 8.dp, vertical = 0.dp),
                    modifier = Modifier.height(28.dp)
                ) { Text("Tozalash", color = Color(0xFFE53935), fontSize = 12.sp) }
            }
        }

        // ── Content ──────────────────────────────────────────────────
        when {
            ui.isLoading -> Box(Modifier.fillMaxSize(), Alignment.Center) {
                CircularProgressIndicator(color = SAccent)
            }
            ui.error != null -> Box(Modifier.fillMaxSize(), Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(ui.error, color = SFg, fontSize = 13.sp)
                    Spacer(Modifier.height(8.dp))
                    TextButton(onClick = { vm.search() }) { Text("Qayta urinish", color = SAccent) }
                }
            }
            !ui.isFilterActive && ui.query.trim().length < 2 -> DiscoverySection(
                creators = ui.discoveryCreators,
                posts = ui.trendingPosts,
                isLoading = ui.isLoadingDiscovery,
                onOpenProfile = onOpenProfile,
                onOpenPost = { post ->
                    if (post.isVideo) viewingReel = postToReel(post) else selectedPost = post
                }
            )
            ui.users.isEmpty() -> Box(Modifier.fillMaxSize(), Alignment.Center) {
                Text("Natija topilmadi", color = SSec, fontSize = 14.sp)
            }
            else -> LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(start = 16.dp, top = 4.dp, end = 16.dp, bottom = 100.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(ui.users, key = { it.id }) { user ->
                    UserCard(
                        user = user,
                        isDarkMode = isDarkMode,
                        cardBg = SSurface,
                        contentColor = SFg,
                        secondary = SSec,
                        accent = SAccent,
                        isBusy = ui.followActionUserId == user.id,
                        onOpenProfile = onOpenProfile,
                        onFollow = { vm.followOrUnfollow(user) }
                    )
                }
            }
        }
    }
}

// ── Discovery section ─────────────────────────────────────────────────
@Composable
private fun DiscoverySection(
    creators: List<RecommendedProfile>,
    posts: List<PostData>,
    isLoading: Boolean,
    onOpenProfile: (String) -> Unit,
    onOpenPost: (PostData) -> Unit
) {
    if (isLoading) {
        Box(Modifier.fillMaxSize(), Alignment.Center) {
            CircularProgressIndicator(color = SAccent, modifier = Modifier.size(32.dp))
        }
        return
    }

    // Staggered entry: each section slides up + fades in
    var entered by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) { entered = true }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(bottom = 100.dp)
    ) {
        // ── Creators Loops ──────────────────────────────────────────
        if (creators.isNotEmpty()) {
            item {
                AnimSection(visible = entered, delayMs = 0) {
                    SectionHeader(title = "Creators Loops", badge = "LIVE", badgeColor = Color(0xFFE53935))
                }
            }
            item {
                AnimSection(visible = entered, delayMs = 80) {
                    CreatorsCarousel(creators = creators, onOpenProfile = onOpenProfile)
                }
            }
            item { Spacer(Modifier.height(24.dp)) }
        }

        // ── Trending Loops ──────────────────────────────────────────
        if (posts.isNotEmpty()) {
            item {
                AnimSection(visible = entered, delayMs = 160) {
                    SectionHeader(title = "Trending Loops", emoji = "🔥")
                }
            }
            item {
                AnimSection(visible = entered, delayMs = 240) {
                    TrendingGrid(posts = posts, onOpenPost = onOpenPost, onOpenProfile = onOpenProfile)
                }
            }
        }

        if (creators.isEmpty() && posts.isEmpty()) {
            item {
                Box(modifier = Modifier.fillParentMaxSize(), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(Icons.Default.Search, null, tint = SSec.copy(0.4f), modifier = Modifier.size(56.dp))
                        Spacer(Modifier.height(12.dp))
                        Text("Foydalanuvchi yoki maktabni qidiring", color = SSec, fontSize = 14.sp)
                    }
                }
            }
        }
    }
}

// Animated section wrapper — slide up + fade in with staggered delay
@Composable
private fun AnimSection(visible: Boolean, delayMs: Int, content: @Composable () -> Unit) {
    AnimatedVisibility(
        visible = visible,
        enter = fadeIn(tween(420, delayMillis = delayMs)) +
                slideInVertically(tween(420, delayMillis = delayMs, easing = FastOutSlowInEasing)) { it / 3 }
    ) {
        content()
    }
}

@Composable
private fun SectionHeader(title: String, badge: String? = null, badgeColor: Color = SAccent, emoji: String? = null) {
    Row(
        modifier = Modifier.padding(start = 16.dp, top = 4.dp, bottom = 12.dp, end = 16.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        if (emoji != null) Text(emoji, fontSize = 20.sp)
        Text(title, color = SFg, fontWeight = FontWeight.ExtraBold, fontSize = 20.sp)
        if (badge != null) {
            Box(
                modifier = Modifier
                    .background(badgeColor, RoundedCornerShape(6.dp))
                    .padding(horizontal = 7.dp, vertical = 2.dp)
            ) {
                Text(badge, color = Color.White, fontSize = 10.sp, fontWeight = FontWeight.ExtraBold)
            }
        }
    }
}

// ── Creators auto-scrolling carousel ─────────────────────────────────
@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun CreatorsCarousel(
    creators: List<RecommendedProfile>,
    onOpenProfile: (String) -> Unit
) {
    val pageCount = if (creators.size > 1) Int.MAX_VALUE else creators.size
    val pagerState = rememberPagerState(initialPage = pageCount / 2) { pageCount }
    val scope = rememberCoroutineScope()

    LaunchedEffect(Unit) {
        while (true) {
            delay(3200)
            scope.launch {
                pagerState.animateScrollToPage(
                    pagerState.currentPage + 1,
                    animationSpec = tween(600, easing = FastOutSlowInEasing)
                )
            }
        }
    }

    HorizontalPager(
        state = pagerState,
        contentPadding = PaddingValues(horizontal = 28.dp),
        pageSpacing = 12.dp,
        modifier = Modifier.fillMaxWidth().height(220.dp)
    ) { pageIndex ->
        val creator = creators[pageIndex % creators.size]
        val pageOffset = (pagerState.currentPage - pageIndex + pagerState.currentPageOffsetFraction)
            .coerceIn(-1f, 1f)
        val scale by animateFloatAsState(
            targetValue = if (pageOffset == 0f) 1f else 0.92f,
            animationSpec = spring(stiffness = Spring.StiffnessLow),
            label = "card_scale"
        )
        CreatorLoopCard(
            creator = creator,
            scale = scale,
            onOpenProfile = onOpenProfile
        )
    }
}

@Composable
private fun CreatorLoopCard(
    creator: RecommendedProfile,
    scale: Float = 1f,
    onOpenProfile: (String) -> Unit
) {
    var isFollowed by remember(creator.id) { mutableStateOf(creator.followStatus == "following") }
    val ctx = LocalContext.current

    Box(
        modifier = Modifier
            .fillMaxSize()
            .scale(scale)
            .clip(RoundedCornerShape(24.dp))
            .background(SSurface)
            .clickable { if (creator.username.isNotBlank()) onOpenProfile(creator.username) }
    ) {
        // Background: banner → blurred-avatar fallback → gradient
        val bgUrl = creator.banner.ifBlank { creator.avatar.ifBlank { null } }
        if (bgUrl != null) {
            AsyncImage(
                model = ImageRequest.Builder(ctx).data(bgUrl).crossfade(true).build(),
                contentDescription = null,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize()
            )
        } else {
            Box(
                modifier = Modifier.fillMaxSize().background(
                    Brush.linearGradient(listOf(Color(0xFF0D2B5E), Color(0xFF091830)))
                )
            )
        }

        // Dark scrim
        Box(
            modifier = Modifier.fillMaxSize().background(
                Brush.verticalGradient(
                    listOf(Color.Black.copy(0.25f), Color.Transparent, Color.Black.copy(0.72f))
                )
            )
        )

        // Follow button — top right
        Box(
            modifier = Modifier
                .align(Alignment.TopEnd)
                .padding(12.dp)
                .clip(RoundedCornerShape(20.dp))
                .background(if (isFollowed) Color.White.copy(0.18f) else SAccent)
                .clickable { isFollowed = !isFollowed }
                .padding(horizontal = 14.dp, vertical = 6.dp)
        ) {
            Text(
                text = if (isFollowed) "Following" else "Follow",
                color = Color.White,
                fontSize = 12.sp,
                fontWeight = FontWeight.ExtraBold
            )
        }

        // Bottom info
        Column(
            modifier = Modifier
                .align(Alignment.BottomStart)
                .fillMaxWidth()
                .padding(start = 12.dp, end = 12.dp, bottom = 12.dp)
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Box(
                    modifier = Modifier
                        .size(44.dp)
                        .clip(CircleShape)
                        .background(Color.White.copy(0.2f))
                        .border(1.5.dp, Color.White.copy(0.5f), CircleShape),
                    contentAlignment = Alignment.Center
                ) {
                    if (creator.avatar.isNotBlank()) {
                        AsyncImage(
                            model = ImageRequest.Builder(ctx).data(creator.avatar).crossfade(true).build(),
                            contentDescription = null,
                            contentScale = ContentScale.Crop,
                            modifier = Modifier.fillMaxSize().clip(CircleShape)
                        )
                    } else {
                        Icon(Icons.Default.Person, null, tint = Color.White, modifier = Modifier.size(24.dp))
                    }
                }
                Column {
                    Text(
                        creator.name.ifBlank { creator.username },
                        color = Color.White,
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Bold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    Text(
                        "@${creator.username}",
                        color = Color.White.copy(0.72f),
                        fontSize = 12.sp,
                        maxLines = 1
                    )
                }
            }

            Spacer(Modifier.height(8.dp))

            // Loop label chip
            Row(
                modifier = Modifier
                    .background(Color.Black.copy(0.4f), RoundedCornerShape(10.dp))
                    .padding(horizontal = 10.dp, vertical = 5.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(5.dp)
            ) {
                Box(modifier = Modifier.size(6.dp).background(SAccent, CircleShape))
                Text("Stugram Loop", color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
            }
        }
    }
}

// ── Trending 2-column grid (non-lazy, inside LazyColumn) ─────────────
@Composable
private fun TrendingGrid(
    posts: List<PostData>,
    onOpenPost: (PostData) -> Unit,
    onOpenProfile: (String) -> Unit
) {
    Column(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        posts.chunked(2).forEach { row ->
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                row.forEach { post ->
                    TrendingCell(
                        post = post,
                        modifier = Modifier.weight(1f),
                        onTap = { onOpenPost(post) },
                        onUsernameClick = { onOpenProfile(post.user) }
                    )
                }
                if (row.size == 1) Spacer(Modifier.weight(1f))
            }
        }
    }
}

@Composable
private fun TrendingCell(
    post: PostData,
    modifier: Modifier = Modifier,
    onTap: () -> Unit,
    onUsernameClick: () -> Unit
) {
    // Adaptive image ratio
    var ratio by remember { mutableFloatStateOf(1f) }
    val painter = rememberAsyncImagePainter(
        model = ImageRequest.Builder(LocalContext.current)
            .data(post.image)
            .crossfade(true)
            .build()
    )
    val painterState = painter.state
    LaunchedEffect(painterState) {
        if (painterState is AsyncImagePainter.State.Success) {
            val sz = painterState.painter.intrinsicSize
            if (sz.width > 0 && sz.height > 0) ratio = sz.width / sz.height
        }
    }

    // Press scale animation
    var pressed by remember { mutableStateOf(false) }
    val pressScale by animateFloatAsState(if (pressed) 0.96f else 1f, spring(stiffness = Spring.StiffnessMedium), label = "press")

    Column(modifier = modifier) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .aspectRatio(ratio.coerceIn(0.4f, 2f))
                .scale(pressScale)
                .clip(RoundedCornerShape(18.dp))
                .background(SSurface)
                .pointerInput(post.id) {
                    detectTapGestures(
                        onPress = { pressed = true; tryAwaitRelease(); pressed = false },
                        onTap = { onTap() }
                    )
                }
        ) {
            Image(
                painter = painter,
                contentDescription = null,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize()
            )

            // Top gradient + username
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .align(Alignment.TopStart)
                    .background(Brush.verticalGradient(listOf(Color.Black.copy(0.55f), Color.Transparent)))
                    .padding(8.dp)
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                    Box(
                        modifier = Modifier
                            .size(20.dp)
                            .clip(CircleShape)
                            .background(SAccent.copy(0.4f)),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(Icons.Default.Person, null, tint = Color.White, modifier = Modifier.size(13.dp))
                    }
                    Text(
                        "@${post.user}",
                        color = Color.White,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.SemiBold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.clickable { onUsernameClick() }
                    )
                }
            }

            // Reel play icon
            if (post.isVideo) {
                Box(
                    modifier = Modifier
                        .size(34.dp)
                        .align(Alignment.Center)
                        .background(Color.Black.copy(0.45f), CircleShape)
                        .border(1.dp, Color.White.copy(0.4f), CircleShape),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(Icons.Default.PlayArrow, null, tint = Color.White, modifier = Modifier.size(20.dp))
                }
            }

            // Bottom caption scrim
            if (post.caption.isNotBlank()) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .align(Alignment.BottomStart)
                        .background(Brush.verticalGradient(listOf(Color.Transparent, Color.Black.copy(0.72f))))
                        .padding(start = 8.dp, end = 8.dp, top = 16.dp, bottom = 8.dp)
                ) {
                    Text(post.caption, color = Color.White, fontSize = 11.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
                }
            }
        }

        // Emoji reaction row
        Row(
            modifier = Modifier.fillMaxWidth().padding(top = 6.dp, start = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            listOf("😍", "💀", "👍").forEach { e ->
                Text(e, fontSize = 15.sp)
            }
            Box(
                modifier = Modifier
                    .size(22.dp)
                    .background(SSurface, CircleShape)
                    .border(0.8.dp, SSec.copy(0.35f), CircleShape),
                contentAlignment = Alignment.Center
            ) {
                Icon(Icons.Default.Add, null, tint = SSec, modifier = Modifier.size(13.dp))
            }
        }
    }
}

// ── Post detail bottom sheet (used from SearchScreen & ProfileScreen) ─
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PostDetailSheet(
    post: PostData,
    onDismiss: () -> Unit,
    onOpenProfile: ((String) -> Unit)? = null
) {
    val sheetState = rememberModalBottomSheetState()

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = Color(0xFF111111),
        dragHandle = {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 8.dp, bottom = 6.dp),
                contentAlignment = Alignment.Center
            ) {
                Box(modifier = Modifier.width(38.dp).height(4.dp).background(Color.White.copy(0.25f), RoundedCornerShape(2.dp)))
            }
        }
    ) {
        Column(modifier = Modifier.fillMaxWidth().navigationBarsPadding()) {
            // Header
            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Box(
                    modifier = Modifier.size(36.dp).clip(CircleShape).background(SAccent.copy(0.18f)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(Icons.Default.Person, null, tint = SSec, modifier = Modifier.size(22.dp))
                }
                Spacer(Modifier.width(10.dp))
                Text(
                    "@${post.user}",
                    color = SAccent,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier
                        .weight(1f)
                        .then(if (onOpenProfile != null) Modifier.clickable { onOpenProfile(post.user) } else Modifier)
                )
                IconButton(onClick = onDismiss) {
                    Icon(Icons.Default.Close, null, tint = SSec)
                }
            }

            // Full media
            if (!post.image.isNullOrBlank()) {
                var ratio by remember { mutableFloatStateOf(1f) }
                val painter = rememberAsyncImagePainter(
                    model = ImageRequest.Builder(LocalContext.current).data(post.image).crossfade(true).build()
                )
                val state = painter.state
                LaunchedEffect(state) {
                    if (state is AsyncImagePainter.State.Success) {
                        val sz = state.painter.intrinsicSize
                        if (sz.width > 0 && sz.height > 0) ratio = sz.width / sz.height
                    }
                }
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .aspectRatio(ratio.coerceIn(0.33f, 2.5f))
                ) {
                    Image(
                        painter = painter,
                        contentDescription = null,
                        contentScale = ContentScale.Crop,
                        modifier = Modifier.fillMaxSize()
                    )
                    if (post.isVideo) {
                        Box(
                            modifier = Modifier.fillMaxSize().background(Color.Black.copy(0.25f)),
                            contentAlignment = Alignment.Center
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(56.dp)
                                    .background(Color.Black.copy(0.55f), CircleShape)
                                    .border(2.dp, Color.White.copy(0.5f), CircleShape),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(Icons.Default.PlayArrow, null, tint = Color.White, modifier = Modifier.size(34.dp))
                            }
                        }
                    }
                }
            }

            // Caption
            if (post.caption.isNotBlank()) {
                Text(
                    text = post.caption,
                    color = SFg,
                    fontSize = 14.sp,
                    lineHeight = 21.sp,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp)
                )
            }

            // Action row
            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(18.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                ActionCount(Icons.Default.FavoriteBorder, post.likes)
                ActionCount(Icons.Outlined.ChatBubbleOutline, post.comments)
                Spacer(Modifier.weight(1f))
                Text("😍  💀  👍", fontSize = 18.sp)
            }

            Spacer(Modifier.height(8.dp))
        }
    }
}

@Composable
private fun PostDetailSheet(
    mediaUrl: String?,
    authorUsername: String,
    caption: String,
    isVideo: Boolean,
    likes: Int = 0,
    comments: Int = 0,
    onDismiss: () -> Unit,
    onOpenProfile: ((String) -> Unit)? = null
) {
    PostDetailSheet(
        post = PostData(
            id = authorUsername,
            user = authorUsername,
            image = mediaUrl,
            caption = caption,
            likes = likes,
            comments = comments,
            isVideo = isVideo
        ),
        onDismiss = onDismiss,
        onOpenProfile = onOpenProfile
    )
}

@Composable
private fun ActionCount(icon: ImageVector, count: Int) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        Icon(icon, null, tint = SSec, modifier = Modifier.size(22.dp))
        Text(count.toString(), color = SSec, fontSize = 13.sp)
    }
}

// ── Filter panel ──────────────────────────────────────────────────────
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun FilterPanel(
    isDarkMode: Boolean,
    panelBg: Color,
    contentColor: Color,
    secondary: Color,
    accent: Color,
    selectedRegion: String?,
    selectedDistrict: String?,
    schoolInput: String,
    onRegionChange: (String?) -> Unit,
    onDistrictChange: (String?) -> Unit,
    onSchoolInputChange: (String) -> Unit,
    onApply: () -> Unit,
    onClear: () -> Unit
) {
    val districts = if (selectedRegion != null)
        UzbekistanData.districtsByRegion[selectedRegion] ?: emptyList()
    else emptyList()

    val fieldColors = OutlinedTextFieldDefaults.colors(
        focusedContainerColor = contentColor.copy(0.05f),
        unfocusedContainerColor = contentColor.copy(0.04f),
        focusedBorderColor = accent,
        unfocusedBorderColor = contentColor.copy(0.12f),
        focusedLabelColor = accent,
        unfocusedLabelColor = secondary,
        disabledContainerColor = contentColor.copy(0.02f),
        disabledBorderColor = contentColor.copy(0.06f),
        disabledLabelColor = secondary.copy(0.4f),
        disabledTextColor = contentColor.copy(0.3f),
        disabledTrailingIconColor = secondary.copy(0.3f)
    )

    Surface(modifier = Modifier.fillMaxWidth(), color = panelBg, tonalElevation = 1.dp) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 14.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text("Filtr", color = contentColor, fontWeight = FontWeight.Bold, fontSize = 15.sp)

            CascadeDropdown(
                label = "Viloyat",
                placeholder = "Viloyatni tanlang",
                selected = selectedRegion,
                options = UzbekistanData.regions,
                enabled = true,
                accent = accent,
                colors = fieldColors,
                contentColor = contentColor,
                secondary = secondary,
                onSelect = onRegionChange
            )

            CascadeDropdown(
                label = "Tuman / Shahar",
                placeholder = if (selectedRegion == null) "Avval viloyatni tanlang" else "Tumanni tanlang",
                selected = selectedDistrict,
                options = districts,
                enabled = selectedRegion != null,
                accent = accent,
                colors = fieldColors,
                contentColor = contentColor,
                secondary = secondary,
                onSelect = onDistrictChange
            )

            OutlinedTextField(
                value = schoolInput,
                onValueChange = onSchoolInputChange,
                label = { Text("Maktab") },
                placeholder = {
                    Text(
                        if (selectedDistrict == null) "Avval tumanni tanlang" else "Maktab nomini kiriting",
                        color = secondary.copy(0.6f),
                        fontSize = 13.sp
                    )
                },
                enabled = selectedDistrict != null,
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                colors = fieldColors,
                singleLine = true,
                trailingIcon = if (schoolInput.isNotBlank()) ({
                    IconButton(onClick = { onSchoolInputChange("") }, modifier = Modifier.size(18.dp)) {
                        Icon(Icons.Default.Clear, null, tint = secondary)
                    }
                }) else null
            )

            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(onClick = onClear, modifier = Modifier.weight(1f), shape = RoundedCornerShape(12.dp)) {
                    Text("Tozalash", color = Color(0xFFE53935))
                }
                Button(
                    onClick = onApply,
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = accent)
                ) {
                    Text("Qo'llash", color = Color.White, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

// ── Cascade dropdown ──────────────────────────────────────────────────
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun CascadeDropdown(
    label: String,
    placeholder: String,
    selected: String?,
    options: List<String>,
    enabled: Boolean,
    accent: Color,
    colors: TextFieldColors,
    contentColor: Color,
    secondary: Color,
    onSelect: (String?) -> Unit
) {
    var expanded by remember { mutableStateOf(false) }

    ExposedDropdownMenuBox(expanded = expanded && enabled, onExpandedChange = { if (enabled) expanded = it }) {
        OutlinedTextField(
            value = selected ?: "",
            onValueChange = {},
            readOnly = true,
            label = { Text(label) },
            placeholder = { Text(placeholder, color = secondary.copy(0.6f), fontSize = 13.sp) },
            trailingIcon = {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    if (selected != null) {
                        IconButton(onClick = { onSelect(null); expanded = false }, modifier = Modifier.size(18.dp)) {
                            Icon(Icons.Default.Clear, null, tint = secondary, modifier = Modifier.size(14.dp))
                        }
                        Spacer(Modifier.width(4.dp))
                    }
                    ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded && enabled)
                }
            },
            enabled = enabled,
            modifier = Modifier.fillMaxWidth().menuAnchor(MenuAnchorType.PrimaryNotEditable),
            shape = RoundedCornerShape(12.dp),
            colors = colors,
            singleLine = true
        )
        ExposedDropdownMenu(
            expanded = expanded && enabled,
            onDismissRequest = { expanded = false },
            modifier = Modifier.heightIn(max = 280.dp)
        ) {
            options.forEach { option ->
                DropdownMenuItem(
                    text = {
                        Text(
                            text = option,
                            color = if (option == selected) accent else contentColor,
                            fontWeight = if (option == selected) FontWeight.SemiBold else FontWeight.Normal,
                            fontSize = 14.sp
                        )
                    },
                    onClick = { onSelect(option); expanded = false }
                )
            }
        }
    }
}

// ── Filter chip ───────────────────────────────────────────────────────
@Composable
private fun FilterChip(label: String, accent: Color, contentColor: Color) {
    Surface(
        shape = RoundedCornerShape(20.dp),
        color = accent.copy(alpha = 0.12f),
        border = BorderStroke(0.5.dp, accent.copy(0.3f))
    ) {
        Text(
            text = label,
            color = accent,
            fontSize = 11.sp,
            fontWeight = FontWeight.Medium,
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
        )
    }
}

// ── User search result card ───────────────────────────────────────────
@Composable
private fun UserCard(
    user: SearchUserItem,
    isDarkMode: Boolean,
    cardBg: Color,
    contentColor: Color,
    secondary: Color,
    accent: Color,
    isBusy: Boolean,
    onOpenProfile: (String) -> Unit,
    onFollow: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = cardBg)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier.size(46.dp).background(contentColor.copy(alpha = 0.08f), CircleShape),
                contentAlignment = Alignment.Center
            ) {
                Icon(Icons.Default.Person, null, tint = secondary.copy(0.5f), modifier = Modifier.size(26.dp))
            }
            Spacer(Modifier.width(12.dp))
            Column(
                modifier = Modifier
                    .weight(1f)
                    .clickable { if (user.username.isNotBlank()) onOpenProfile(user.username) }
            ) {
                Text(
                    user.fullName.ifBlank { "Noma'lum foydalanuvchi" },
                    color = contentColor,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 14.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Text("@${user.username}", color = accent, fontSize = 12.sp, maxLines = 1)
                val parts = listOfNotNull(
                    user.school.takeIf { it.isNotBlank() },
                    user.district.takeIf { it.isNotBlank() },
                    user.region.takeIf { it.isNotBlank() }
                )
                if (parts.isNotEmpty()) {
                    Text(parts.joinToString(" · "), color = secondary.copy(0.7f), fontSize = 11.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                } else if (user.bio.isNotBlank()) {
                    Text(user.bio, color = secondary, fontSize = 12.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
            }
            Spacer(Modifier.width(8.dp))
            val isFollowing = user.followStatus == "following"
            Button(
                onClick = onFollow,
                enabled = !isBusy,
                shape = RoundedCornerShape(10.dp),
                contentPadding = PaddingValues(horizontal = 14.dp, vertical = 0.dp),
                modifier = Modifier.height(34.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = if (isFollowing) contentColor.copy(alpha = 0.12f) else accent
                )
            ) {
                if (isBusy) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(14.dp),
                        strokeWidth = 1.5.dp,
                        color = if (isFollowing) contentColor else Color.White
                    )
                } else {
                    Text(
                        if (isFollowing) "Kuzatilmoqda" else "Kuzatish",
                        color = if (isFollowing) contentColor else Color.White,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Medium
                    )
                }
            }
        }
    }
}

private fun formatDiscoveryCount(count: Int): String = when {
    count >= 1_000_000 -> "${count / 1_000_000}M"
    count >= 1_000 -> "${count / 1_000}k"
    else -> count.toString()
}

private fun postToReel(post: PostData): ReelItem = ReelItem(
    id = post.id,
    authorUsername = post.user,
    authorAvatar = "",
    mediaUrl = post.image,
    caption = post.caption,
    likes = post.likes,
    comments = post.comments,
    isVideo = post.isVideo
)
