package com.example.myapplication.ui.home

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items as gridItems
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Search
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
import com.example.myapplication.core.ui.UiState

/**
 * Explore + search. Empty query shows creator discovery (GET /explore/creators)
 * as a 2-column grid; 2+ characters searches GET /search/users. Both flows have
 * full Loading/Error/Empty states.
 */
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
    val isSearching = ui.query.trim().length >= 2

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(backgroundColor)
            .statusBarsPadding()
            .padding(horizontal = 16.dp, vertical = 12.dp)
    ) {
        OutlinedTextField(
            value = ui.query,
            onValueChange = {
                vm.onQueryChange(it)
                if (it.trim().length >= 2) vm.search()
            },
            placeholder = { Text("Qidirish", color = secondaryColor) },
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

        if (!ui.followError.isNullOrBlank()) {
            Spacer(Modifier.height(8.dp))
            Text(ui.followError, color = Color(0xFFE53935), fontSize = 12.sp)
        }

        Spacer(Modifier.height(16.dp))

        if (isSearching) {
            SearchResults(
                state = ui.searchState,
                followActionUserId = ui.followActionUserId,
                isDarkMode = isDarkMode,
                contentColor = contentColor,
                secondaryColor = secondaryColor,
                accentBlue = accentBlue,
                onRetry = { vm.search() },
                onOpenProfile = onOpenProfile,
                onFollow = { vm.followOrUnfollow(it) }
            )
        } else {
            Text("Kashf qilish", color = contentColor, fontWeight = FontWeight.Bold, fontSize = 17.sp)
            Spacer(Modifier.height(12.dp))
            DiscoverGrid(
                state = ui.discoverState,
                followActionUserId = ui.followActionUserId,
                isDarkMode = isDarkMode,
                contentColor = contentColor,
                secondaryColor = secondaryColor,
                accentBlue = accentBlue,
                onRetry = { vm.loadDiscover() },
                onOpenProfile = onOpenProfile,
                onFollow = { vm.followOrUnfollow(it) }
            )
        }
    }
}

@Composable
private fun SearchResults(
    state: UiState<List<SearchUserItem>>,
    followActionUserId: String?,
    isDarkMode: Boolean,
    contentColor: Color,
    secondaryColor: Color,
    accentBlue: Color,
    onRetry: () -> Unit,
    onOpenProfile: (String) -> Unit,
    onFollow: (SearchUserItem) -> Unit
) {
    when (state) {
        is UiState.Loading -> CenteredBox { CircularProgressIndicator(color = accentBlue) }
        is UiState.Error -> CenteredBox {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(state.message, color = contentColor, fontSize = 13.sp)
                Spacer(Modifier.height(8.dp))
                TextButton(onClick = onRetry) { Text("Qayta urinish", color = accentBlue) }
            }
        }
        is UiState.Empty -> CenteredBox {
            Text("Hech narsa topilmadi", color = secondaryColor, fontSize = 14.sp)
        }
        is UiState.Success -> {
            LazyColumn(modifier = Modifier.fillMaxSize(), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                items(state.data, key = { it.id.ifBlank { it.username } }) { user ->
                    UserRow(
                        user = user,
                        isBusy = followActionUserId == user.id,
                        isDarkMode = isDarkMode,
                        contentColor = contentColor,
                        secondaryColor = secondaryColor,
                        accentBlue = accentBlue,
                        onOpenProfile = onOpenProfile,
                        onFollow = onFollow
                    )
                }
            }
        }
    }
}

@Composable
private fun DiscoverGrid(
    state: UiState<List<SearchUserItem>>,
    followActionUserId: String?,
    isDarkMode: Boolean,
    contentColor: Color,
    secondaryColor: Color,
    accentBlue: Color,
    onRetry: () -> Unit,
    onOpenProfile: (String) -> Unit,
    onFollow: (SearchUserItem) -> Unit
) {
    when (state) {
        is UiState.Loading -> CenteredBox { CircularProgressIndicator(color = accentBlue) }
        is UiState.Error -> CenteredBox {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(state.message, color = contentColor, fontSize = 13.sp)
                Spacer(Modifier.height(8.dp))
                TextButton(onClick = onRetry) { Text("Qayta urinish", color = accentBlue) }
            }
        }
        is UiState.Empty -> CenteredBox {
            Text("Hozircha tavsiya yo'q", color = secondaryColor, fontSize = 14.sp)
        }
        is UiState.Success -> {
            LazyVerticalGrid(
                columns = GridCells.Fixed(2),
                modifier = Modifier.fillMaxSize(),
                verticalArrangement = Arrangement.spacedBy(12.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                contentPadding = PaddingValues(bottom = 96.dp)
            ) {
                gridItems(state.data, key = { it.id.ifBlank { it.username } }) { user ->
                    CreatorCard(
                        user = user,
                        isBusy = followActionUserId == user.id,
                        isDarkMode = isDarkMode,
                        contentColor = contentColor,
                        secondaryColor = secondaryColor,
                        accentBlue = accentBlue,
                        onOpenProfile = onOpenProfile,
                        onFollow = onFollow
                    )
                }
            }
        }
    }
}

