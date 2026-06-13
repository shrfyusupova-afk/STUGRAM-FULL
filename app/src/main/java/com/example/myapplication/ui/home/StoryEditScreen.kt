package com.example.myapplication.ui.home

import android.net.Uri
import androidx.compose.animation.*
import androidx.compose.animation.core.tween
import androidx.compose.foundation.*
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.gestures.detectTransformGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import kotlin.math.roundToInt

/**
 * Story posting flow:
 * - Full-screen 9:16 preview (image)
 * - Tap canvas → add text overlay (draggable, resizable)
 * - Bottom "Share to your story" pill button (one-tap publish)
 * - No caption screen, no audience picker — quick & instant
 */
@Composable
fun StoryEditScreen(
    imageUri: Uri,
    state: CreatePostState,
    viewModel: CreatePostViewModel,
    onBack: () -> Unit,
    onSuccess: () -> Unit
) {
    val context = LocalContext.current
    var showAddTextDialog by remember { mutableStateOf(false) }

    LaunchedEffect(state.isSuccess) {
        if (state.isSuccess) onSuccess()
    }

    Box(modifier = Modifier.fillMaxSize().background(Color.Black)) {
        // Full-screen image
        AsyncImage(
            model = imageUri,
            contentDescription = null,
            modifier = Modifier
                .fillMaxSize()
                .pointerInput(Unit) {
                    detectTapGestures(onTap = { showAddTextDialog = true })
                },
            contentScale = ContentScale.Crop
        )

        // Hint when no overlays
        if (state.textOverlays.isEmpty()) {
            Text(
                text = "Matn qo'shish uchun bosing",
                color = Color.White.copy(0.7f),
                fontSize = 14.sp,
                modifier = Modifier
                    .align(Alignment.Center)
                    .background(Color.Black.copy(0.35f), RoundedCornerShape(14.dp))
                    .padding(horizontal = 14.dp, vertical = 8.dp)
            )
        }

        // Text overlays
        state.textOverlays.forEach { overlay ->
            StoryTextOverlayItem(
                overlay = overlay,
                onMove = { dx, dy -> viewModel.moveTextOverlay(overlay.id, overlay.x + dx, overlay.y + dy) },
                onScale = { zoom -> viewModel.scaleTextOverlay(overlay.id, overlay.scale * zoom) },
                onLongPress = { viewModel.removeTextOverlay(overlay.id) }
            )
        }

        // Top bar
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .statusBarsPadding()
                .padding(horizontal = 8.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            StoryTopIconButton(onClick = onBack) {
                Icon(Icons.Default.Close, null, tint = Color.White, modifier = Modifier.size(24.dp))
            }
            Spacer(Modifier.weight(1f))
            StoryTopIconButton(onClick = { showAddTextDialog = true }) {
                Icon(Icons.Default.TextFields, null, tint = Color.White, modifier = Modifier.size(22.dp))
            }
        }

        // Error banner
        AnimatedVisibility(
            visible = state.error != null,
            modifier = Modifier
                .align(Alignment.TopCenter)
                .statusBarsPadding()
                .padding(top = 60.dp)
        ) {
            state.error?.let {
                Box(
                    modifier = Modifier
                        .padding(horizontal = 24.dp)
                        .background(Color(0xFFFF4B4B).copy(0.85f), RoundedCornerShape(12.dp))
                        .padding(horizontal = 14.dp, vertical = 8.dp)
                ) {
                    Text(it, color = Color.White, fontSize = 12.sp)
                }
            }
        }

        // Bottom Share button
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .align(Alignment.BottomCenter)
                .navigationBarsPadding()
                .padding(bottom = 20.dp, start = 16.dp, end = 16.dp),
            contentAlignment = Alignment.Center
        ) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(54.dp)
                    .clip(RoundedCornerShape(28.dp))
                    .background(
                        if (state.isLoading) Color(0xFF3A3A3A) else Color(0xFF3897F0)
                    )
                    .clickable(enabled = !state.isLoading) {
                        viewModel.publishStory(context)
                    },
                contentAlignment = Alignment.Center
            ) {
                if (state.isLoading) {
                    CircularProgressIndicator(
                        color = Color.White,
                        strokeWidth = 2.5.dp,
                        modifier = Modifier.size(22.dp)
                    )
                } else {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.Add, null, tint = Color.White, modifier = Modifier.size(20.dp))
                        Spacer(Modifier.width(6.dp))
                        Text(
                            "Story sifatida ulashish",
                            color = Color.White,
                            fontSize = 15.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }
        }
    }

    if (showAddTextDialog) {
        StoryAddTextDialog(
            onConfirm = { text, color ->
                viewModel.addTextOverlay(text, color)
                showAddTextDialog = false
            },
            onDismiss = { showAddTextDialog = false }
        )
    }
}

