package com.example.myapplication.ui.home

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.grid.*
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import coil.compose.AsyncImage
import coil.request.ImageRequest
import kotlinx.coroutines.launch
import kotlin.math.roundToInt

private val ProfileBg       = Color(0xFF0F0F0F)
private val ProfileSurface  = Color(0xFF1A1A1A)
private val ProfileFg       = Color.White
private val ProfileAccent   = Color(0xFF2979FF)
private val ProfileSecondary = Color(0xFFAAAAAA)
private val ProfileIconBg   = Color(0xFF0A2952)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProfileScreen(
    isDarkMode: Boolean,
    isRefreshing: Boolean,
    onRefresh: () -> Unit,
    isMyProfile: Boolean = true,
    targetUsername: String? = null,
    onBack: (() -> Unit)? = null,
    onOpenFollowList: (String, String) -> Unit = { _, _ -> }
) {
    val vm: ProfileViewModel = viewModel()
    val ui by vm.uiState.collectAsState()
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
            initialBirthday = ui.birthday ?: "",
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

    val pagerState = rememberPagerState(pageCount = { 4 })
    val scope = rememberCoroutineScope()

    PullToRefreshBox(
        isRefreshing = isRefreshing || ui.isLoading,
        onRefresh = { vm.refresh(); onRefresh() },
        modifier = Modifier.fillMaxSize()
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .background(ProfileBg)
        ) {
            when {
                ui.error != null -> {
                    Box(Modifier.fillMaxSize().statusBarsPadding(), contentAlignment = Alignment.Center) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text(
                                text = ui.error!!,
                                color = ProfileSecondary,
                                textAlign = TextAlign.Center,
                                modifier = Modifier.padding(horizontal = 32.dp)
                            )
                            Spacer(Modifier.height(12.dp))
                            TextButton(onClick = vm::refresh) {
                                Text("Qayta urinish", color = ProfileAccent)
                            }
                        }
                    }
                }

                else -> {
                    // ── Banner + Avatar + Name/Stats — edge-to-edge, behind status bar
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(250.dp)
                    ) {
                        // Banner image or gradient fallback (fills entire box, including under status bar)
                        if (!ui.banner.isNullOrBlank()) {
                            AsyncImage(
                                model = ImageRequest.Builder(LocalContext.current)
                                    .data(ui.banner)
                                    .crossfade(true)
                                    .build(),
                                contentDescription = null,
                                contentScale = ContentScale.Crop,
                                modifier = Modifier.fillMaxSize()
                            )
                        } else {
                            Box(
                                modifier = Modifier
                                    .fillMaxSize()
                                    .background(
                                        Brush.linearGradient(
                                            listOf(Color(0xFF0D2B5E), Color(0xFF091830))
                                        )
                                    )
                            )
                        }

                        // Top scrim so status bar icons remain readable on bright banners
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(80.dp)
                                .align(Alignment.TopStart)
                                .background(
                                    Brush.verticalGradient(
                                        listOf(Color.Black.copy(0.45f), Color.Transparent)
                                    )
                                )
                        )

                        // Bottom scrim so the avatar + text are readable against the photo
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(120.dp)
                                .align(Alignment.BottomStart)
                                .background(
                                    Brush.verticalGradient(
                                        listOf(Color.Transparent, ProfileBg)
                                    )
                                )
                        )

                        // Floating back button (only when navigated to)
                        if (onBack != null) {
                            Box(
                                modifier = Modifier
                                    .statusBarsPadding()
                                    .padding(start = 12.dp, top = 6.dp)
                                    .size(40.dp)
                                    .clip(CircleShape)
                                    .background(Color.Black.copy(0.45f))
                                    .clickable(onClick = onBack),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    Icons.AutoMirrored.Filled.ArrowBack,
                                    contentDescription = null,
                                    tint = ProfileFg,
                                    modifier = Modifier.size(22.dp)
                                )
                            }
                        }

                        // Avatar + Name/Stats row — anchored at banner bottom
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .align(Alignment.BottomStart)
                                .padding(start = 16.dp, end = 16.dp, bottom = 14.dp),
                            verticalAlignment = Alignment.Bottom,
                            horizontalArrangement = Arrangement.spacedBy(14.dp)
                        ) {
                            // Circular avatar with blue ring
                            Box(
                                contentAlignment = Alignment.Center,
                                modifier = Modifier.size(94.dp)
                            ) {
                                // Ring
                                Box(
                                    modifier = Modifier
                                        .size(94.dp)
                                        .clip(CircleShape)
                                        .background(ProfileAccent.copy(0.25f))
                                        .border(2.5.dp, ProfileAccent, CircleShape)
                                )
                                // Avatar
                                if (!ui.avatar.isNullOrBlank()) {
                                    AsyncImage(
                                        model = ImageRequest.Builder(LocalContext.current)
                                            .data(ui.avatar)
                                            .crossfade(true)
                                            .build(),
                                        contentDescription = null,
                                        contentScale = ContentScale.Crop,
                                        modifier = Modifier
                                            .size(89.dp)
                                            .clip(CircleShape)
                                    )
                                } else {
                                    Box(
                                        modifier = Modifier
                                            .size(89.dp)
                                            .clip(CircleShape)
                                            .background(Color(0xFF1E1E1E)),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Icon(
                                            Icons.Default.Person,
                                            contentDescription = null,
                                            tint = ProfileSecondary,
                                            modifier = Modifier.size(44.dp)
                                        )
                                    }
                                }
                            }

                            // Name + username + stats
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = ui.fullName.ifBlank { "Ism yo'q" },
                                    color = ProfileFg,
                                    fontSize = 19.sp,
                                    fontWeight = FontWeight.ExtraBold,
                                    lineHeight = 22.sp,
                                    maxLines = 2
                                )
                                Text(
                                    text = "@${ui.username.ifBlank { "username" }}",
                                    color = ProfileAccent,
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.Medium
                                )
                                Spacer(Modifier.height(10.dp))
                                Row(horizontalArrangement = Arrangement.spacedBy(18.dp)) {
                                    ProfileStat(ui.postsCount.fmt(), "Posts")
                                    ProfileStat(
                                        ui.followersCount.fmt(),
                                        "Followers",
                                        onClick = {
                                            if (ui.username.isNotBlank()) onOpenFollowList(ui.username, "followers")
                                        }
                                    )
                                    ProfileStat(
                                        ui.followingCount.fmt(),
                                        "Following",
                                        onClick = {
                                            if (ui.username.isNotBlank()) onOpenFollowList(ui.username, "following")
                                        }
                                    )
                                }
                            }
                        }
                    }

                    // ── School / Institution info ────────────────────────────
                    val regionLine = listOf(ui.region, ui.district)
                        .filter { it.isNotBlank() }.joinToString(", ")
                    val groupLine = listOf(ui.grade, ui.group)
                        .filter { it.isNotBlank() }.joinToString("-")
                        .let { if (it.isNotBlank()) "Group: $it" else "" }

                    val hasSchoolInfo = regionLine.isNotBlank()
                        || ui.school.isNotBlank()
                        || groupLine.isNotBlank()

                    if (hasSchoolInfo) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 16.dp, vertical = 6.dp),
                            verticalAlignment = Alignment.Top
                        ) {
                            Icon(
                                Icons.Default.School,
                                contentDescription = null,
                                tint = ProfileAccent,
                                modifier = Modifier
                                    .size(16.dp)
                                    .padding(top = 2.dp)
                            )
                            Spacer(Modifier.width(6.dp))
                            Column {
                                if (regionLine.isNotBlank()) {
                                    Text(
                                        regionLine.uppercase(),
                                        color = ProfileFg,
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.Bold,
                                        lineHeight = 17.sp
                                    )
                                }
                                if (ui.school.isNotBlank()) {
                                    Text(
                                        ui.school.uppercase(),
                                        color = ProfileFg,
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.Bold,
                                        lineHeight = 17.sp
                                    )
                                } else if (!resolvedIsMyProfile) {
                                    Text(
                                        "Yashirilgan",
                                        color = ProfileSecondary,
                                        fontSize = 12.sp,
                                        lineHeight = 17.sp
                                    )
                                }
                                if (groupLine.isNotBlank()) {
                                    Text(
                                        groupLine,
                                        color = ProfileFg,
                                        fontSize = 12.sp,
                                        lineHeight = 17.sp
                                    )
                                }
                            }
                        }
                    }

                    // ── Bio ──────────────────────────────────────────────────
                    if (ui.bio.isNotBlank()) {
                        Text(
                            text = ui.bio,
                            color = ProfileSecondary,
                            fontSize = 13.sp,
                            lineHeight = 19.sp,
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 16.dp, vertical = 4.dp)
                        )
                    }

                    Spacer(Modifier.height(12.dp))

                    // ── Action buttons ───────────────────────────────────────
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        if (resolvedIsMyProfile) {
                            ProfileActionButton(
                                text = "Edit Profile",
                                onClick = { isEditMode = true },
                                modifier = Modifier.weight(1f),
                                filled = false
                            )
                            ProfileActionButton(
                                text = "Share",
                                onClick = { },
                                modifier = Modifier.weight(1f),
                                filled = false
                            )
                        } else {
                            val following = ui.followStatus == "following"
                            ProfileActionButton(
                                text = if (following) "Following" else "Follow",
                                onClick = { vm.followOrUnfollow() },
                                modifier = Modifier.weight(1f),
                                filled = !following,
                                enabled = !ui.isSaving
                            )
                            ProfileActionButton(
                                text = "Message",
                                onClick = { },
                                modifier = Modifier.weight(1f),
                                filled = false
                            )
                        }
                    }

                    Spacer(Modifier.height(18.dp))

                    // ── Tab row with sliding gradient indicator ──────────────
                    val tabs = listOf(
                        Icons.Default.GridOn       to "Posts",
                        Icons.Default.PlayCircle   to "Reels",
                        Icons.Default.PersonPin    to "Tagged",
                        Icons.Default.Info         to "Info"
                    )
                    ProfileTabSwitcher(
                        tabs = tabs,
                        pagerState = pagerState,
                        onTabClick = { index ->
                            scope.launch { pagerState.animateScrollToPage(index) }
                        }
                    )

                    // ── Pager content ────────────────────────────────────────
                    HorizontalPager(
                        state = pagerState,
                        modifier = Modifier
                            .fillMaxWidth()
                            .weight(1f)
                    ) { page ->
                        when (page) {
                            0 -> PostsPage(ui.posts.filter { it.type != "reel" }, authorUsername = ui.username)
                            1 -> ReelsPage(ui.posts.filter { it.type == "reel" }, authorUsername = ui.username)
                            2 -> TaggedPage()
                            3 -> InfoPage(ui)
                        }
                    }
                }
            }
        }
    }
}

