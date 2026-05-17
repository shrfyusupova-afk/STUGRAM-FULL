package com.example.myapplication.ui.home

import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.*
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.grid.*
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.*
import androidx.compose.material.icons.rounded.*
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
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.example.myapplication.R
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProfileScreen(
    isDarkMode: Boolean, 
    isRefreshing: Boolean,
    onRefresh: () -> Unit,
    isMyProfile: Boolean = true, 
    onBack: (() -> Unit)? = null
) {
    val backgroundColor = if (isDarkMode) Color(0xFF0F0F0F) else Color.White
    val contentColor = if (isDarkMode) Color.White else Color.Black
    val scope = rememberCoroutineScope()
    val pagerState = rememberPagerState(pageCount = { 4 })
    val accentBlue = Color(0xFF00A3FF)
    
    var currentView by remember { mutableStateOf("profile") } // "profile", "settings", "edit_profile"
    
    val configuration = LocalConfiguration.current
    val screenWidth = configuration.screenWidthDp.dp
    val bannerHeight = screenWidth * 650f / 1080f
    
    val avatarSize = 120.dp
    val avatarOverlap = avatarSize * 0.15f

    Crossfade(targetState = currentView, label = "profile_view_transition") { view ->
        when (view) {
            "settings" -> {
                SettingsScreen(isDarkMode = isDarkMode, onBack = { currentView = "profile" })
            }
            "edit_profile" -> {
                EditProfileScreen(
                    isDarkMode = isDarkMode, 
                    onBack = { currentView = "profile" },
                    onSave = { 
                        // Ma'lumotlarni saqlash logikasi bu yerga keladi
                        currentView = "profile" 
                    }
                )
            }
            else -> {
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
                        // Banner Section
                        Box(modifier = Modifier.fillMaxWidth().height(bannerHeight)) {
                            AsyncImage(
                                model = if (isMyProfile) R.drawable.kun else R.drawable.tun,
                                contentDescription = "Banner",
                                modifier = Modifier.fillMaxSize(),
                                contentScale = ContentScale.Crop
                            )

                            if (isMyProfile) {
                                Box(
                                    modifier = Modifier
                                        .align(Alignment.BottomEnd)
                                        .padding(bottom = 12.dp, end = 16.dp)
                                        .size(36.dp)
                                        .clip(CircleShape)
                                        .background(Color.Black.copy(0.6f))
                                        .clickable { currentView = "edit_profile" },
                                    contentAlignment = Alignment.Center
                                ) {
                                    Icon(Icons.Default.CameraAlt, null, tint = Color.White, modifier = Modifier.size(18.dp))
                                }
                            }
                        }

                        LazyColumn(modifier = Modifier.fillMaxSize()) {
                            item { Spacer(modifier = Modifier.height(bannerHeight - avatarOverlap)) }

                            item {
                                Box(modifier = Modifier.fillMaxWidth()) {
                                    Column(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .clip(RoundedCornerShape(topStart = 35.dp, topEnd = 35.dp))
                                            .background(backgroundColor)
                                            .padding(bottom = 16.dp)
                                    ) {
                                        ProfileHeaderRefinedDesign(isDarkMode, isMyProfile)
                                        Spacer(modifier = Modifier.height(12.dp))
                                        ProfileButtonsFinalAction(
                                            isDarkMode = isDarkMode, 
                                            isMyProfile = isMyProfile, 
                                            onEditClick = { currentView = "edit_profile" }
                                        )
                                        FavoriteMomentsRectSection(isDarkMode)
                                        
                                        ProfileTabSelectorOptimized(
                                            selectedTab = pagerState.currentPage,
                                            onTabSelected = { index ->
                                                scope.launch { pagerState.animateScrollToPage(index) }
                                            },
                                            isDarkMode = isDarkMode
                                        )
                                    }

                                    // Profile Picture
                                    Box(
                                        modifier = Modifier
                                            .padding(start = 20.dp)
                                            .offset(y = (-avatarOverlap))
                                            .size(avatarSize)
                                            .background(backgroundColor, CircleShape)
                                            .border(4.dp, accentBlue, CircleShape)
                                            .padding(4.dp)
                                            .clip(CircleShape)
                                            .background(if (isDarkMode) Color(0xFF262626) else Color(0xFFF0F0F0))
                                            .clickable(enabled = isMyProfile) { currentView = "edit_profile" },
                                        contentAlignment = Alignment.Center
                                    ) {
                                        AsyncImage(
                                            model = if (isMyProfile) R.drawable.photo_1 else R.drawable.photo_3,
                                            contentDescription = "Profile Picture",
                                            modifier = Modifier.fillMaxSize(),
                                            contentScale = ContentScale.Crop
                                        )
                                    }
                                }
                            }

                            item {
                                HorizontalPager(
                                    state = pagerState,
                                    modifier = Modifier.fillMaxWidth().height(600.dp),
                                    verticalAlignment = Alignment.Top
                                ) { page ->
                                    when (page) {
                                        0 -> ProfilePostsGrid(isDarkMode)
                                        1 -> ProfileReelsGrid(isDarkMode)
                                        2 -> ProfileTaggedGrid(isDarkMode)
                                        3 -> ProfileInfoTabFinalLayout(isDarkMode)
                                    }
                                }
                            }
                        }
                        
                        // Top Navigation
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .statusBarsPadding()
                                .padding(16.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            if (onBack != null) {
                                IconButton(onClick = onBack) {
                                    Icon(Icons.AutoMirrored.Filled.ArrowBack, null, tint = if(isDarkMode) Color.White else Color.Black)
                                }
                            } else {
                                Spacer(Modifier.size(40.dp))
                            }

                            if (isMyProfile) {
                                IconButton(onClick = { currentView = "settings" }) {
                                    Icon(Icons.Default.Menu, null, tint = if(isDarkMode) Color.White else Color.Black, modifier = Modifier.size(28.dp))
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ProfileHeaderRefinedDesign(isDarkMode: Boolean, isMyProfile: Boolean) {
    val accentBlue = Color(0xFF00A3FF)
    val contentColor = if (isDarkMode) Color.White else Color.Black
    
    Column(modifier = Modifier.padding(horizontal = 20.dp)) {
        Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.Top) {
            Spacer(modifier = Modifier.width(120.dp)) 
            Spacer(modifier = Modifier.width(16.dp))

            var isNameExpanded by remember { mutableStateOf(false) }
            val name = if (isMyProfile) "Jahongir Samandarov" else "Dilshodbek Ismoilov"
            Column(modifier = Modifier.weight(1f).padding(top = 10.dp)) {
                Text(
                    text = name, color = contentColor, 
                    fontSize = if (isNameExpanded) 24.sp else 28.sp, fontWeight = FontWeight.Black,
                    maxLines = if (isNameExpanded) 2 else 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.clickable { isNameExpanded = !isNameExpanded }
                )
                Text(text = if (isMyProfile) "@jahongir_sam" else "@dilshod_i", color = accentBlue, fontSize = 16.sp, fontWeight = FontWeight.ExtraBold)
                
                Row(
                    modifier = Modifier.fillMaxWidth().padding(top = 16.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    StatItemHeader(if (isMyProfile) "25" else "12", "Posts", contentColor)
                    StatItemHeader(if (isMyProfile) "1.2K" else "850", "Followers", contentColor)
                    StatItemHeader(if (isMyProfile) "350" else "1.1K", "Following", contentColor)
                }
            }
        }

        Spacer(modifier = Modifier.height(20.dp))

        Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.Top) {
            Column(modifier = Modifier.width(145.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.School, null, tint = accentBlue, modifier = Modifier.size(16.dp))
                    Spacer(Modifier.width(8.dp))
                    Text("TOSHKENT", fontSize = 12.sp, color = contentColor, fontWeight = FontWeight.ExtraBold)
                }
                Text("DAVLAT", fontSize = 12.sp, color = contentColor, fontWeight = FontWeight.ExtraBold, modifier = Modifier.padding(start = 24.dp))
                Text("UNIVERSITY", fontSize = 12.sp, color = contentColor, fontWeight = FontWeight.ExtraBold, modifier = Modifier.padding(start = 24.dp))
            }
            Spacer(modifier = Modifier.width(12.dp))
            Text(
                text = if (isMyProfile) "Model & Fashion Designer. Living life to the fullest. 🏔️✨" else "Software Engineer | Traveler 🌍",
                fontSize = 14.sp, color = contentColor, lineHeight = 18.sp, fontWeight = FontWeight.ExtraBold,
                modifier = Modifier.weight(1f)
            )
        }
    }
}

@Composable
private fun StatItemHeader(value: String, label: String, contentColor: Color) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(text = value, fontSize = 21.sp, fontWeight = FontWeight.ExtraBold, color = contentColor)
        Text(text = label, fontSize = 13.sp, color = Color.Gray, fontWeight = FontWeight.ExtraBold)
    }
}

@Composable
private fun ProfileButtonsFinalAction(isDarkMode: Boolean, isMyProfile: Boolean, onEditClick: () -> Unit) {
    val accentBlue = Color(0xFF00A3FF)
    val contentColor = if (isDarkMode) Color.White else Color.Black
    val glossyBg = if (isDarkMode) Color.White.copy(alpha = 0.12f) else Color.Black.copy(alpha = 0.05f)

    Row(modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 8.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        if (isMyProfile) {
            Button(onClick = onEditClick, modifier = Modifier.weight(1f).height(50.dp), shape = RoundedCornerShape(16.dp), colors = ButtonDefaults.buttonColors(containerColor = accentBlue)) {
                Text("Edit Profile", color = Color.White, fontWeight = FontWeight.ExtraBold, fontSize = 15.sp)
            }
            Button(onClick = { }, modifier = Modifier.weight(1f).height(50.dp), shape = RoundedCornerShape(16.dp), colors = ButtonDefaults.buttonColors(containerColor = glossyBg), border = BorderStroke(0.5.dp, Color.Gray.copy(0.2f))) {
                Text("Share Profile", color = contentColor, fontWeight = FontWeight.ExtraBold, fontSize = 15.sp)
            }
        } else {
            Button(onClick = { }, modifier = Modifier.weight(1f).height(50.dp), shape = RoundedCornerShape(16.dp), colors = ButtonDefaults.buttonColors(containerColor = accentBlue)) {
                Text("Follow", color = Color.White, fontWeight = FontWeight.ExtraBold, fontSize = 15.sp)
            }
            Button(onClick = { }, modifier = Modifier.weight(1f).height(50.dp), shape = RoundedCornerShape(16.dp), colors = ButtonDefaults.buttonColors(containerColor = glossyBg), border = BorderStroke(0.5.dp, Color.Gray.copy(0.2f))) {
                Text("Message", color = contentColor, fontWeight = FontWeight.ExtraBold, fontSize = 15.sp)
            }
        }
    }
}

@Composable
private fun FavoriteMomentsRectSection(isDarkMode: Boolean) {
    val moments = listOf("Dubai", "Work", "Family", "Fashion", "Gym")
    val contentColor = if (isDarkMode) Color.White else Color.Black
    val glossyBg = if (isDarkMode) Color.White.copy(alpha = 0.08f) else Color.Black.copy(alpha = 0.03f)

    Column(modifier = Modifier.padding(vertical = 12.dp)) {
        Text("Favorite Moments", fontSize = 16.sp, fontWeight = FontWeight.ExtraBold, color = contentColor, modifier = Modifier.padding(start = 20.dp, bottom = 12.dp))
        LazyRow(contentPadding = PaddingValues(horizontal = 20.dp), horizontalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            items(moments) { title ->
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Box(modifier = Modifier.size(78.dp, 105.dp).clip(RoundedCornerShape(18.dp)).background(glossyBg).border(1.dp, Color.Gray.copy(0.1f), RoundedCornerShape(18.dp)), contentAlignment = Alignment.Center) {
                        Icon(Icons.Default.Image, null, tint = Color.Gray, modifier = Modifier.size(32.dp))
                    }
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(title, fontSize = 12.sp, color = contentColor, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

@Composable
private fun ProfileTabSelectorOptimized(selectedTab: Int, onTabSelected: (Int) -> Unit, isDarkMode: Boolean) {
    val tabs = listOf(Icons.Default.GridView, Icons.Default.PlayCircle, Icons.Default.AssignmentInd, Icons.Default.Info)
    val glassBg = if (isDarkMode) Color.White.copy(alpha = 0.12f) else Color.Black.copy(alpha = 0.05f)

    Box(modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 12.dp).height(56.dp).clip(RoundedCornerShape(28.dp)).background(glassBg).border(0.5.dp, Color.Gray.copy(0.2f), RoundedCornerShape(28.dp)).padding(4.dp)) {
        val configuration = LocalConfiguration.current
        val tabWidth = (configuration.screenWidthDp.dp - 48.dp) / tabs.size
        val indicatorOffset by animateDpAsState(targetValue = tabWidth * selectedTab, animationSpec = spring(stiffness = Spring.StiffnessLow), label = "indicator")
        Box(modifier = Modifier.offset(x = indicatorOffset).width(tabWidth).fillMaxHeight().clip(RoundedCornerShape(24.dp)).background(Color(0xFF00A3FF)))
        Row(modifier = Modifier.fillMaxSize()) {
            tabs.forEachIndexed { index, icon ->
                Box(modifier = Modifier.weight(1f).fillMaxHeight().clickable(interactionSource = remember { MutableInteractionSource() }, indication = null) { onTabSelected(index) }, contentAlignment = Alignment.Center) {
                    Icon(icon, null, tint = if (selectedTab == index) Color.White else Color.Gray, modifier = Modifier.size(24.dp))
                }
            }
        }
    }
}

@Composable
private fun ProfilePostsGrid(isDarkMode: Boolean) {
    LazyVerticalGrid(columns = GridCells.Fixed(3), modifier = Modifier.fillMaxSize(), contentPadding = PaddingValues(1.dp)) {
        items(21) { Box(modifier = Modifier.aspectRatio(1f).padding(1.dp).background(if (isDarkMode) Color(0xFF262626) else Color(0xFFF5F5F5))) { Icon(Icons.Default.Image, null, modifier = Modifier.align(Alignment.Center), tint = Color.Gray) } }
    }
}

@Composable
private fun ProfileReelsGrid(isDarkMode: Boolean) {
    LazyVerticalGrid(columns = GridCells.Fixed(3), modifier = Modifier.fillMaxSize(), contentPadding = PaddingValues(1.dp)) {
        items(12) { Box(modifier = Modifier.aspectRatio(0.6f).padding(1.dp).background(if (isDarkMode) Color(0xFF1C1C1E) else Color(0xFFF0F0F0))) { Icon(Icons.Default.PlayArrow, null, modifier = Modifier.align(Alignment.Center), tint = Color.Gray) } }
    }
}

@Composable
private fun ProfileTaggedGrid(isDarkMode: Boolean) {
    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { Text("Tagged posts", color = Color.Gray, fontWeight = FontWeight.Bold) }
}

@Composable
private fun ProfileInfoTabFinalLayout(isDarkMode: Boolean) {
    val contentColor = if (isDarkMode) Color.White else Color.Black
    val accentBlue = Color(0xFF00A3FF)
    Column(modifier = Modifier.fillMaxSize().padding(horizontal = 20.dp, vertical = 20.dp).verticalScroll(rememberScrollState())) {
        Text("Shaxsiy Ma'lumotlar", color = accentBlue, fontSize = 18.sp, fontWeight = FontWeight.ExtraBold, modifier = Modifier.padding(bottom = 12.dp))
        InfoBoxItemDetail(Icons.Default.Person, "Ism Familya", "Jahongir Samandarov", contentColor, isDarkMode)
        InfoBoxItemDetail(Icons.Default.Badge, "Nickname", "@jahongir_sam", contentColor, isDarkMode)
        InfoBoxItemDetail(Icons.Default.Cake, "Tug'ilgan kuni", "12 Iyun, 2002-yil", contentColor, isDarkMode)
        Spacer(modifier = Modifier.height(24.dp))
        Text("Manzil va O'qish", color = accentBlue, fontSize = 18.sp, fontWeight = FontWeight.ExtraBold, modifier = Modifier.padding(bottom = 12.dp))
        InfoBoxItemDetail(Icons.Default.LocationCity, "Viloyat", "Toshkent", contentColor, isDarkMode)
        InfoBoxItemDetail(Icons.Default.School, "Maktabi / OTM", "Toshkent Davlat Universiteti", contentColor, isDarkMode)
    }
}

@Composable
private fun InfoBoxItemDetail(icon: ImageVector, label: String, value: String, contentColor: Color, isDarkMode: Boolean) {
    Row(modifier = Modifier.fillMaxWidth().padding(vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
        Box(modifier = Modifier.size(40.dp).clip(RoundedCornerShape(10.dp)).background(Color(0xFF00A3FF).copy(alpha = 0.12f)), contentAlignment = Alignment.Center) { Icon(icon, null, tint = Color(0xFF00A3FF), modifier = Modifier.size(22.dp)) }
        Spacer(modifier = Modifier.width(16.dp))
        Column {
            Text(label, color = if (isDarkMode) Color.Gray else Color.DarkGray, fontSize = 12.sp, fontWeight = FontWeight.Medium)
            Text(value, color = contentColor, fontSize = 16.sp, fontWeight = FontWeight.Bold)
        }
    }
}