@Composable
private fun StoryTopIconButton(
    onClick: () -> Unit,
    content: @Composable BoxScope.() -> Unit
) {
    Box(
        modifier = Modifier
            .size(40.dp)
            .background(Color.Black.copy(0.4f), CircleShape)
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
        content = content
    )
}

@Composable
private fun StoryTextOverlayItem(
    overlay: TextOverlay,
    onMove: (Float, Float) -> Unit,
    onScale: (Float) -> Unit,
    onLongPress: () -> Unit
) {
    Box(
        modifier = Modifier
            .offset { IntOffset(overlay.x.roundToInt(), overlay.y.roundToInt()) }
            .pointerInput(overlay.id) {
                detectTransformGestures { _, pan, zoom, _ ->
                    onMove(pan.x, pan.y)
                    if (zoom != 1f) onScale(zoom)
                }
            }
            .pointerInput(overlay.id) {
                detectTapGestures(onLongPress = { onLongPress() })
            }
    ) {
        Text(
            text = overlay.text,
            color = overlay.color,
            fontSize = (22f * overlay.scale).sp,
            fontWeight = FontWeight.Bold,
            modifier = Modifier
                .background(Color.Black.copy(0.3f), RoundedCornerShape(6.dp))
                .padding(horizontal = 10.dp, vertical = 6.dp)
        )
    }
}

@Composable
private fun StoryAddTextDialog(
    onConfirm: (String, Color) -> Unit,
    onDismiss: () -> Unit
) {
    var text by remember { mutableStateOf("") }
    var selectedColor by remember { mutableStateOf(Color.White) }
    val colors = listOf(
        Color.White, Color.Black, Color(0xFFFF4B4B), Color(0xFF4FC3F7),
        Color(0xFF66BB6A), Color(0xFFFFD54F), Color(0xFFCE93D8)
    )

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = Color(0xFF1E1E1E),
        title = { Text("Matn qo'shish", color = Color.White, fontWeight = FontWeight.Bold) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
                OutlinedTextField(
                    value = text,
                    onValueChange = { text = it },
                    placeholder = { Text("Matn kiriting...", color = Color.White.copy(0.4f)) },
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = selectedColor,
                        unfocusedTextColor = selectedColor,
                        focusedBorderColor = Color.White.copy(0.3f),
                        unfocusedBorderColor = Color.White.copy(0.15f)
                    ),
                    modifier = Modifier.fillMaxWidth()
                )
                Text("Rang", color = Color.White.copy(0.7f), fontSize = 13.sp)
                LazyRow(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    items(colors) { color ->
                        Box(
                            modifier = Modifier
                                .size(32.dp)
                                .background(color, CircleShape)
                                .then(
                                    if (selectedColor == color)
                                        Modifier.border(2.5.dp, Color.White, CircleShape)
                                    else Modifier
                                )
                                .clickable { selectedColor = color }
                        )
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = { if (text.isNotBlank()) onConfirm(text, selectedColor) }) {
                Text("Qo'shish", color = Color(0xFF4FC3F7), fontWeight = FontWeight.Bold)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Bekor", color = Color.White.copy(0.6f))
            }
        }
    )
}
