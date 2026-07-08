package com.example.myapplication.ui.create

import android.net.Uri
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import coil.compose.AsyncImage

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CreatePostScreen(
    type: CreateType,
    isDarkMode: Boolean,
    onClose: () -> Unit,
    onPosted: () -> Unit,
    initialMedia: List<Uri> = emptyList(),
    initialIsVideo: Boolean = false,
    onBackToCapture: (() -> Unit)? = null,
    viewModel: CreatePostViewModel = viewModel()
) {
    val context = LocalContext.current
    val accentBlue = Color(0xFF00A3FF)
    val bg = if (isDarkMode) Color(0xFF0F0F0F) else Color.White
    val fg = if (isDarkMode) Color.White else Color.Black

    LaunchedEffect(Unit) {
        viewModel.init(type)
        if (initialMedia.isNotEmpty()) viewModel.setMedia(initialMedia, initialIsVideo)
    }

    val singlePicker = rememberLauncherForActivityResult(
        ActivityResultContracts.PickVisualMedia()
    ) { uri ->
        if (uri != null) viewModel.setMedia(listOf(uri), isVideo = false)
        else if (viewModel.mediaUris.isEmpty()) onClose()
    }
    val multiPicker = rememberLauncherForActivityResult(
        ActivityResultContracts.PickMultipleVisualMedia(10)
    ) { uris ->
        if (uris.isNotEmpty()) viewModel.setMedia(uris, isVideo = false)
        else if (viewModel.mediaUris.isEmpty()) onClose()
    }

    // Fallback: opened without pre-captured media -> system photo picker
    // (needs no runtime permission).
    var launched by rememberSaveable { mutableStateOf(false) }
    LaunchedEffect(launched) {
        if (!launched && initialMedia.isEmpty()) {
            launched = true
            val request = PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)
            if (type == CreateType.STORY) singlePicker.launch(request) else multiPicker.launch(request)
        }
    }

    val uploadState = viewModel.uploadState
    val isUploading = uploadState is UploadUiState.Uploading || uploadState is UploadUiState.Preparing
    // Back returns to the camera step when there is one; X closes the flow.
    BackHandler(enabled = !isUploading) { onBackToCapture?.invoke() ?: onClose() }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(bg)
            .statusBarsPadding()
            .navigationBarsPadding()
    ) {
        Column(modifier = Modifier.fillMaxSize()) {
            // --- Top bar ---
            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                IconButton(onClick = onClose, enabled = !isUploading) {
                    Icon(Icons.Default.Close, contentDescription = "Yopish", tint = fg)
                }
                Text(
                    text = when (type) {
                        CreateType.STORY -> "Yangi story"
                        CreateType.REEL -> "Yangi reel"
                        CreateType.POST -> "Yangi post"
                    },
                    color = fg,
                    fontWeight = FontWeight.Bold,
                    fontSize = 18.sp
                )
                val canShare = viewModel.mediaUris.isNotEmpty() &&
                    (uploadState is UploadUiState.Idle || uploadState is UploadUiState.Error)
                TextButton(
                    onClick = { viewModel.share(context) { onPosted(); onClose() } },
                    enabled = canShare
                ) {
                    Text(
                        "Ulashish",
                        color = if (canShare) accentBlue else fg.copy(alpha = 0.4f),
                        fontWeight = FontWeight.Bold
                    )
                }
            }

            // --- Preview ---
            Box(
                modifier = Modifier.fillMaxWidth().weight(1f),
                contentAlignment = Alignment.Center
            ) {
                val uris = viewModel.mediaUris
                if (uris.isEmpty()) {
                    CircularProgressIndicator(color = accentBlue)
                } else if (viewModel.isVideo) {
                    // Captured/picked video: looping preview with tap-to-unmute.
                    com.example.myapplication.ui.video.FeedVideoPlayer(
                        videoUrl = uris.first().toString(),
                        isActive = true,
                        modifier = Modifier.fillMaxSize(),
                        accent = accentBlue
                    )
                } else {
                    val pagerState = rememberPagerState(pageCount = { uris.size })
                    HorizontalPager(state = pagerState, modifier = Modifier.fillMaxSize()) { page ->
                        AsyncImage(
                            model = uris[page],
                            contentDescription = null,
                            modifier = Modifier.fillMaxSize(),
                            contentScale = ContentScale.Fit
                        )
                    }
                    if (uris.size > 1) {
                        Row(
                            modifier = Modifier
                                .align(Alignment.BottomCenter)
                                .padding(bottom = 12.dp),
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            repeat(uris.size) { index ->
                                val selected = pagerState.currentPage == index
                                Box(
                                    modifier = Modifier
                                        .size(if (selected) 8.dp else 6.dp)
                                        .clip(CircleShape)
                                        .background(if (selected) accentBlue else fg.copy(alpha = 0.3f))
                                )
                            }
                        }
                    }
                }
            }

            // --- Caption ---
            OutlinedTextField(
                value = viewModel.caption,
                onValueChange = viewModel::onCaptionChange,
                enabled = !isUploading,
                label = { Text("Izoh (ixtiyoriy)") },
                modifier = Modifier.fillMaxWidth().padding(16.dp),
                minLines = 2,
                maxLines = 4
            )

            // --- Status / progress / error ---
            when (val state = uploadState) {
                is UploadUiState.Preparing -> {
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        CircularProgressIndicator(color = accentBlue, strokeWidth = 2.dp, modifier = Modifier.size(18.dp))
                        Spacer(Modifier.width(12.dp))
                        Text("Media tayyorlanmoqda...", color = fg.copy(alpha = 0.8f), fontSize = 13.sp)
                    }
                }
                is UploadUiState.Uploading -> {
                    Column(modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp)) {
                        LinearProgressIndicator(
                            progress = { state.progress },
                            modifier = Modifier.fillMaxWidth(),
                            color = accentBlue
                        )
                        Spacer(Modifier.height(6.dp))
                        Text("${(state.progress * 100).toInt()}%", color = fg.copy(alpha = 0.7f), fontSize = 12.sp)
                    }
                }
                is UploadUiState.Error -> {
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(state.message, color = Color(0xFFE53935), fontSize = 13.sp, modifier = Modifier.weight(1f))
                        Spacer(Modifier.width(12.dp))
                        Button(
                            onClick = { viewModel.retry(context) { onPosted(); onClose() } },
                            colors = ButtonDefaults.buttonColors(containerColor = accentBlue)
                        ) { Text("Qayta urinish", color = Color.White) }
                    }
                }
                else -> Spacer(Modifier.height(4.dp))
            }
            Spacer(Modifier.height(8.dp))
        }
    }
}
