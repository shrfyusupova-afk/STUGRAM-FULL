package com.example.myapplication.ui.home

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.expandVertically
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Clear
import androidx.compose.material.icons.filled.FavoriteBorder
import androidx.compose.material.icons.filled.FilterList
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.outlined.ChatBubbleOutline
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import coil.compose.AsyncImage

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

    val bgColor = if (isDarkMode) GlobalBackgroundColor else Color.White
    val contentColor = if (isDarkMode) Color.White else Color.Black
    val secondary = contentColor.copy(alpha = 0.55f)
    val accent = Color(0xFF00A3FF)
    val cardBg = if (isDarkMode) Color(0xFF1A1A1A) else Color(0xFFF5F5F5)
    val filterPanelBg = if (isDarkMode) Color(0xFF161616) else Color(0xFFF0F4F8)
    val inputBg = contentColor.copy(alpha = 0.05f)

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(bgColor)
            .statusBarsPadding()
    ) {
        // ── Search bar + filter button ──────────────────────────────
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
                placeholder = { Text("Qidirish...", color = secondary) },
                leadingIcon = { Icon(Icons.Default.Search, null, tint = secondary, modifier = Modifier.size(18.dp)) },
                trailingIcon = {
                    if (ui.query.isNotEmpty()) {
                        IconButton(onClick = { vm.onQueryChange("") }, modifier = Modifier.size(18.dp)) {
                            Icon(Icons.Default.Clear, null, tint = secondary)
                        }
                    }
                },
                modifier = Modifier
                    .weight(1f)
                    .height(52.dp),
                shape = RoundedCornerShape(14.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedContainerColor = inputBg,
                    unfocusedContainerColor = inputBg,
                    focusedBorderColor = accent,
                    unfocusedBorderColor = Color.Transparent
                ),
                singleLine = true
            )

            // Filter icon — dot badge when active
            Box {
                IconButton(
                    onClick = { vm.toggleFilterPanel() },
                    modifier = Modifier
                        .size(52.dp)
                        .clip(RoundedCornerShape(14.dp))
                        .background(if (ui.showFilterPanel) accent else inputBg)
                ) {
                    Icon(
                        Icons.Default.FilterList,
                        contentDescription = "Filter",
                        tint = if (ui.showFilterPanel) Color.White
                        else if (ui.isFilterActive) accent
                        else secondary,
                        modifier = Modifier.size(22.dp)
                    )
                }
                if (ui.isFilterActive && !ui.showFilterPanel) {
                    Box(
                        modifier = Modifier
                            .size(9.dp)
                            .align(Alignment.TopEnd)
                            .background(accent, CircleShape)
                    )
                }
            }
        }

        // ── Filter panel ────────────────────────────────────────────
        AnimatedVisibility(
            visible = ui.showFilterPanel,
            enter = expandVertically(),
            exit = shrinkVertically()
        ) {
            FilterPanel(
                isDarkMode = isDarkMode,
                panelBg = filterPanelBg,
                contentColor = contentColor,
                secondary = secondary,
                accent = accent,
                selectedRegion = ui.selectedRegion,
                selectedDistrict = ui.selectedDistrict,
                schoolInput = ui.schoolInput,
                onRegionChange = vm::onRegionChange,
                onDistrictChange = vm::onDistrictChange,
                onSchoolInputChange = vm::onSchoolInputChange,
                onApply = vm::applyFilter,
                onClear = {
                    vm.clearFilter()
                    vm.toggleFilterPanel()
                }
            )
        }

        // ── Active filter chips ──────────────────────────────────────
        if (ui.isFilterActive) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(start = 16.dp, end = 16.dp, bottom = 6.dp),
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                if (ui.selectedRegion != null) {
                    FilterChip(
                        label = ui.selectedRegion,
                        accent = accent,
                        contentColor = contentColor
                    )
                }
                if (ui.selectedDistrict != null) {
                    FilterChip(
                        label = ui.selectedDistrict,
                        accent = accent,
                        contentColor = contentColor
                    )
                }
                if (ui.schoolInput.isNotBlank()) {
                    FilterChip(
                        label = ui.schoolInput,
                        accent = accent,
                        contentColor = contentColor
                    )
                }
                TextButton(
                    onClick = { vm.clearFilter() },
                    contentPadding = PaddingValues(horizontal = 8.dp, vertical = 0.dp),
                    modifier = Modifier.height(28.dp)
                ) {
                    Text("Tozalash", color = Color(0xFFE53935), fontSize = 12.sp)
                }
            }
        }

        // ── Results ──────────────────────────────────────────────────
        when {
            ui.isLoading -> Box(Modifier.fillMaxSize(), Alignment.Center) {
                CircularProgressIndicator(color = accent)
            }
            ui.error != null -> Box(Modifier.fillMaxSize(), Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(ui.error, color = contentColor, fontSize = 13.sp)
                    Spacer(Modifier.height(8.dp))
                    TextButton(onClick = { vm.search() }) { Text("Qayta urinish", color = accent) }
                }
            }
            !ui.isFilterActive && ui.query.trim().length < 2 -> DiscoverySection(
                discoveryCreators = ui.discoveryCreators,
                trendingPosts = ui.trendingPosts,
                isLoading = ui.isLoadingDiscovery,
                isDarkMode = isDarkMode,
                contentColor = contentColor,
                secondary = secondary,
                accent = accent,
                cardBg = cardBg,
                onOpenProfile = onOpenProfile
            )
            ui.users.isEmpty() -> Box(Modifier.fillMaxSize(), Alignment.Center) {
                Text("Natija topilmadi", color = secondary, fontSize = 14.sp)
            }
            else -> {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(horizontal = 16.dp, vertical = 4.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    items(ui.users, key = { it.id }) { user ->
                        UserCard(
                            user = user,
                            isDarkMode = isDarkMode,
                            cardBg = cardBg,
                            contentColor = contentColor,
                            secondary = secondary,
                            accent = accent,
                            isBusy = ui.followActionUserId == user.id,
                            onOpenProfile = onOpenProfile,
                            onFollow = { vm.followOrUnfollow(user) }
                        )
                    }
                }
            }
        }
    }
}