// ── Tab switcher with sliding gradient indicator ──────────────────────────
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ProfileTabSwitcher(
    tabs: List<Pair<ImageVector, String>>,
    pagerState: androidx.compose.foundation.pager.PagerState,
    onTabClick: (Int) -> Unit
) {
    val density = LocalDensity.current
    // Continuous fractional position — drives the sliding indicator smoothly while swiping
    val offsetFraction = pagerState.currentPage + pagerState.currentPageOffsetFraction

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 4.dp)
    ) {
        BoxWithConstraints(
            modifier = Modifier
                .fillMaxWidth()
                .height(52.dp)
                .clip(RoundedCornerShape(16.dp))
                .background(Color.White.copy(alpha = 0.04f))
                .border(
                    width = 1.dp,
                    color = Color.White.copy(alpha = 0.08f),
                    shape = RoundedCornerShape(16.dp)
                )
        ) {
            val tabWidthDp = maxWidth / tabs.size
            val tabWidthPx = with(density) { tabWidthDp.toPx() }
            val indicatorOffsetPx = (offsetFraction * tabWidthPx)
                .coerceIn(0f, (tabs.size - 1) * tabWidthPx)

            // Sliding pill — follows pager position with gradient fill
            Box(
                modifier = Modifier
                    .offset { IntOffset(indicatorOffsetPx.roundToInt(), 0) }
                    .width(tabWidthDp)
                    .fillMaxHeight()
                    .padding(5.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .background(
                        Brush.linearGradient(
                            listOf(
                                ProfileAccent,
                                Color(0xFF5EA3FF)
                            )
                        )
                    )
            )

            // Tab icons row on top of the sliding pill
            Row(modifier = Modifier.fillMaxSize()) {
                tabs.forEachIndexed { index, (icon, label) ->
                    // Selected when the pager is closest to this tab
                    val selected = pagerState.currentPage == index
                    val tint by animateColorAsState(
                        targetValue = if (selected) Color.White else ProfileSecondary,
                        animationSpec = tween(180),
                        label = "tab_tint"
                    )
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .fillMaxHeight()
                            .clickable(
                                indication = null,
                                interactionSource = remember { androidx.compose.foundation.interaction.MutableInteractionSource() }
                            ) { onTabClick(index) },
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = icon,
                            contentDescription = label,
                            tint = tint,
                            modifier = Modifier.size(24.dp)
                        )
                    }
                }
            }
        }
    }
}

