package com.example.myapplication.ui.home

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.rounded.ExitToApp
import androidx.compose.material.icons.automirrored.rounded.OpenInNew
import androidx.compose.material.icons.rounded.DeleteForever
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.myapplication.core.storage.TokenManager
import com.example.myapplication.data.local.chat.ChatDatabase
import com.example.myapplication.data.remote.AuthSession
import com.example.myapplication.data.remote.RetrofitClient
import com.example.myapplication.data.remote.chat.ChatSocketManager
import retrofit2.Response
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(isDarkMode: Boolean, onBack: () -> Unit) {
    val backgroundColor = if (isDarkMode) Color(0xFF0F0F0F) else Color.White
    val contentColor = if (isDarkMode) Color.White else Color.Black
    val accentBlue = Color(0xFF00A3FF)
    val dangerRed = Color(0xFFE53935)
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var isLoggingOut by remember { mutableStateOf(false) }
    var showDeleteDialog by remember { mutableStateOf(false) }
    var isDeletingAccount by remember { mutableStateOf(false) }
    var deleteError by remember { mutableStateOf<String?>(null) }

    if (showDeleteDialog) {
        AlertDialog(
            onDismissRequest = { if (!isDeletingAccount) showDeleteDialog = false },
            containerColor = if (isDarkMode) Color(0xFF1A1A1A) else Color.White,
            title = {
                Text(
                    "Delete Account?",
                    color = dangerRed,
                    fontWeight = FontWeight.Bold
                )
            },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        "This action is permanent and cannot be undone.\n\n" +
                        "Your profile, posts, stories, and messages will be permanently removed.",
                        color = contentColor,
                        fontSize = 14.sp
                    )
                    if (deleteError != null) {
                        Text(
                            text = deleteError!!,
                            color = dangerRed,
                            fontSize = 13.sp
                        )
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        scope.launch {
                            isDeletingAccount = true
                            deleteError = null
                            try {
                                val response = RetrofitClient.instance.deleteAccount()
                                if (response.isSuccessful) {
                                    runCatching { TokenManager(context).clearTokens() }
                                    runCatching { ChatDatabase.clearAndWipe(context) }
                                    AuthSession.clearSession()
                                    ChatSocketManager.disconnect()
                                    showDeleteDialog = false
                                    onBack()
                                } else {
                                    deleteError = "Failed to delete account (${response.code()}). Please try again."
                                    isDeletingAccount = false
                                }
                            } catch (e: Exception) {
                                deleteError = "Network error. Check your connection and try again."
                                isDeletingAccount = false
                            }
                        }
                    },
                    enabled = !isDeletingAccount,
                    colors = ButtonDefaults.buttonColors(containerColor = dangerRed)
                ) {
                    if (isDeletingAccount) {
                        CircularProgressIndicator(color = Color.White, strokeWidth = 2.dp, modifier = Modifier.size(16.dp))
                        Spacer(Modifier.width(8.dp))
                    }
                    Text("Delete permanently", color = Color.White, fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(
                    onClick = { if (!isDeletingAccount) showDeleteDialog = false }
                ) {
                    Text("Cancel", color = contentColor.copy(alpha = 0.7f))
                }
            }
        )
    }

    Scaffold(
        containerColor = backgroundColor,
        topBar = {
            TopAppBar(
                title = { Text("Settings", fontWeight = FontWeight.Black, fontSize = 22.sp) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = null, tint = contentColor)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = backgroundColor,
                    titleContentColor = contentColor,
                    navigationIconContentColor = contentColor
                )
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = 16.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Card(
                shape = RoundedCornerShape(18.dp),
                colors = CardDefaults.cardColors(
                    containerColor = if (isDarkMode) Color.White.copy(0.06f) else Color.Black.copy(0.03f)
                )
            ) {
                Column(modifier = Modifier.fillMaxWidth().padding(16.dp)) {
                    Text(
                        text = "Alpha settings",
                        color = contentColor,
                        fontWeight = FontWeight.Bold,
                        fontSize = 16.sp
                    )
                    Spacer(Modifier.height(6.dp))
                    Text(
                        text = "Only verified settings are shown in this alpha.",
                        color = contentColor.copy(alpha = 0.7f),
                        fontSize = 13.sp,
                        textAlign = TextAlign.Start
                    )
                }
            }

            Button(
                onClick = {
                    if (isLoggingOut) return@Button
                    scope.launch {
                        isLoggingOut = true
                        runCatching { TokenManager(context).clearTokens() }
                        runCatching { ChatDatabase.clearAndWipe(context) }
                        AuthSession.clearSession()
                        ChatSocketManager.disconnect()
                        isLoggingOut = false
                        onBack()
                    }
                },
                enabled = !isLoggingOut,
                modifier = Modifier.fillMaxWidth().height(52.dp),
                shape = RoundedCornerShape(14.dp),
                colors = ButtonDefaults.buttonColors(containerColor = accentBlue)
            ) {
                if (isLoggingOut) {
                    CircularProgressIndicator(
                        color = Color.White,
                        strokeWidth = 2.dp,
                        modifier = Modifier.size(18.dp)
                    )
                } else {
                    Icon(Icons.AutoMirrored.Rounded.ExitToApp, contentDescription = null, tint = Color.White)
                    Spacer(Modifier.width(8.dp))
                    Text("Logout", color = Color.White, fontWeight = FontWeight.Bold)
                }
            }

            OutlinedButton(
                onClick = { showDeleteDialog = true },
                enabled = !isLoggingOut && !isDeletingAccount,
                modifier = Modifier.fillMaxWidth().height(52.dp),
                shape = RoundedCornerShape(14.dp),
                colors = ButtonDefaults.outlinedButtonColors(contentColor = dangerRed),
                border = androidx.compose.foundation.BorderStroke(1.5.dp, dangerRed)
            ) {
                Icon(Icons.Rounded.DeleteForever, contentDescription = null, tint = dangerRed)
                Spacer(Modifier.width(8.dp))
                Text("Delete Account", color = dangerRed, fontWeight = FontWeight.Bold)
            }

            Card(
                shape = RoundedCornerShape(18.dp),
                colors = CardDefaults.cardColors(
                    containerColor = if (isDarkMode) Color.White.copy(0.06f) else Color.Black.copy(0.03f)
                ),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.fillMaxWidth().padding(16.dp)) {
                    Text(
                        text = "Legal",
                        color = contentColor,
                        fontWeight = FontWeight.Bold,
                        fontSize = 16.sp
                    )
                    Spacer(Modifier.height(8.dp))
                    LegalLinkRow(
                        label = "Privacy Policy",
                        url = "https://shrfyusupova-afk.github.io/stugram-full/privacy.html",
                        contentColor = contentColor,
                        accentBlue = accentBlue
                    )
                    LegalLinkRow(
                        label = "Terms of Service",
                        url = "https://shrfyusupova-afk.github.io/stugram-full/terms.html",
                        contentColor = contentColor,
                        accentBlue = accentBlue
                    )
                    LegalLinkRow(
                        label = "Data Deletion",
                        url = "https://shrfyusupova-afk.github.io/stugram-full/delete-account.html",
                        contentColor = contentColor,
                        accentBlue = accentBlue
                    )
                }
            }
        }
    }
}

@Composable
private fun LegalLinkRow(
    label: String,
    url: String,
    contentColor: Color,
    accentBlue: Color
) {
    val context = LocalContext.current
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = label,
            color = contentColor,
            fontSize = 14.sp,
            modifier = Modifier.weight(1f)
        )
        TextButton(onClick = {
            runCatching {
                context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
            }
        }) {
            Text("Open", color = accentBlue, fontSize = 13.sp)
            Spacer(Modifier.width(4.dp))
            Icon(
                Icons.AutoMirrored.Rounded.OpenInNew,
                contentDescription = null,
                tint = accentBlue,
                modifier = Modifier.size(14.dp)
            )
        }
    }
}