// ── Filter panel composable ──────────────────────────────────────────
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

    Surface(
        modifier = Modifier.fillMaxWidth(),
        color = panelBg,
        tonalElevation = 1.dp
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 14.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(
                text = "Filtr",
                color = contentColor,
                fontWeight = FontWeight.Bold,
                fontSize = 15.sp
            )

            // Region dropdown
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

            // District dropdown — only after region
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

            // School text input — only after district
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

            // Buttons
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                OutlinedButton(
                    onClick = onClear,
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(12.dp)
                ) {
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

// ── Cascading dropdown ───────────────────────────────────────────────
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

    ExposedDropdownMenuBox(
        expanded = expanded && enabled,
        onExpandedChange = { if (enabled) expanded = it }
    ) {
        OutlinedTextField(
            value = selected ?: "",
            onValueChange = {},
            readOnly = true,
            label = { Text(label) },
            placeholder = { Text(placeholder, color = secondary.copy(0.6f), fontSize = 13.sp) },
            trailingIcon = {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    if (selected != null) {
                        IconButton(
                            onClick = { onSelect(null); expanded = false },
                            modifier = Modifier.size(18.dp)
                        ) {
                            Icon(Icons.Default.Clear, null, tint = secondary, modifier = Modifier.size(14.dp))
                        }
                        Spacer(Modifier.width(4.dp))
                    }
                    ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded && enabled)
                }
            },
            enabled = enabled,
            modifier = Modifier
                .fillMaxWidth()
                .menuAnchor(),
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
                    onClick = {
                        onSelect(option)
                        expanded = false
                    }
                )
            }
        }
    }
}