// ── Stat item ─────────────────────────────────────────────────────────────
@Composable
private fun ProfileStat(value: String, label: String, onClick: (() -> Unit)? = null) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier
    ) {
        Text(
            text = value,
            color = ProfileFg,
            fontSize = 17.sp,
            fontWeight = FontWeight.ExtraBold,
            lineHeight = 20.sp
        )
        Text(
            text = label,
            color = ProfileSecondary,
            fontSize = 11.sp
        )
    }
}

// ── Action button (Follow / Edit Profile etc.) ────────────────────────────
@Composable
private fun ProfileActionButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    filled: Boolean = true,
    enabled: Boolean = true
) {
    if (filled) {
        Button(
            onClick = onClick,
            enabled = enabled,
            modifier = modifier.height(38.dp),
            shape = RoundedCornerShape(12.dp),
            colors = ButtonDefaults.buttonColors(containerColor = ProfileAccent)
        ) {
            Text(text, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = Color.White)
        }
    } else {
        OutlinedButton(
            onClick = onClick,
            enabled = enabled,
            modifier = modifier.height(38.dp),
            shape = RoundedCornerShape(12.dp),
            border = BorderStroke(1.dp, Color.White.copy(alpha = 0.28f)),
            colors = ButtonDefaults.outlinedButtonColors(contentColor = ProfileFg)
        ) {
            Text(text, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
        }
    }
}

// ── Posts grid (3 columns, 1:1) ───────────────────────────────────────────
@Composable
private fun PostsPage(posts: List<ProfilePostItem>, authorUsername: String) {
    var selectedPost by remember { mutableStateOf<ProfilePostItem?>(null) }

    selectedPost?.let { item ->
        PostDetailSheet(
            post = PostData(
                id = item.id,
                user = authorUsername,
                image = item.mediaUrl,
                caption = item.caption,
                isVideo = item.type == "reel"
            ),
            onDismiss = { selectedPost = null }
        )
    }

    if (posts.isEmpty()) {
        EmptyTab(icon = Icons.Default.GridOn, text = "Hali postlar yo'q")
        return
    }
    LazyVerticalGrid(
        columns = GridCells.Fixed(3),
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(1.dp),
        horizontalArrangement = Arrangement.spacedBy(1.dp),
        verticalArrangement = Arrangement.spacedBy(1.dp)
    ) {
        items(posts, key = { it.id }) { post ->
            Box(
                modifier = Modifier
                    .aspectRatio(1f)
                    .background(ProfileSurface)
                    .clickable { selectedPost = post }
            ) {
                if (!post.mediaUrl.isNullOrBlank()) {
                    AsyncImage(
                        model = ImageRequest.Builder(LocalContext.current)
                            .data(post.mediaUrl)
                            .crossfade(true)
                            .build(),
                        contentDescription = null,
                        contentScale = ContentScale.Crop,
                        modifier = Modifier.fillMaxSize()
                    )
                } else {
                    Icon(
                        Icons.Default.Image,
                        contentDescription = null,
                        tint = ProfileSecondary.copy(0.3f),
                        modifier = Modifier
                            .size(28.dp)
                            .align(Alignment.Center)
                    )
                }
            }
        }
    }
}

// ── Reels grid (2 columns, 9:16) ─────────────────────────────────────────
@Composable
private fun ReelsPage(reels: List<ProfilePostItem>, authorUsername: String) {
    var selectedReel by remember { mutableStateOf<ProfilePostItem?>(null) }

    selectedReel?.let { item ->
        PostDetailSheet(
            post = PostData(
                id = item.id,
                user = authorUsername,
                image = item.mediaUrl,
                caption = item.caption,
                isVideo = true
            ),
            onDismiss = { selectedReel = null }
        )
    }

    if (reels.isEmpty()) {
        EmptyTab(icon = Icons.Default.PlayCircle, text = "Hali reels yo'q")
        return
    }
    LazyVerticalGrid(
        columns = GridCells.Fixed(2),
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(1.dp),
        horizontalArrangement = Arrangement.spacedBy(1.dp),
        verticalArrangement = Arrangement.spacedBy(1.dp)
    ) {
        items(reels, key = { it.id }) { reel ->
            Box(
                modifier = Modifier
                    .aspectRatio(9f / 16f)
                    .background(ProfileSurface)
                    .clickable { selectedReel = reel },
                contentAlignment = Alignment.Center
            ) {
                if (!reel.mediaUrl.isNullOrBlank()) {
                    AsyncImage(
                        model = ImageRequest.Builder(LocalContext.current)
                            .data(reel.mediaUrl)
                            .crossfade(true)
                            .build(),
                        contentDescription = null,
                        contentScale = ContentScale.Crop,
                        modifier = Modifier.fillMaxSize()
                    )
                }
                // Play icon overlay
                Icon(
                    Icons.Default.PlayArrow,
                    contentDescription = null,
                    tint = Color.White.copy(0.85f),
                    modifier = Modifier.size(30.dp)
                )
            }
        }
    }
}

// ── Tagged page ───────────────────────────────────────────────────────────
@Composable
private fun TaggedPage() {
    EmptyTab(icon = Icons.Default.PersonPin, text = "Hech kim tag qilmagan")
}

// ── Info page ─────────────────────────────────────────────────────────────
@Composable
private fun InfoPage(ui: AlphaProfileUiState) {
    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(ProfileBg),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        // ── Personal info section ──────────────────────────────────────
        item {
            InfoSectionTitle("Shaxsiy Ma'lumotlar")
        }

        if (ui.fullName.isNotBlank()) {
            item {
                InfoRow(Icons.Default.Person, "Full name", ui.fullName)
            }
        }
        if (ui.username.isNotBlank()) {
            item {
                InfoRow(Icons.Default.AlternateEmail, "Username", "@${ui.username}")
            }
        }
        if (!ui.birthday.isNullOrBlank()) {
            item {
                InfoRow(Icons.Default.Cake, "Birthday", ui.birthday!!)
            }
        }
        if (ui.bio.isNotBlank()) {
            item {
                InfoRow(Icons.Default.Info, "Bio", ui.bio)
            }
        }

        // ── Location & Education section ───────────────────────────────
        val hasLocationEdu = ui.location.isNotBlank()
            || ui.region.isNotBlank()
            || ui.district.isNotBlank()
            || ui.school.isNotBlank()
            || ui.grade.isNotBlank()
            || ui.group.isNotBlank()

        if (hasLocationEdu) {
            item {
                Spacer(Modifier.height(4.dp))
                InfoSectionTitle("Manzil va O'qish")
            }

            if (ui.location.isNotBlank()) {
                item { InfoRow(Icons.Default.LocationOn, "Location", ui.location) }
            }

            val regionDistrict = listOf(ui.district, ui.region)
                .filter { it.isNotBlank() }.joinToString(", ")
            if (regionDistrict.isNotBlank()) {
                item { InfoRow(Icons.Default.Map, "Viloyat / Tuman", regionDistrict) }
            }

            if (ui.school.isNotBlank()) {
                item { InfoRow(Icons.Default.School, "Maktab / OTM", ui.school) }
            }

            val gradeGroup = listOf(
                ui.grade.let { if (it.isNotBlank()) "Sinf: $it" else "" },
                ui.group.let { if (it.isNotBlank()) "Guruh: $it" else "" }
            ).filter { it.isNotBlank() }.joinToString("   ")

            if (gradeGroup.isNotBlank()) {
                item { InfoRow(Icons.Default.Groups, "Sinf / Guruh", gradeGroup) }
            }
        }

        item { Spacer(Modifier.height(24.dp)) }
    }
}

