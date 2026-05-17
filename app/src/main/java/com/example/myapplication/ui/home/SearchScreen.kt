package com.example.myapplication.ui.home

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel

@Composable
fun SearchScreen(
    isDarkMode: Boolean,
    isRefreshing: Boolean,
    onRefresh: () -> Unit,
    onOpenProfile: (String) -> Unit
) {
    val vm: SearchViewModel = viewModel()
    val ui = vm.uiState.collectAsState().value
    val backgroundColor = if (isDarkMode) GlobalBackgroundColor else Color.White
    val contentColor = if (isDarkMode) Color.White else Color.Black
    val secondaryColor = contentColor.copy(alpha = 0.6f)
    val accentBlue = Color(0xFF00A3FF)

    Column(modifier = Modifier.fillMaxSize().background(backgroundColor).statusBarsPadding().padding(horizontal = 16.dp, vertical = 12.dp)) {
        OutlinedTextField(
            value = ui.query,
            onValueChange = {
                vm.onQueryChange(it)
                if (it.trim().length >= 2) vm.search()
            },
            placeholder = { Text("Search", color = secondaryColor) },
            leadingIcon = { Icon(Icons.Default.Search, null, tint = secondaryColor) },
            modifier = Modifier.fillMaxWidth().height(52.dp),
            shape = RoundedCornerShape(14.dp),
            colors = OutlinedTextFieldDefaults.colors(
                focusedContainerColor = contentColor.copy(alpha = 0.05f),
                unfocusedContainerColor = contentColor.copy(alpha = 0.05f),
                focusedBorderColor = accentBlue,
                unfocusedBorderColor = Color.Transparent
            ),
            singleLine = true
        )

        Spacer(Modifier.height(16.dp))

        when {
            ui.isLoading -> Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = accentBlue)
            }
            ui.error != null -> Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(ui.error, color = contentColor, fontSize = 13.sp)
                    Spacer(Modifier.height(8.dp))
                    TextButton(onClick = { vm.search() }) { Text("Retry", color = accentBlue) }
                }
            }
            ui.query.trim().length < 2 -> Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text("Search for students or profiles", color = secondaryColor, fontSize = 14.sp)
            }
            ui.users.isEmpty() -> Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text("No results found", color = secondaryColor, fontSize = 14.sp)
            }
            else -> {
                LazyColumn(modifier = Modifier.fillMaxSize(), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    items(ui.users, key = { it.id }) { user ->
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(14.dp),
                            colors = CardDefaults.cardColors(containerColor = if (isDarkMode) Color(0xFF1A1A1A) else Color(0xFFF5F5F5))
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth().padding(12.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Box(
                                    modifier = Modifier.size(44.dp).background(contentColor.copy(alpha = 0.1f), CircleShape),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Icon(Icons.Default.Person, null, tint = secondaryColor)
                                }
                                Spacer(Modifier.width(12.dp))
                                Column(
                                    modifier = Modifier.weight(1f).clickable { if (user.username.isNotBlank()) onOpenProfile(user.username) }
                                ) {
                                    Text(user.fullName.ifBlank { "Unknown user" }, color = contentColor, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                                    Text("@${user.username}", color = secondaryColor, fontSize = 12.sp)
                                    if (user.bio.isNotBlank()) {
                                        Text(user.bio, color = secondaryColor, fontSize = 12.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                    }
                                }
                                val following = user.followStatus == "following"
                                Button(
                                    onClick = { vm.followOrUnfollow(user) },
                                    enabled = ui.followActionUserId != user.id,
                                    shape = RoundedCornerShape(10.dp),
                                    colors = ButtonDefaults.buttonColors(containerColor = if (following) contentColor.copy(alpha = 0.2f) else accentBlue)
                                ) {
                                    Text(if (following) "Following" else "Follow", color = if (following) contentColor else Color.White, fontSize = 12.sp)
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