// ── Filter chip ──────────────────────────────────────────────────────
@Composable
private fun FilterChip(label: String, accent: Color, contentColor: Color) {
    Surface(
        shape = RoundedCornerShape(20.dp),
        color = accent.copy(alpha = 0.12f),
        border = androidx.compose.foundation.BorderStroke(0.5.dp, accent.copy(0.3f))
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

// ── Discovery section (empty-query state) ────────────────────────────
@Composable
private fun DiscoverySection(
    discoveryCreators: List<RecommendedProfile>,
    trendingPosts: List<PostData>,
    isLoading: Boolean,
    isDarkMode: Boolean,
    contentColor: Color,
    secondary: Color,
    accent: Color,
    cardBg: Color,
    onOpenProfile: (String) -> Unit
) {
    if (isLoading) {
        Box(Modifier.fillMaxSize(), Alignment.Center) {
            CircularProgressIndicator(color = accent, modifier = Modifier.size(32.dp))
        }
        return
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(bottom = 80.dp)
    ) {
        if (discoveryCreators.isNotEmpty()) {
            item {
                Text(
                    "Tavsiya etilgan kreatorlar",
                    color = contentColor,
                    fontWeight = FontWeight.Bold,
                    fontSize = 16.sp,
                    modifier = Modifier.padding(start = 16.dp, top = 12.dp, bottom = 8.dp)
                )
            }
            item {
                LazyRow(
                    contentPadding = PaddingValues(horizontal = 16.dp),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    items(discoveryCreators, key = { it.id }) { creator ->
                        DiscoveryCreatorCard(
                            creator = creator,
                            contentColor = contentColor,
                            accent = accent,
                            cardBg = cardBg,
                            onOpenProfile = onOpenProfile
                        )
                    }
                }
            }
        }

        if (trendingPosts.isNotEmpty()) {
            item {
                Text(
                    "Trending postlar",
                    color = contentColor,
                    fontWeight = FontWeight.Bold,
                    fontSize = 16.sp,
                    modifier = Modifier.padding(start = 16.dp, top = 16.dp, bottom = 8.dp)
                )
            }
            items(trendingPosts, key = { it.id }) { post ->
                TrendingPostCard(
                    post = post,
                    contentColor = contentColor,
                    secondary = secondary,
                    cardBg = cardBg,
                    onOpenProfile = onOpenProfile
                )
            }
        }

        if (discoveryCreators.isEmpty() && trendingPosts.isEmpty()) {
            item {
                Box(
                    modifier = Modifier
                        .fillParentMaxSize()
                        .padding(horizontal = 24.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(Icons.Default.Search, null, tint = secondary.copy(0.4f), modifier = Modifier.size(56.dp))
                        Spacer(Modifier.height(12.dp))
                        Text("Foydalanuvchi yoki maktabni qidiring", color = secondary, fontSize = 14.sp)
                        Spacer(Modifier.height(4.dp))
                        Text("yoki viloyat bo'yicha filtrlang", color = secondary.copy(0.6f), fontSize = 12.sp)
                    }
                }
            }
        }
    }
}

@Composable
private fun DiscoveryCreatorCard(
    creator: RecommendedProfile,
    contentColor: Color,
    accent: Color,
    cardBg: Color,
    onOpenProfile: (String) -> Unit
) {
    var isFollowed by remember(creator.id) { mutableStateOf(creator.followStatus == "following") }
    Card(
        modifier = Modifier.width(130.dp),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = cardBg)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clickable { if (creator.username.isNotBlank()) onOpenProfile(creator.username) }
                .padding(12.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Box(
                modifier = Modifier
                    .size(56.dp)
                    .clip(CircleShape)
                    .background(contentColor.copy(0.1f)),
                contentAlignment = Alignment.Center
            ) {
                if (creator.avatar.isNotBlank()) {
                    AsyncImage(
                        model = creator.avatar,
                        contentDescription = null,
                        modifier = Modifier
                            .fillMaxSize()
                            .clip(CircleShape),
                        contentScale = ContentScale.Crop
                    )
                } else {
                    Icon(Icons.Default.Person, null, tint = contentColor.copy(0.4f), modifier = Modifier.size(32.dp))
                }
            }
            Spacer(Modifier.height(6.dp))
            Text(
                creator.name.ifBlank { creator.username },
                color = contentColor,
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            Text("@${creator.username}", color = accent, fontSize = 11.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
            if (creator.followersCount > 0) {
                Text(
                    "${formatDiscoveryCount(creator.followersCount)} kuzatuvchi",
                    color = contentColor.copy(0.5f),
                    fontSize = 10.sp
                )
            }
            Spacer(Modifier.height(8.dp))
            Button(
                onClick = { isFollowed = !isFollowed },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(30.dp),
                shape = RoundedCornerShape(8.dp),
                contentPadding = PaddingValues(0.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = if (isFollowed) contentColor.copy(0.1f) else accent
                )
            ) {
                Text(
                    if (isFollowed) "Kuzatilmoqda" else "Kuzatish",
                    fontSize = 11.sp,
                    color = if (isFollowed) contentColor else Color.White
                )
            }
        }
    }
}

@Composable
private fun TrendingPostCard(
    post: PostData,
    contentColor: Color,
    secondary: Color,
    cardBg: Color,
    onOpenProfile: (String) -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 4.dp),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = cardBg)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(10.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(60.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .background(contentColor.copy(0.1f))
            ) {
                if (!post.image.isNullOrBlank()) {
                    AsyncImage(
                        model = post.image,
                        contentDescription = null,
                        modifier = Modifier.fillMaxSize(),
                        contentScale = ContentScale.Crop
                    )
                }
            }
            Spacer(Modifier.width(10.dp))
            Column(
                modifier = Modifier
                    .weight(1f)
                    .clickable { onOpenProfile(post.user) }
            ) {
                Text("@${post.user}", color = Color(0xFF00A3FF), fontSize = 12.sp, fontWeight = FontWeight.Medium)
                if (post.caption.isNotBlank()) {
                    Text(
                        post.caption,
                        color = contentColor,
                        fontSize = 13.sp,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis
                    )
                }
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.padding(top = 4.dp)
                ) {
                    Icon(Icons.Default.FavoriteBorder, null, tint = secondary, modifier = Modifier.size(13.dp))
                    Spacer(Modifier.width(3.dp))
                    Text("${post.likes}", color = secondary, fontSize = 11.sp)
                    Spacer(Modifier.width(8.dp))
                    Icon(Icons.Outlined.ChatBubbleOutline, null, tint = secondary, modifier = Modifier.size(13.dp))
                    Spacer(Modifier.width(3.dp))
                    Text("${post.comments}", color = secondary, fontSize = 11.sp)
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

// ── User card ────────────────────────────────────────────────────────
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
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(46.dp)
                    .background(contentColor.copy(alpha = 0.08f), CircleShape),
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
                Text(
                    "@${user.username}",
                    color = accent,
                    fontSize = 12.sp,
                    maxLines = 1
                )
                // Location info
                val locationParts = listOfNotNull(
                    user.school.takeIf { it.isNotBlank() },
                    user.district.takeIf { it.isNotBlank() },
                    user.region.takeIf { it.isNotBlank() }
                )
                if (locationParts.isNotEmpty()) {
                    Text(
                        text = locationParts.joinToString(" · "),
                        color = secondary.copy(0.7f),
                        fontSize = 11.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                } else if (user.bio.isNotBlank()) {
                    Text(
                        user.bio,
                        color = secondary,
                        fontSize = 12.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
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