@Composable
private fun InfoSectionTitle(title: String) {
    Text(
        text = title,
        color = ProfileAccent,
        fontSize = 16.sp,
        fontWeight = FontWeight.Bold,
        modifier = Modifier.padding(bottom = 4.dp)
    )
}

@Composable
private fun InfoRow(icon: ImageVector, label: String, value: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(ProfileSurface, RoundedCornerShape(16.dp))
            .padding(horizontal = 14.dp, vertical = 13.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier
                .size(46.dp)
                .background(ProfileIconBg, RoundedCornerShape(13.dp)),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = ProfileAccent,
                modifier = Modifier.size(22.dp)
            )
        }
        Spacer(Modifier.width(14.dp))
        Column {
            Text(label, color = ProfileSecondary, fontSize = 12.sp)
            Spacer(Modifier.height(2.dp))
            Text(value, color = ProfileFg, fontSize = 15.sp, fontWeight = FontWeight.Medium)
        }
    }
}

@Composable
private fun EmptyTab(icon: ImageVector, text: String) {
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = ProfileSecondary.copy(0.4f),
                modifier = Modifier.size(52.dp)
            )
            Spacer(Modifier.height(12.dp))
            Text(text, color = ProfileSecondary, fontSize = 14.sp)
        }
    }
}

private fun Int.fmt(): String = when {
    this >= 1_000_000 -> "${this / 1_000_000}M"
    this >= 1_000 -> String.format("%.1fK", this / 1000.0).removeSuffix(".0K") + "K"
    else -> this.toString()
}
