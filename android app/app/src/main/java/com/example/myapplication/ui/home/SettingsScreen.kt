package com.example.myapplication.ui.home

import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.rounded.Chat
import androidx.compose.material.icons.automirrored.rounded.ExitToApp
import androidx.compose.material.icons.automirrored.rounded.Help
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.*
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Immutable
data class SettingsFolder(
    val id: Int,
    val title: String,
    val icon: ImageVector,
    val subItems: List<String>,
    val isDanger: Boolean = false
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(isDarkMode: Boolean, onBack: () -> Unit) {
    val backgroundColor = if (isDarkMode) Color(0xFF0F0F0F) else Color.White
    val contentColor = if (isDarkMode) Color.White else Color.Black
    val accentBlue = Color(0xFF00A3FF)

    // Qaysi "papka" (oyna) ichida ekanligimizni saqlash uchun
    var activeFolder by remember { mutableStateOf<SettingsFolder?>(null) }

    val folders = remember {
        listOf(
            SettingsFolder(1, "Account", Icons.Rounded.AccountCircle, listOf("Username o'zgartirish", "Name / Bio edit", "Profile photo o'zgartirish", "Email / Phone bog'lash", "Password o'zgartirish", "Account type")),
            SettingsFolder(2, "Privacy", Icons.Rounded.Lock, listOf("Private account", "Kimlar postlaringni ko'radi", "Story cheklovlari", "Comments sozlamalari", "DM sozlamalari", "Blocklanganlar", "Hidden words")),
            SettingsFolder(3, "Notifications", Icons.Rounded.Notifications, listOf("Likes", "Comments", "Follow / Requests", "Messages", "Push settings")),
            SettingsFolder(4, "Security", Icons.Rounded.Shield, listOf("Change password", "2FA Security", "Login activity", "Devices", "Logout all sessions")),
            SettingsFolder(5, "Activity", Icons.Rounded.History, listOf("Like qilingan postlar", "Commentlar tarixi", "Save qilingan postlar", "Search history", "Recently viewed")),
            SettingsFolder(6, "Content Control", Icons.Rounded.Block, listOf("Sensitive filter", "Feed algorithm", "Mute userlar")),
            SettingsFolder(7, "Community", Icons.Rounded.Group, listOf("Following list", "Followers list", "Pending requests", "Close friends")),
            SettingsFolder(8, "Messages", Icons.AutoMirrored.Rounded.Chat, listOf("Read receipts", "Requests filter", "Spam protection", "Who can add to groups")),
            SettingsFolder(9, "Appearance", Icons.Rounded.Palette, listOf("Dark / Light mode", "Language", "App theme")),
            SettingsFolder(10, "Storage & Data", Icons.Rounded.Storage, listOf("Cache tozalash", "Data saver", "Video auto-play")),
            SettingsFolder(11, "Beta Features", Icons.Rounded.Science, listOf("New UI test", "Experimental features", "Feedback", "Bug report")),
            SettingsFolder(12, "Support & Help", Icons.AutoMirrored.Rounded.Help, listOf("Help center", "Report problem", "Contact support", "Guidelines")),
            SettingsFolder(13, "About", Icons.Rounded.Info, listOf("App version (Beta 1.0)", "Terms of Service", "Privacy Policy")),
            SettingsFolder(14, "Account Actions", Icons.AutoMirrored.Rounded.ExitToApp, listOf("Logout", "Deactivate account", "Delete account"), isDanger = true)
        )
    }

    // Oyna ichida oyna animatsiyasi
    AnimatedContent(
        targetState = activeFolder,
        transitionSpec = {
            if (targetState != null) {
                // Ichkariga kirish (O'ngdan kiradi)
                slideInHorizontally { it } + fadeIn() togetherWith slideOutHorizontally { -it } + fadeOut()
            } else {
                // Orqaga qaytish (Chapdan kiradi)
                slideInHorizontally { -it } + fadeIn() togetherWith slideOutHorizontally { it } + fadeOut()
            }
        },
        label = "settings_nav"
    ) { folder ->
        if (folder == null) {
            // ASOSIY SETTINGS RO'YXATI (Papkalar)
            Scaffold(
                containerColor = backgroundColor,
                topBar = {
                    TopAppBar(
                        title = { Text("Settings", fontWeight = FontWeight.Black, fontSize = 22.sp) },
                        navigationIcon = {
                            IconButton(onClick = onBack) {
                                Icon(Icons.AutoMirrored.Filled.ArrowBack, null)
                            }
                        },
                        colors = TopAppBarDefaults.topAppBarColors(containerColor = backgroundColor, titleContentColor = contentColor, navigationIconContentColor = contentColor)
                    )
                }
            ) { padding ->
                LazyColumn(
                    modifier = Modifier.fillMaxSize().padding(padding).padding(horizontal = 16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    item { Spacer(Modifier.height(8.dp)) }
                    items(folders) { item ->
                        SettingsFolderCard(item, accentBlue, contentColor) { activeFolder = item }
                    }
                    item { Spacer(Modifier.height(100.dp)) }
                }
            }
        } else {
            // ICHKI OYNA (Papka ichidagi sozlamalar)
            Scaffold(
                containerColor = backgroundColor,
                topBar = {
                    TopAppBar(
                        title = { Text(folder.title, fontWeight = FontWeight.Bold, fontSize = 20.sp) },
                        navigationIcon = {
                            IconButton(onClick = { activeFolder = null }) {
                                Icon(Icons.AutoMirrored.Filled.ArrowBack, null)
                            }
                        },
                        colors = TopAppBarDefaults.topAppBarColors(containerColor = backgroundColor, titleContentColor = contentColor, navigationIconContentColor = contentColor)
                    )
                }
            ) { padding ->
                Column(
                    modifier = Modifier.fillMaxSize().padding(padding).padding(horizontal = 16.dp).verticalScroll(rememberScrollState())
                ) {
                    Spacer(Modifier.height(20.dp))
                    
                    // Folder Header
                    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(bottom = 32.dp)) {
                        Box(
                            modifier = Modifier.size(56.dp).clip(CircleShape).background(accentBlue.copy(alpha = 0.1f)),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(folder.icon, null, tint = accentBlue, modifier = Modifier.size(28.dp))
                        }
                        Spacer(Modifier.width(16.dp))
                        Column {
                            Text(folder.title, fontWeight = FontWeight.Black, fontSize = 24.sp, color = contentColor)
                            Text("Manage your ${folder.title.lowercase()} settings", fontSize = 13.sp, color = Color.Gray)
                        }
                    }

                    // Sub-items List
                    folder.subItems.forEach { subItem ->
                        Surface(
                            onClick = { },
                            color = Color.Transparent,
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth().padding(vertical = 16.dp, horizontal = 8.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Text(
                                    text = subItem,
                                    fontSize = 16.sp,
                                    color = if (folder.isDanger || subItem == "Logout" || subItem.contains("Delete")) Color.Red else contentColor,
                                    fontWeight = FontWeight.Medium
                                )
                                Icon(Icons.Default.ChevronRight, null, tint = contentColor.copy(alpha = 0.3f), modifier = Modifier.size(20.dp))
                            }
                        }
                        HorizontalDivider(color = contentColor.copy(alpha = 0.05f))
                    }
                    
                    Spacer(Modifier.height(100.dp))
                }
            }
        }
    }
}

@Composable
private fun SettingsFolderCard(
    folder: SettingsFolder,
    accentBlue: Color,
    contentColor: Color,
    onClick: () -> Unit
) {
    Surface(
        onClick = onClick,
        color = contentColor.copy(alpha = 0.03f),
        shape = RoundedCornerShape(20.dp),
        border = BorderStroke(0.5.dp, contentColor.copy(alpha = 0.05f))
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier.size(42.dp).clip(CircleShape).background(accentBlue.copy(alpha = 0.1f)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(folder.icon, null, tint = accentBlue, modifier = Modifier.size(24.dp))
                }
                Spacer(Modifier.width(16.dp))
                Text(text = folder.title, fontSize = 17.sp, fontWeight = FontWeight.Bold, color = contentColor)
            }
            Icon(Icons.Default.ChevronRight, null, tint = contentColor.copy(alpha = 0.3f), modifier = Modifier.size(20.dp))
        }
    }
}
