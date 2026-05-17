package com.example.myapplication.ui.home

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel

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
                            0 -> {
                                if (ui.posts.isEmpty()) {
                                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                                        Text("No posts yet", color = fg.copy(alpha = 0.6f), fontSize = 14.sp)
                                    }
                                } else {
                                    LazyColumn(
                                        modifier = Modifier.fillMaxSize(),
                                        contentPadding = PaddingValues(horizontal = 20.dp, vertical = 8.dp)
                                    ) {
                                        items(ui.posts, key = { it.id }) { post ->
                                            Card(
                                                modifier = Modifier
                                                    .fillMaxWidth()
                                                    .padding(vertical = 6.dp),
                                                colors = CardDefaults.cardColors(
                                                    containerColor = if (isDarkMode) Color(0xFF1A1A1A) else Color(0xFFF7F7F7)
                                                )
                                            ) {
                                                Column(modifier = Modifier.padding(12.dp)) {
                                                    Text(
                                                        text = post.caption.ifBlank { "(No caption)" },
                                                        color = fg,
                                                        maxLines = 4,
                                                        overflow = TextOverflow.Ellipsis
                                                    )
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                            1 -> Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                                Text("No reels yet", color = fg.copy(alpha = 0.6f), fontSize = 14.sp)
                            }
                            else -> Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                                Text("No tagged posts yet", color = fg.copy(alpha = 0.6f), fontSize = 14.sp)
                            }
                        }
                    }
                }
            }
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
