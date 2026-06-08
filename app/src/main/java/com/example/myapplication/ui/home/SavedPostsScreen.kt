package com.example.myapplication.ui.home

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.BookmarkBorder
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

data class SavedPostsUiState(
    val isLoading: Boolean = false,
    val error: String? = null,
    val items: List<PostData> = emptyList()
)

class SavedPostsViewModel(
    private val authApi: AuthApi = RetrofitClient.instance,
    private val ioDispatcher: CoroutineDispatcher = Dispatchers.IO
) : ViewModel() {

    private val _uiState = MutableStateFlow(SavedPostsUiState())
    val uiState: StateFlow<SavedPostsUiState> = _uiState.asStateFlow()

    init { load() }

    fun load() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }
            try {
                val resp = withContext(ioDispatcher) { authApi.getSavedPosts(page = 1, limit = 30) }
                if (resp.isSuccessful) {
                    _uiState.update { it.copy(isLoading = false, items = parse(resp.body())) }
                } else {
                    _uiState.update { it.copy(isLoading = false, error = "Yuklab bo'lmadi (${resp.code()})") }
                }
            } catch (e: Exception) {
                _uiState.update { it.copy(isLoading = false, error = "Tarmoq xatosi") }
            }
        }
    }

    fun unsave(postId: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(items = it.items.filterNot { p -> p.id == postId }) }
            try { withContext(ioDispatcher) { authApi.unsavePost(postId) } } catch (_: Exception) {}
        }
    }

    private fun parse(body: JsonObject?): List<PostData> {
        val data = body?.getAsJsonArray("data") ?: return emptyList()
        return data.mapNotNull { el ->
            runCatching {
                val obj = el.asJsonObject
                val id = obj.get("_id")?.takeIf { !it.isJsonNull }?.asString ?: return@runCatching null
                val author = if (obj.has("author") && !obj.get("author").isJsonNull) obj.getAsJsonObject("author") else null
                val media = if (obj.has("media") && obj.get("media").isJsonArray) obj.getAsJsonArray("media") else null
                val firstMedia = media?.firstOrNull()?.asJsonObject
                val imageUrl = firstMedia?.let {
                    it.get("url")?.takeIf { v -> !v.isJsonNull }?.asString
                        ?: it.get("secureUrl")?.takeIf { v -> !v.isJsonNull }?.asString
                }
                val isVideo = firstMedia?.get("type")?.takeIf { !it.isJsonNull }?.asString == "video"
                PostData(
                    id = id,
                    user = author?.get("username")?.takeIf { !it.isJsonNull }?.asString ?: "user",
                    image = imageUrl,
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
fun SavedPostsScreen(
    isDarkMode: Boolean,
    onBack: () -> Unit,
    viewModel: SavedPostsViewModel = viewModel()
) {
    val ui by viewModel.uiState.collectAsState()
    val bg = if (isDarkMode) Color(0xFF0F0F0F) else Color.White
    val fg = if (isDarkMode) Color.White else Color.Black
    val accent = Color(0xFF00A3FF)

    Column(modifier = Modifier.fillMaxSize().background(bg)) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .statusBarsPadding()
                .padding(horizontal = 8.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            IconButton(onClick = onBack) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, null, tint = fg)
            }
            Text("Saqlanganlar", color = fg, fontSize = 18.sp, fontWeight = FontWeight.Bold)
        }
        HorizontalDivider(color = fg.copy(0.06f))

        when {
            ui.isLoading -> Box(
                Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center
            ) { CircularProgressIndicator(color = accent, strokeWidth = 2.5.dp, modifier = Modifier.size(36.dp)) }

            ui.error != null && ui.items.isEmpty() -> Box(
                Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(ui.error ?: "", color = fg.copy(0.6f), fontSize = 14.sp)
                    Spacer(Modifier.height(8.dp))
                    TextButton(onClick = { viewModel.load() }) { Text("Qayta urinish", color = accent) }
                }
            }

            ui.items.isEmpty() -> Box(
                Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Icon(Icons.Default.BookmarkBorder, null, tint = fg.copy(0.4f), modifier = Modifier.size(48.dp))
                    Text("Saqlangan postlar yo'q", color = fg.copy(0.7f), fontSize = 14.sp)
                    Text("Postlarni saqlash uchun bookmark ikonkasini bosing", color = fg.copy(0.4f), fontSize = 11.sp)
                }
            }

            else -> LazyVerticalGrid(
                columns = GridCells.Fixed(3),
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(2.dp),
                horizontalArrangement = Arrangement.spacedBy(2.dp),
                verticalArrangement = Arrangement.spacedBy(2.dp)
            ) {
                items(ui.items, key = { it.id }) { post ->
                    Box(
                        modifier = Modifier
                            .aspectRatio(1f)
                            .clip(RoundedCornerShape(2.dp))
                            .background(fg.copy(0.05f))
                            .clickable { viewModel.unsave(post.id) }
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
                                modifier = Modifier
                                    .align(Alignment.TopEnd)
                                    .padding(4.dp)
                                    .size(20.dp)
                            )
                        }
                    }
                }
            }
        }
    }
}
