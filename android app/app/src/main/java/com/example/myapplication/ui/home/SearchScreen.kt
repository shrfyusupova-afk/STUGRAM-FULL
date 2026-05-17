package com.example.myapplication.ui.home

import androidx.activity.compose.BackHandler
import androidx.compose.animation.*
import androidx.compose.foundation.*
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.grid.*
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.Mic
import androidx.compose.material.icons.outlined.Tune
import androidx.compose.material3.*
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.material3.pulltorefresh.PullToRefreshDefaults
import androidx.compose.material3.pulltorefresh.rememberPullToRefreshState
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.util.lerp
import coil.compose.AsyncImage
import kotlin.math.absoluteValue

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SearchScreen(
    isDarkMode: Boolean,
    isRefreshing: Boolean,
    onRefresh: () -> Unit
) {
    val backgroundColor = if (isDarkMode) GlobalBackgroundColor else Color.White
    val contentColor = if (isDarkMode) Color.White else Color.Black
    val glassBg = if (isDarkMode) Color.White.copy(0.1f) else Color.Black.copy(0.05f)
    val accentBlue = Color(0xFF00A3FF)
    
    var searchQuery by remember { mutableStateOf("") }

    // Filter states
    var showFilters by remember { mutableStateOf(false) }
    var selectedViloyat by remember { mutableStateOf<String?>(null) }
    var selectedTuman by remember { mutableStateOf<String?>(null) }
    var selectedMaktab by remember { mutableStateOf<String?>(null) }
    var selectedSinf by remember { mutableStateOf<String?>(null) }
    var selectedGuruh by remember { mutableStateOf<String?>(null) }

    // Current active filter selection type
    var activeFilterType by remember { mutableStateOf<String?>(null) }

    // Search Modal state
    var isSearchModalOpen by remember { mutableStateOf(false) }

    val viloyatlar = listOf("Toshkent sh.", "Toshkent v.", "Andijon", "Farg'ona", "Namangan", "Buxoro", "Samarqand", "Navoiy", "Qashqadaryo", "Surxondaryo", "Jizzax", "Sirdaryo", "Xorazm", "Qoraqalpog'iston")
    val tumanlar = listOf("Chilonzor", "Yunusobod", "Mirzo Ulug'bek", "Uchtepa", "Olmazor", "Yashnobod")
    val maktablar = listOf("1-maktab", "5-maktab", "110-IDUM", "Prezident maktabi", "Al-Xorazmiy")
    val sinflar = (1..11).map { "$it-sinf" }
    val guruhlar = listOf("A guruh", "B guruh", "C guruh", "D guruh")

    BackHandler(enabled = isSearchModalOpen) {
        isSearchModalOpen = false
    }

    PullToRefreshBox(
        isRefreshing = isRefreshing,
        onRefresh = onRefresh,
        modifier = Modifier.fillMaxSize(),
        indicator = {
            PullToRefreshDefaults.Indicator(
                state = rememberPullToRefreshState(),
                isRefreshing = isRefreshing,
                color = accentBlue,
                containerColor = if (isDarkMode) Color(0xFF1A1A1A) else Color.White,
                modifier = Modifier.align(Alignment.TopCenter)
            )
        }
    ) {
        Box(modifier = Modifier.fillMaxSize().background(backgroundColor)) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .statusBarsPadding()
            ) {
                // --- 1. SEARCH BAR ---
                SearchTopSection(
                    searchQuery = searchQuery,
                    onSearchQueryChange = { searchQuery = it },
                    showFilters = showFilters,
                    onFilterClick = { showFilters = !showFilters },
                    onSearchClick = { isSearchModalOpen = true },
                    isDarkMode = isDarkMode,
                    accentBlue = accentBlue,
                    glassBg = glassBg,
                    contentColor = contentColor
                )

                // --- FILTER PANEL ---
                FilterPanel(
                    visible = showFilters,
                    selectedViloyat = selectedViloyat,
                    selectedTuman = selectedTuman,
                    selectedMaktab = selectedMaktab,
                    selectedSinf = selectedSinf,
                    selectedGuruh = selectedGuruh,
                    activeFilterType = activeFilterType,
                    onFilterTypeClick = { activeFilterType = if (activeFilterType == it) null else it },
                    onOptionSelect = { type, option ->
                        when (type) {
                            "Viloyat" -> { selectedViloyat = option; selectedTuman = null; selectedMaktab = null }
                            "Tuman" -> { selectedTuman = option; selectedMaktab = null }
                            "Maktab" -> selectedMaktab = option
                            "Sinf" -> selectedSinf = option
                            "Guruh" -> selectedGuruh = option
                        }
                        activeFilterType = null
                    },
                    optionsData = mapOf(
                        "Viloyat" to viloyatlar,
                        "Tuman" to tumanlar,
                        "Maktab" to maktablar,
                        "Sinf" to sinflar,
                        "Guruh" to guruhlar
                    ),
                    glassBg = glassBg,
                    accentBlue = accentBlue
                )

                // --- 2. MAIN CONTENT ---
                LazyVerticalGrid(
                    columns = GridCells.Fixed(2),
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(bottom = 16.dp),
                    horizontalArrangement = Arrangement.spacedBy(16.dp),
                    verticalArrangement = Arrangement.spacedBy(20.dp)
                ) {
                    item(span = { GridItemSpan(2) }) {
                        Column(modifier = Modifier.padding(top = 12.dp)) {
                            Text(
                                "Creators Loops",
                                fontSize = 17.sp,
                                fontWeight = FontWeight.Bold,
                                color = contentColor,
                                modifier = Modifier.padding(start = 16.dp, bottom = 12.dp)
                            )
                            CreatorsLoopPager(isDarkMode, accentBlue)
                        }
                    }

                    item(span = { GridItemSpan(2) }) {
                        Row(
                            modifier = Modifier.padding(horizontal = 16.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text("🔥", fontSize = 18.sp)
                            Spacer(Modifier.width(4.dp))
                            Text(
                                "Trending Loops",
                                fontSize = 17.sp,
                                fontWeight = FontWeight.Bold,
                                color = contentColor
                            )
                        }
                    }

                    items(20) { index ->
                        TrendingLoopItem(
                            index = index, 
                            isDarkMode = isDarkMode, 
                            hasEmoji = true,
                            modifier = Modifier.padding(
                                start = if (index % 2 == 0) 16.dp else 0.dp,
                                end = if (index % 2 == 1) 16.dp else 0.dp
                            )
                        )
                    }
                }
            }

            // --- FULL SCREEN SEARCH MODAL ---
            AnimatedVisibility(
                visible = isSearchModalOpen,
                enter = slideInVertically(initialOffsetY = { it }) + fadeIn(),
                exit = slideOutVertically(targetOffsetY = { it }) + fadeOut()
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(backgroundColor)
                        .statusBarsPadding()
                ) {
                    Column(modifier = Modifier.fillMaxSize()) {
                        SearchTopSection(
                            searchQuery = searchQuery,
                            onSearchQueryChange = { searchQuery = it },
                            showFilters = showFilters,
                            onFilterClick = { showFilters = !showFilters },
                            onSearchClick = { isSearchModalOpen = false },
                            isDarkMode = isDarkMode,
                            accentBlue = accentBlue,
                            glassBg = glassBg,
                            contentColor = contentColor,
                            isModal = true
                        )

                        Spacer(Modifier.height(8.dp))

                        LazyVerticalGrid(
                            columns = GridCells.Fixed(2),
                            modifier = Modifier.fillMaxSize(),
                            contentPadding = PaddingValues(16.dp),
                            horizontalArrangement = Arrangement.spacedBy(12.dp),
                            verticalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            item(span = { GridItemSpan(2) }) {
                                Text(
                                    "Tavsiya etilgan profillar",
                                    color = contentColor,
                                    fontSize = 16.sp,
                                    fontWeight = FontWeight.Bold,
                                    modifier = Modifier.padding(vertical = 8.dp)
                                )
                            }

                            items(6) { index ->
                                RecommendedProfileCard(index, isDarkMode, accentBlue, glassBg)
                            }

                            item(span = { GridItemSpan(2) }) {
                                Spacer(Modifier.height(16.dp))
                                Text(
                                    "Tavsiya etilgan postlar",
                                    color = contentColor,
                                    fontSize = 16.sp,
                                    fontWeight = FontWeight.Bold,
                                    modifier = Modifier.padding(vertical = 8.dp)
                                )
                            }

                            items(20) { index ->
                                TrendingLoopItem(
                                    index = index + 50, 
                                    isDarkMode = isDarkMode, 
                                    hasEmoji = false
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
fun CreatorsLoopPager(isDarkMode: Boolean, accentBlue: Color) {
    val pagerState = rememberPagerState(pageCount = { 5 })
    
    HorizontalPager(
        state = pagerState,
        contentPadding = PaddingValues(horizontal = 40.dp),
        pageSpacing = 16.dp,
        modifier = Modifier.fillMaxWidth()
    ) { page ->
        val pageOffset = (
            (pagerState.currentPage - page) + pagerState.currentPageOffsetFraction
        ).absoluteValue

        CreatorsLoopCard(
            isDarkMode = isDarkMode,
            accentBlue = accentBlue,
            modifier = Modifier.graphicsLayer {
                val scale = lerp(
                    start = 0.85f,
                    stop = 1f,
                    fraction = 1f - pageOffset.coerceIn(0f, 1f)
                )
                scaleX = scale
                scaleY = scale
                alpha = lerp(
                    start = 0.5f,
                    stop = 1f,
                    fraction = 1f - pageOffset.coerceIn(0f, 1f)
                )
            }
        )
    }
}

@Composable
fun SearchTopSection(
    searchQuery: String,
    onSearchQueryChange: (String) -> Unit,
    showFilters: Boolean,
    onFilterClick: () -> Unit,
    onSearchClick: () -> Unit,
    isDarkMode: Boolean,
    accentBlue: Color,
    glassBg: Color,
    contentColor: Color,
    isModal: Boolean = false
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        Surface(
            modifier = Modifier
                .weight(1f)
                .height(52.dp),
            shape = RoundedCornerShape(16.dp),
            color = glassBg,
            border = BorderStroke(1.dp, Color.White.copy(0.2f))
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.padding(horizontal = 16.dp)
            ) {
                Icon(Icons.Default.Search, null, tint = Color.Gray)
                Spacer(Modifier.width(8.dp))
                Box(modifier = Modifier.weight(1f)) {
                    if (searchQuery.isEmpty()) Text("Qidiruv...", color = Color.Gray, fontSize = 15.sp)
                    BasicTextField(
                        value = searchQuery,
                        onValueChange = onSearchQueryChange,
                        modifier = Modifier.fillMaxWidth(),
                        textStyle = androidx.compose.ui.text.TextStyle(color = contentColor, fontSize = 15.sp),
                        singleLine = true,
                        cursorBrush = SolidColor(accentBlue)
                    )
                }
            }
        }

        IconButton(
            onClick = onSearchClick,
            modifier = Modifier
                .size(52.dp)
                .clip(RoundedCornerShape(16.dp))
                .background(if (isModal) accentBlue else glassBg)
                .border(1.dp, Color.White.copy(0.2f), RoundedCornerShape(16.dp))
        ) {
            Icon(
                if (isModal) Icons.Default.Close else Icons.Default.Search,
                null,
                tint = if (isModal) Color.White else contentColor
            )
        }
        
        IconButton(
            onClick = onFilterClick,
            modifier = Modifier
                .size(52.dp)
                .clip(RoundedCornerShape(16.dp))
                .background(if (showFilters) accentBlue else glassBg)
                .border(1.dp, Color.White.copy(0.2f), RoundedCornerShape(16.dp))
        ) {
            Icon(
                Icons.Outlined.Tune, 
                null, 
                tint = if (showFilters) Color.White else contentColor
            )
        }
    }
}

@Composable
fun FilterPanel(
    visible: Boolean,
    selectedViloyat: String?,
    selectedTuman: String?,
    selectedMaktab: String?,
    selectedSinf: String?,
    selectedGuruh: String?,
    activeFilterType: String?,
    onFilterTypeClick: (String) -> Unit,
    onOptionSelect: (String, String) -> Unit,
    optionsData: Map<String, List<String>>,
    glassBg: Color,
    accentBlue: Color
) {
    AnimatedVisibility(
        visible = visible,
        enter = expandVertically() + fadeIn(),
        exit = shrinkVertically() + fadeOut()
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 8.dp)
                .clip(RoundedCornerShape(20.dp))
                .background(glassBg)
                .border(1.dp, Color.White.copy(0.1f), RoundedCornerShape(20.dp))
                .padding(12.dp)
        ) {
            val filterButtons = listOf(
                "Viloyat" to selectedViloyat,
                "Tuman" to selectedTuman,
                "Maktab" to selectedMaktab,
                "Sinf" to selectedSinf,
                "Guruh" to selectedGuruh
            )

            LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                items(filterButtons) { pair ->
                    FilterActionButton(
                        label = pair.second ?: pair.first,
                        isSelected = activeFilterType == pair.first,
                        hasValue = pair.second != null,
                        onClick = { onFilterTypeClick(pair.first) }
                    )
                }
            }

            AnimatedVisibility(visible = activeFilterType != null) {
                val options = optionsData[activeFilterType] ?: emptyList()
                Column(modifier = Modifier.padding(top = 12.dp)) {
                    HorizontalDivider(color = Color.White.copy(0.1f))
                    LazyRow(
                        modifier = Modifier.padding(vertical = 8.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        items(options) { option ->
                            SuggestionChip(
                                label = option,
                                onClick = { onOptionSelect(activeFilterType!!, option) }
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun RecommendedProfileCard(index: Int, isDarkMode: Boolean, accentBlue: Color, glassBg: Color) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(180.dp)
            .clip(RoundedCornerShape(24.dp))
            .border(1.dp, Color.White.copy(0.15f), RoundedCornerShape(24.dp))
    ) {
        AsyncImage(
            model = "https://picsum.photos/seed/user$index/400/600",
            contentDescription = null,
            modifier = Modifier.fillMaxSize(),
            contentScale = ContentScale.Crop
        )

        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    Brush.verticalGradient(
                        colors = listOf(Color.Black.copy(0.1f), Color.Transparent, Color.Black.copy(0.7f))
                    )
                )
        )

        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(10.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.SpaceBetween
        ) {
            Surface(
                color = Color.White.copy(0.2f),
                shape = RoundedCornerShape(10.dp),
                border = BorderStroke(1.dp, Color.White.copy(0.3f)),
                modifier = Modifier.align(Alignment.Start)
            ) {
                Text(
                    "@User_$index",
                    color = Color.White,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }
            
            Surface(
                onClick = {},
                modifier = Modifier
                    .fillMaxWidth()
                    .height(34.dp),
                shape = RoundedCornerShape(12.dp),
                color = Color.White.copy(0.2f),
                border = BorderStroke(1.dp, Color.White.copy(0.3f))
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Text(
                        "Follow", 
                        color = accentBlue,
                        fontSize = 13.sp, 
                        fontWeight = FontWeight.Bold
                    )
                }
            }
        }
    }
}

@Composable
fun FilterActionButton(label: String, isSelected: Boolean, hasValue: Boolean, onClick: () -> Unit) {
    val accentBlue = Color(0xFF00A3FF)
    Surface(
        onClick = onClick,
        shape = RoundedCornerShape(12.dp),
        color = if (isSelected) accentBlue.copy(0.2f) else if (hasValue) accentBlue.copy(0.1f) else Color.White.copy(0.05f),
        border = BorderStroke(1.dp, if (isSelected || hasValue) accentBlue.copy(0.5f) else Color.White.copy(0.1f)),
        modifier = Modifier.height(36.dp)
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.Center
        ) {
            Text(
                text = label,
                color = if (isSelected || hasValue) accentBlue else Color.Gray,
                fontSize = 13.sp,
                fontWeight = FontWeight.Medium
            )
            Icon(
                Icons.Default.KeyboardArrowDown,
                null,
                tint = if (isSelected || hasValue) accentBlue else Color.Gray,
                modifier = Modifier.size(16.dp)
            )
        }
    }
}

@Composable
fun SuggestionChip(label: String, onClick: () -> Unit) {
    Surface(
        onClick = onClick,
        shape = RoundedCornerShape(10.dp),
        color = Color.White.copy(0.1f),
        border = BorderStroke(0.5.dp, Color.White.copy(0.2f)),
        modifier = Modifier.height(32.dp)
    ) {
        Box(modifier = Modifier.padding(horizontal = 12.dp), contentAlignment = Alignment.Center) {
            Text(label, color = Color.White, fontSize = 12.sp)
        }
    }
}

@Composable
fun CreatorsLoopCard(isDarkMode: Boolean, accentBlue: Color, modifier: Modifier = Modifier) {
    Box(
        modifier = modifier
            .height(200.dp)
            .clip(RoundedCornerShape(28.dp))
            .background(Brush.horizontalGradient(listOf(Color(0xFFF9A825), Color(0xFF00ACC1))))
    ) {
        AsyncImage(
            model = "https://picsum.photos/seed/creators/600/400",
            contentDescription = null,
            modifier = Modifier.fillMaxSize(),
            contentScale = ContentScale.Crop
        )

        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(16.dp),
            verticalArrangement = Arrangement.SpaceBetween
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(modifier = Modifier.size(40.dp).clip(CircleShape).background(Color.White.copy(0.3f))) {
                        Icon(Icons.Default.Person, null, modifier = Modifier.fillMaxSize().padding(8.dp), tint = Color.White)
                    }
                    Spacer(Modifier.width(8.dp))
                    Column {
                        Text("echoverse", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                        Text("Fashion Designer", color = Color.White.copy(0.8f), fontSize = 11.sp)
                    }
                }
                
                Surface(
                    onClick = {},
                    modifier = Modifier
                        .height(34.dp)
                        .widthIn(min = 80.dp),
                    shape = RoundedCornerShape(12.dp),
                    color = Color.White.copy(0.2f),
                    border = BorderStroke(1.dp, Color.White.copy(0.3f))
                ) {
                    Box(contentAlignment = Alignment.Center, modifier = Modifier.padding(horizontal = 12.dp)) {
                        Text("Follow", color = accentBlue, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                    }
                }
            }

            Surface(
                color = Color.White.copy(0.2f),
                shape = RoundedCornerShape(12.dp),
                border = BorderStroke(1.dp, Color.White.copy(0.3f))
            ) {
                Text(
                    "Fashion Loop", color = Color.White, modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp), fontSize = 12.sp, fontWeight = FontWeight.Bold
                )
            }
        }
    }
}

@Composable
fun TrendingLoopItem(index: Int, isDarkMode: Boolean, hasEmoji: Boolean, modifier: Modifier = Modifier) {
    Column(modifier = modifier) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .aspectRatio(0.8f)
                .clip(RoundedCornerShape(24.dp))
        ) {
            AsyncImage(
                model = "https://picsum.photos/seed/loop$index/400/500",
                contentDescription = null,
                modifier = Modifier.fillMaxSize(),
                contentScale = ContentScale.Crop
            )
            
            Row(
                modifier = Modifier.padding(12.dp).align(Alignment.TopStart),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Box(modifier = Modifier.size(24.dp).clip(CircleShape).background(Color.White.copy(0.3f))) {
                    Icon(Icons.Default.Person, null, modifier = Modifier.fillMaxSize().padding(4.dp), tint = Color.White)
                }
                Spacer(Modifier.width(6.dp))
                Text("@user_$index", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
            }

            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .align(Alignment.BottomStart)
                    .background(Brush.verticalGradient(listOf(Color.Transparent, Color.Black.copy(0.6f))))
                    .padding(12.dp)
            ) {
                Text(
                    "What my morning looks like... ✨", color = Color.White, fontSize = 11.sp, maxLines = 1, overflow = TextOverflow.Ellipsis
                )
            }
        }

        if (hasEmoji) {
            Row(
                modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                EmojiButton("😍")
                EmojiButton("💀")
                EmojiButton("👍")
                Icon(Icons.Default.AddCircleOutline, null, tint = Color.Gray, modifier = Modifier.size(20.dp))
            }
        }
    }
}

@Composable
fun EmojiButton(emoji: String) {
    Surface(
        onClick = {},
        shape = CircleShape,
        color = Color.Transparent,
        modifier = Modifier.size(32.dp)
    ) {
        Box(contentAlignment = Alignment.Center) {
            Text(emoji, fontSize = 16.sp)
        }
    }
}
