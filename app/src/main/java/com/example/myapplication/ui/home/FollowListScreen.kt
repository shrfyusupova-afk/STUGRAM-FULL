package com.example.myapplication.ui.home

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.PersonOff
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
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import coil.compose.AsyncImage
import com.example.myapplication.data.remote.AuthApi
import com.example.myapplication.data.remote.RetrofitClient
import com.google.gson.JsonObject
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

enum class FollowListMode { FOLLOWERS, FOLLOWING }

data class FollowListUiState(
    val isLoading: Boolean = false,
    val isLoadingMore: Boolean = false,
    val hasMore: Boolean = true,
    val error: String? = null,
    val items: List<RecommendedProfile> = emptyList()
)

class FollowListViewModel(
    private val authApi: AuthApi = RetrofitClient.instance,
    private val ioDispatcher: CoroutineDispatcher = Dispatchers.IO
) : ViewModel() {

    private val _uiState = MutableStateFlow(FollowListUiState())
    val uiState: StateFlow<FollowListUiState> = _uiState.asStateFlow()

    private var username: String = ""
    private var mode: FollowListMode = FollowListMode.FOLLOWERS
    private var currentPage = 0

    fun start(username: String, mode: FollowListMode) {
        if (this.username == username && this.mode == mode && _uiState.value.items.isNotEmpty()) return
        this.username = username
        this.mode = mode
        this.currentPage = 0
        _uiState.update { FollowListUiState() }
        loadMore()
    }

    fun loadMore() {
        val state = _uiState.value
        if (state.isLoadingMore || !state.hasMore) return
        viewModelScope.launch {
            val isFirst = state.items.isEmpty()
            _uiState.update {
                if (isFirst) it.copy(isLoading = true, error = null)
                else it.copy(isLoadingMore = true)
            }
            try {
                val nextPage = currentPage + 1
                val resp = withContext(ioDispatcher) {
                    when (mode) {
                        FollowListMode.FOLLOWERS -> authApi.getFollowers(username, nextPage, 30)
                        FollowListMode.FOLLOWING -> authApi.getFollowing(username, nextPage, 30)
                    }
                }
                if (resp.isSuccessful) {
                    val newItems = parseUsers(resp.body())
                    val existing = state.items.map { it.id }.toHashSet()
                    val merged = state.items + newItems.filter { it.id !in existing }
                    currentPage = nextPage
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            isLoadingMore = false,
                            items = merged,
                            hasMore = newItems.size >= 30
                        )
                    }
                } else {
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            isLoadingMore = false,
                            error = if (isFirst) "Ro'yxat yuklanmadi (${resp.code()})" else it.error
                        )
                    }
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        isLoadingMore = false,
                        error = if (isFirst) "Tarmoq xatosi" else it.error
                    )
                }
            }
        }
    }

    fun toggleFollow(userId: String) {
        val target = _uiState.value.items.firstOrNull { it.id == userId } ?: return
        val wasFollowing = target.followStatus == "following"
        val newStatus = if (wasFollowing) "not_following" else "following"
        _uiState.update {
            it.copy(items = it.items.map { p -> if (p.id == userId) p.copy(followStatus = newStatus) else p })
        }
        viewModelScope.launch {
            try {
                withContext(ioDispatcher) {
                    if (wasFollowing) authApi.unfollowUser(userId) else authApi.followUser(userId)
                }
            } catch (_: Exception) {
                _uiState.update {
                    it.copy(items = it.items.map { p -> if (p.id == userId) p.copy(followStatus = target.followStatus) else p })
                }
            }
        }
    }

    private fun parseUsers(body: JsonObject?): List<RecommendedProfile> {
        val data = body?.getAsJsonArray("data") ?: return emptyList()
        return data.mapNotNull { el ->
            runCatching {
                val obj = el.asJsonObject
                // Backend response: { _id, username, fullName, avatar, followStatus, ... }
                val user = if (obj.has("user") && obj.get("user").isJsonObject) obj.getAsJsonObject("user") else obj
                val id = user.get("_id")?.takeIf { !it.isJsonNull }?.asString ?: return@runCatching null
                RecommendedProfile(
                    id = id,
                    name = user.get("fullName")?.takeIf { !it.isJsonNull }?.asString?.ifBlank { null }
                        ?: user.get("username")?.takeIf { !it.isJsonNull }?.asString
                        ?: "User",
                    username = user.get("username")?.takeIf { !it.isJsonNull }?.asString ?: "",
                    avatar = user.get("avatar")?.takeIf { !it.isJsonNull }?.asString ?: "",
                    bio = user.get("bio")?.takeIf { !it.isJsonNull }?.asString ?: "",
                    followersCount = user.get("followersCount")?.takeIf { !it.isJsonNull }?.asInt ?: 0,
                    followStatus = obj.get("followStatus")?.takeIf { !it.isJsonNull }?.asString
                        ?: user.get("followStatus")?.takeIf { !it.isJsonNull }?.asString
                        ?: "not_following"
                )
            }.getOrNull()
        }
    }
}