@Composable
private fun CreatorCard(
    user: SearchUserItem,
    isBusy: Boolean,
    isDarkMode: Boolean,
    contentColor: Color,
    secondaryColor: Color,
    accentBlue: Color,
    onOpenProfile: (String) -> Unit,
    onFollow: (SearchUserItem) -> Unit
) {
    val following = user.followStatus == "following"
    Card(
        shape = RoundedCornerShape(18.dp),
        colors = CardDefaults.cardColors(containerColor = if (isDarkMode) Color(0xFF1A1A1A) else Color(0xFFF5F5F5))
    ) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(14.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            UserAvatar(user.avatar, 64.dp, contentColor, secondaryColor) { onOpenProfile(user.username) }
            Spacer(Modifier.height(10.dp))
            Text(
                user.fullName.ifBlank { user.username },
                color = contentColor,
                fontWeight = FontWeight.Bold,
                fontSize = 14.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.clickable { onOpenProfile(user.username) }
            )
            Text("@${user.username}", color = accentBlue, fontSize = 12.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Spacer(Modifier.height(10.dp))
            Button(
                onClick = { onFollow(user) },
                enabled = !isBusy,
                modifier = Modifier.fillMaxWidth().height(36.dp),
                shape = RoundedCornerShape(10.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = if (following) contentColor.copy(alpha = 0.2f) else accentBlue
                )
            ) {
                Text(
                    if (following) "Following" else "Follow",
                    color = if (following) contentColor else Color.White,
                    fontSize = 12.sp
                )
            }
        }
    }
}

@Composable
private fun UserRow(
    user: SearchUserItem,
    isBusy: Boolean,
    isDarkMode: Boolean,
    contentColor: Color,
    secondaryColor: Color,
    accentBlue: Color,
    onOpenProfile: (String) -> Unit,
    onFollow: (SearchUserItem) -> Unit
) {
    val following = user.followStatus == "following"
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = if (isDarkMode) Color(0xFF1A1A1A) else Color(0xFFF5F5F5))
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            UserAvatar(user.avatar, 44.dp, contentColor, secondaryColor) { onOpenProfile(user.username) }
            Spacer(Modifier.width(12.dp))
            Column(
                modifier = Modifier.weight(1f).clickable { if (user.username.isNotBlank()) onOpenProfile(user.username) }
            ) {
                Text(
                    user.fullName.ifBlank { "Unknown user" },
                    color = contentColor,
                    fontWeight = FontWeight.Bold,
                    fontSize = 14.sp
                )
                Text("@${user.username}", color = secondaryColor, fontSize = 12.sp)
                if (user.bio.isNotBlank()) {
                    Text(user.bio, color = secondaryColor, fontSize = 12.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
            }
            Button(
                onClick = { onFollow(user) },
                enabled = !isBusy,
                shape = RoundedCornerShape(10.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = if (following) contentColor.copy(alpha = 0.2f) else accentBlue
                )
            ) {
                Text(
                    if (following) "Following" else "Follow",
                    color = if (following) contentColor else Color.White,
                    fontSize = 12.sp
                )
            }
        }
    }
}

@Composable
private fun UserAvatar(
    avatar: String,
    size: androidx.compose.ui.unit.Dp,
    contentColor: Color,
    secondaryColor: Color,
    onClick: () -> Unit
) {
    if (avatar.isBlank()) {
        Box(
            modifier = Modifier
                .size(size)
                .background(contentColor.copy(alpha = 0.1f), CircleShape)
                .clickable { onClick() },
            contentAlignment = Alignment.Center
        ) {
            Icon(Icons.Default.Person, null, tint = secondaryColor)
        }
    } else {
        AsyncImage(
            model = avatar,
            contentDescription = null,
            modifier = Modifier.size(size).clip(CircleShape).clickable { onClick() },
            contentScale = ContentScale.Crop
        )
    }
}

@Composable
private fun CenteredBox(content: @Composable BoxScope.() -> Unit) {
    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center, content = content)
}
