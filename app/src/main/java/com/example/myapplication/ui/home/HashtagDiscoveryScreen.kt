package com.example.myapplication.ui.home

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.grid.rememberLazyGridState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.PhotoLibrary
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
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

data class HashtagDiscoveryUiState(
    val hashtag: String = "",
    val isLoading: Boolean = false,
    val isLoadingMore: Boolean = false,
    val hasMore: Boolean = true,
    val totalCount: Int = 0,
    val posts: List<PostData> = emptyList(),
    val error: String? = null
)

class HashtagDiscoveryViewModel(
    private val authApi: AuthApi = RetrofitClient.instance,
    private val ioDispatcher: CoroutineDispatcher = Dispatchers.IO
) : ViewModel() {

    private val _uiState = MutableStateFlow(HashtagDiscoveryUiState())
    val uiState: StateFlow<HashtagDiscoveryUiState> = _uiState.asStateFlow()

    private var currentPage = 0

    fun start(hashtag: String) {
        val normalized = hashtag.trim().removePrefix("#")
        if (normalized.isBlank()) return
        if (_uiState.value.hashtag == normalized && _uiState.value.posts.isNotEmpty()) return
        currentPage = 0
        _uiState.value = HashtagDiscoveryUiState(hashtag = normalized)
        loadMore()
    }

    fun loadMore() {
        val state = _uiState.value
        if (state.isLoadingMore || !state.hasMore || state.hashtag.isBlank()) return
        viewModelScope.launch {
            val isFirst = state.posts.isEmpty()
            _uiState.update {
                if (isFirst) it.copy(isLoading = true, error = null)
                else it.copy(isLoadingMore = true)
            }
            try {
                val nextPage = currentPage + 1
                val resp = withContext(ioDispatcher) {
                    authApi.searchPosts(query = "#${state.hashtag}", page = nextPage, limit = 30)
                }
                if (resp.isSuccessful) {
                    val newItems = parse(resp.body())
                    val totalCount = resp.body()?.getAsJsonObject("meta")
                        ?.get("total")?.takeIf { !it.isJsonNull }?.asInt ?: state.totalCount
                    val existing = state.posts.map { it.id }.toHashSet()
                    val merged = state.posts + newItems.filter { it.id !in existing }
                    currentPage = nextPage
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            isLoadingMore = false,
                            posts = merged,
                            totalCount = if (totalCount > 0) totalCount else merged.size,
                            hasMore = newItems.size >= 30
                        )
                    }
                } else {
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            isLoadingMore = false,
                            error = if (isFirst) "Postlar yuklanmadi (${resp.code()})" else it.error
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

    private fun parse(body: JsonObject?): List<PostData> {
        val data = body?.getAsJsonArray("data") ?: return emptyList()
        return data.mapNotNull { el ->
            runCatching {
                val obj = el.asJsonObject
                val id = obj.get("_id")?.takeIf { !it.isJsonNull }?.asString ?: return@runCatching null
                val author = if (obj.has("author") && !obj.get("author").isJsonNull) obj.getAsJsonObject("author") else null
                val mediaArr = if (obj.has("media") && obj.get("media").isJsonArray) obj.getAsJsonArray("media") else null
                val first = mediaArr?.firstOrNull()?.asJsonObject
                val url = first?.get("url")?.takeIf { !it.isJsonNull }?.asString
                val isVideo = first?.get("type")?.takeIf { !it.isJsonNull }?.asString == "video"
                PostData(
                    id = id,
                    user = author?.get("username")?.takeIf { !it.isJsonNull }?.asString ?: "user",
                    image = url,
                    caption = obj.get("caption")?.takeIf { !it.isJsonNull }?.asString ?: "",
                    likes = obj.get("likesCount")?.takeIf { !it.isJsonNull }?.asInt ?: 0,
                    comments = obj.get("commentsCount")?.takeIf { !it.isJsonNull }?.asInt ?: 0,
                    isVideo = isVideo
                )
            }.getOrNull()
        }
    }
}

@Composable
fun HashtagDiscoveryScreen(
    isDarkMode: Boolean,
    hashtag: String,
    onBack: () -> Unit,
    viewModel: HashtagDiscoveryViewModel = viewModel()
) {
    val ui by viewModel.uiState.collectAsState()
    val bg = if (isDarkMode) Color(0xFF0F0F0F) else Color.White
    val fg = if (isDarkMode) Color.White else Color.Black
    val secondary = fg.copy(0.6f)
    val accent = Color(0xFF00A3FF)
    val gridState = rememberLazyGridState()

    LaunchedEffect(hashtag) { viewModel.start(hashtag) }

    val shouldLoadMore by remember {
        derivedStateOf {
            val total = gridState.layoutInfo.totalItemsCount
            val last = gridState.layoutInfo.visibleItemsInfo.lastOrNull()?.index ?: 0
            total > 0 && last >= total - 6
        }
    }
    LaunchedEffect(shouldLoadMore) {
        if (shouldLoadMore && ui.hasMore && !ui.isLoadingMore) viewModel.loadMore()
    }

    Column(modifier = Modifier.fillMaxSize().background(bg)) {
        Row(
            modifier = Modifier.fillMaxWidth().statusBarsPadding().padding(horizontal = 8.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, null, tint = fg) }
            Column(modifier = Modifier.weight(1f)) {
                Text("#${ui.hashtag}", color = fg, fontSize = 17.sp, fontWeight = FontWeight.Bold)
                Text(
                    if (ui.totalCount > 0) "${ui.totalCount} ta post" else "Hashtag",
                    color = secondary, fontSize = 12.sp
                )
            }
        }
        HorizontalDivider(color = fg.copy(0.06f))

        when {
            ui.isLoading -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = accent, strokeWidth = 2.5.dp, modifier = Modifier.size(36.dp))
            }

            ui.error != null && ui.posts.isEmpty() -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(ui.error ?: "", color = secondary, fontSize = 14.sp)
                    Spacer(Modifier.height(8.dp))
                    TextButton(onClick = { viewModel.loadMore() }) { Text("Qayta urinish", color = accent) }
                }
            }

            ui.posts.isEmpty() -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Icon(Icons.Default.PhotoLibrary, null, tint = secondary, modifier = Modifier.size(48.dp))
                    Text("Hech qanday post topilmadi", color = secondary, fontSize = 14.sp)
                }
            }

            else -> LazyVerticalGrid(
                state = gridState,
                columns = GridCells.Fixed(3),
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(2.dp),
                horizontalArrangement = Arrangement.spacedBy(2.dp),
                verticalArrangement = Arrangement.spacedBy(2.dp)
            ) {
                items(ui.posts, key = { it.id }) { post ->
                    Box(
                        modifier = Modifier
                            .aspectRatio(1f)
                            .clip(RoundedCornerShape(2.dp))
                            .background(fg.copy(0.05f))
                            .clickable {}
                    ) {
                        if (!post.image.isNullOrBlank()) {
                            AsyncImage(
                                model = post.image,
                                contentDescription = null,
                                modifier = Modifier.fillMaxSize(),
                                contentScale = ContentScale.Crop
                            )
                        }
                        if (post.isVideo) {
                            Icon(
                                Icons.Default.PlayArrow,
                                null,
                                tint = Color.White,
                                modifier = Modifier.align(Alignment.TopEnd).padding(4.dp).size(20.dp)
                            )
                        }
                    }
                }
                if (ui.isLoadingMore) {
                    item(span = { GridItemSpan(maxLineSpan) }) {
                        Box(Modifier.fillMaxWidth().padding(vertical = 14.dp), contentAlignment = Alignment.Center) {
                            CircularProgressIndicator(color = accent, strokeWidth = 2.dp, modifier = Modifier.size(22.dp))
                        }
                    }
                }
            }
        }
    }
}