@Composable
fun FollowListScreen(
    isDarkMode: Boolean,
    username: String,
    mode: FollowListMode,
    onBack: () -> Unit,
    onOpenProfile: (String) -> Unit,
    viewModel: FollowListViewModel = viewModel()
) {
    val ui by viewModel.uiState.collectAsState()
    val bg = if (isDarkMode) Color(0xFF0F0F0F) else Color.White
    val fg = if (isDarkMode) Color.White else Color.Black
    val secondary = fg.copy(0.6f)
    val accent = Color(0xFF00A3FF)
    val listState = rememberLazyListState()

    LaunchedEffect(username, mode) { viewModel.start(username, mode) }

    // Infinite scroll
    val shouldLoadMore by remember {
        derivedStateOf {
            val info = listState.layoutInfo
            val total = info.totalItemsCount
            val last = info.visibleItemsInfo.lastOrNull()?.index ?: 0
            total > 0 && last >= total - 3
        }
    }
    LaunchedEffect(shouldLoadMore) {
        if (shouldLoadMore && ui.hasMore && !ui.isLoadingMore) viewModel.loadMore()
    }

    Column(modifier = Modifier.fillMaxSize().background(bg)) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .statusBarsPadding()
                .padding(horizontal = 8.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, null, tint = fg) }
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    if (mode == FollowListMode.FOLLOWERS) "Followers" else "Following",
                    color = fg, fontSize = 17.sp, fontWeight = FontWeight.Bold
                )
                Text("@$username", color = secondary, fontSize = 12.sp)
            }
        }
        HorizontalDivider(color = fg.copy(0.06f))

        when {
            ui.isLoading -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = accent, strokeWidth = 2.5.dp, modifier = Modifier.size(36.dp))
            }

            ui.error != null && ui.items.isEmpty() -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(ui.error ?: "", color = secondary, fontSize = 14.sp)
                    Spacer(Modifier.height(8.dp))
                    TextButton(onClick = { viewModel.loadMore() }) { Text("Qayta urinish", color = accent) }
                }
            }

            ui.items.isEmpty() -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Icon(Icons.Default.PersonOff, null, tint = secondary, modifier = Modifier.size(48.dp))
                    Text(
                        if (mode == FollowListMode.FOLLOWERS) "Hali kuzatuvchi yo'q" else "Hali hech kim kuzatilmagan",
                        color = secondary, fontSize = 14.sp
                    )
                }
            }

            else -> LazyColumn(
                state = listState,
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(bottom = 24.dp)
            ) {
                items(ui.items, key = { it.id }) { user ->
                    FollowRow(
                        user = user,
                        isDarkMode = isDarkMode,
                        accent = accent,
                        onOpenProfile = { onOpenProfile(user.username) },
                        onToggleFollow = { viewModel.toggleFollow(user.id) }
                    )
                }
                if (ui.isLoadingMore) {
                    item {
                        Box(Modifier.fillMaxWidth().padding(vertical = 18.dp), contentAlignment = Alignment.Center) {
                            CircularProgressIndicator(color = accent, strokeWidth = 2.5.dp, modifier = Modifier.size(24.dp))
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun FollowRow(
    user: RecommendedProfile,
    isDarkMode: Boolean,
    accent: Color,
    onOpenProfile: () -> Unit,
    onToggleFollow: () -> Unit
) {
    val fg = if (isDarkMode) Color.White else Color.Black
    val secondary = fg.copy(0.6f)
    val isFollowing = user.followStatus == "following"

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onOpenProfile)
            .padding(horizontal = 16.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier.size(48.dp).clip(CircleShape).background(fg.copy(0.08f))
                .border(0.5.dp, fg.copy(0.12f), CircleShape),
            contentAlignment = Alignment.Center
        ) {
            if (user.avatar.isNotBlank()) {
                AsyncImage(
                    model = user.avatar,
                    contentDescription = null,
                    modifier = Modifier.fillMaxSize().clip(CircleShape),
                    contentScale = ContentScale.Crop
                )
            } else {
                Icon(Icons.Default.Person, null, tint = secondary, modifier = Modifier.size(26.dp))
            }
        }
        Spacer(Modifier.width(12.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(
                user.username.ifBlank { user.name },
                color = fg, fontWeight = FontWeight.SemiBold, fontSize = 14.sp,
                maxLines = 1, overflow = TextOverflow.Ellipsis
            )
            if (user.name.isNotBlank() && user.name != user.username) {
                Text(user.name, color = secondary, fontSize = 12.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
        }
        Spacer(Modifier.width(8.dp))
        Surface(
            onClick = onToggleFollow,
            modifier = Modifier.height(32.dp),
            shape = RoundedCornerShape(8.dp),
            color = if (isFollowing) Color.Transparent else accent,
            border = if (isFollowing) androidx.compose.foundation.BorderStroke(1.dp, fg.copy(0.2f)) else null
        ) {
            Box(modifier = Modifier.padding(horizontal = 14.dp, vertical = 6.dp), contentAlignment = Alignment.Center) {
                Text(
                    if (isFollowing) "Following" else "Follow",
                    color = if (isFollowing) fg else Color.White,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold
                )
            }
        }
    }
}
