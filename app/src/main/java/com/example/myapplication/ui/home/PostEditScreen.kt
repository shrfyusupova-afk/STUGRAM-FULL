package com.example.myapplication.ui.home

import android.net.Uri
import androidx.compose.animation.*
import androidx.compose.animation.core.tween
import androidx.compose.foundation.*
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.gestures.detectTransformGestures
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.*
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.*
import coil.compose.AsyncImage
import kotlin.math.roundToInt

private enum class EditSheet { AUDIO, TEXT, FILTER, ADJUST }

@Composable
fun PostEditScreen(
    imageUri: Uri,
    state: CreatePostState,
    viewModel: CreatePostViewModel,
    onNext: () -> Unit,
    onBack: () -> Unit
) {
    var activeSheet by remember { mutableStateOf<EditSheet?>(null) }
    var showAddTextDialog by remember { mutableStateOf(false) }
    var imageWidthPx by remember { mutableIntStateOf(0) }
    var imageHeightPx by remember { mutableIntStateOf(0) }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black)
    ) {
        Column(modifier = Modifier.fillMaxSize()) {
            // Top bar
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .statusBarsPadding()
                    .padding(horizontal = 4.dp, vertical = 4.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(onClick = onBack) {
                    Icon(Icons.AutoMirrored.Filled.ArrowBack, null, tint = Color.White)
                }
                Text(
                    text = "Tahrirlash",
                    color = Color.White,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 16.sp,
                    modifier = Modifier.weight(1f),
                    textAlign = TextAlign.Center
                )
                TextButton(onClick = onNext) {
                    Text(
                        "Keyingi",
                        color = Color.White,
                        fontWeight = FontWeight.Bold,
                        fontSize = 16.sp
                    )
                    Spacer(Modifier.width(4.dp))
                    Icon(Icons.Default.ArrowForwardIos, null, tint = Color.White, modifier = Modifier.size(14.dp))
                }
            }

            // Image + text overlays
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .aspectRatio(1f)
                    .background(Color.Black)
                    .onGloballyPositioned {
                        imageWidthPx = it.size.width
                        imageHeightPx = it.size.height
                    }
                    .pointerInput(Unit) {
                        detectTapGestures(onTap = { showAddTextDialog = true })
                    }
            ) {
                AsyncImage(
                    model = imageUri,
                    contentDescription = null,
                    modifier = Modifier.fillMaxSize(),
                    contentScale = ContentScale.Crop,
                    colorFilter = buildPostColorFilter(state)
                )

                // "Tap to add text" hint
                if (state.textOverlays.isEmpty()) {
                    Text(
                        text = "Matn qo'shish uchun bosing",
                        color = Color.White.copy(0.55f),
                        fontSize = 15.sp,
                        modifier = Modifier.align(Alignment.Center)
                    )
                }

                // Text overlays
                state.textOverlays.forEach { overlay ->
                    DraggableTextOverlay(
                        overlay = overlay,
                        onMove = { dx, dy -> viewModel.moveTextOverlay(overlay.id, overlay.x + dx, overlay.y + dy) },
                        onScale = { zoom -> viewModel.scaleTextOverlay(overlay.id, overlay.scale * zoom) },
                        onLongPress = { viewModel.removeTextOverlay(overlay.id) }
                    )
                }
            }

            // Selected audio chip
            AnimatedVisibility(
                visible = state.selectedAudio != null,
                enter = slideInVertically(tween(280)) + fadeIn(tween(280)),
                exit = slideOutVertically(tween(200)) + fadeOut(tween(200))
            ) {
                state.selectedAudio?.let { track ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp, vertical = 8.dp)
                            .background(Color.White.copy(0.1f), RoundedCornerShape(12.dp))
                            .padding(horizontal = 12.dp, vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(Icons.Default.MusicNote, null, tint = Color(0xFF4FC3F7), modifier = Modifier.size(18.dp))
                        Spacer(Modifier.width(8.dp))
                        Column(modifier = Modifier.weight(1f)) {
                            Text(track.title, color = Color.White, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                            Text(track.artist, color = Color.White.copy(0.6f), fontSize = 11.sp)
                        }
                        IconButton(onClick = { viewModel.onAudioSelected(null) }) {
                            Icon(Icons.Default.Close, null, tint = Color.White.copy(0.7f), modifier = Modifier.size(18.dp))
                        }
                    }
                }
            }

            Spacer(Modifier.weight(1f))

            // Toolbar
            EditToolbar(
                onAudioClick = { activeSheet = EditSheet.AUDIO },
                onTextClick = { showAddTextDialog = true },
                onFilterClick = { activeSheet = EditSheet.FILTER },
                onAdjustClick = { activeSheet = EditSheet.ADJUST }
            )
        }

        // Bottom sheets
        if (activeSheet != null) {
            when (activeSheet!!) {
                EditSheet.AUDIO -> AudioBottomSheet(
                    selected = state.selectedAudio,
                    onSelect = { viewModel.onAudioSelected(it); activeSheet = null },
                    onDismiss = { activeSheet = null }
                )
                EditSheet.TEXT -> { showAddTextDialog = true; activeSheet = null }
                EditSheet.FILTER -> FilterBottomSheet(
                    imageUri = imageUri,
                    selected = state.selectedFilter,
                    onSelect = viewModel::onFilterSelected,
                    onDismiss = { activeSheet = null }
                )
                EditSheet.ADJUST -> AdjustBottomSheet(
                    brightness = state.brightness,
                    contrast = state.contrast,
                    saturation = state.saturation,
                    onBrightnessChange = viewModel::onBrightnessChange,
                    onContrastChange = viewModel::onContrastChange,
                    onSaturationChange = viewModel::onSaturationChange,
                    onDismiss = { activeSheet = null }
                )
            }
        }
    }

    // Add text dialog
    if (showAddTextDialog) {
        AddTextDialog(
            onConfirm = { text, color ->
                viewModel.addTextOverlay(text, color)
                showAddTextDialog = false
            },
            onDismiss = { showAddTextDialog = false }
        )
    }
}

@Composable
private fun DraggableTextOverlay(
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
            fontSize = (18f * overlay.scale).sp,
            fontWeight = FontWeight.Bold,
            modifier = Modifier
                .background(Color.Black.copy(0.25f), RoundedCornerShape(4.dp))
                .padding(horizontal = 8.dp, vertical = 4.dp)
        )
    }
}

@Composable
private fun EditToolbar(
    onAudioClick: () -> Unit,
    onTextClick: () -> Unit,
    onFilterClick: () -> Unit,
    onAdjustClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(Color(0xFF111111))
            .navigationBarsPadding()
            .padding(horizontal = 8.dp, vertical = 12.dp),
        horizontalArrangement = Arrangement.SpaceEvenly
    ) {
        EditToolItem(icon = Icons.Default.MusicNote, label = "Audio", onClick = onAudioClick)
        EditToolItem(icon = Icons.Default.TextFields, label = "Matn", onClick = onTextClick)
        EditToolItem(icon = Icons.Default.AutoFixHigh, label = "Filter", onClick = onFilterClick)
        EditToolItem(icon = Icons.Default.Tune, label = "Tahrir", onClick = onAdjustClick)
    }
}

@Composable
private fun EditToolItem(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    label: String,
    onClick: () -> Unit
) {
    Column(
        modifier = Modifier
            .clip(RoundedCornerShape(12.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 8.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        Box(
            modifier = Modifier
                .size(48.dp)
                .background(Color.White.copy(0.1f), RoundedCornerShape(14.dp)),
            contentAlignment = Alignment.Center
        ) {
            Icon(icon, null, tint = Color.White, modifier = Modifier.size(24.dp))
        }
        Text(label, color = Color.White.copy(0.8f), fontSize = 11.sp)
    }
}

// ── Audio bottom sheet ───────────────────────────────────────────────────
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AudioBottomSheet(
    selected: AudioTrack?,
    onSelect: (AudioTrack) -> Unit,
    onDismiss: () -> Unit
) {
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        containerColor = Color(0xFF1A1A1A),
        dragHandle = {
            Box(
                modifier = Modifier
                    .padding(top = 12.dp, bottom = 8.dp)
                    .size(36.dp, 4.dp)
                    .background(Color.White.copy(0.2f), CircleShape)
            )
        }
    ) {
        Column(modifier = Modifier.padding(bottom = 24.dp)) {
            Text(
                "Audio qo'shish",
                color = Color.White,
                fontWeight = FontWeight.Bold,
                fontSize = 17.sp,
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
            )
            Text(
                "Tavsiya etilgan qo'shiqlar",
                color = Color.White.copy(0.55f),
                fontSize = 12.sp,
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp)
            )
            Spacer(Modifier.height(4.dp))
            suggestedAudioTracks.forEach { track ->
                val isSelected = selected?.id == track.id
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { onSelect(track) }
                        .background(if (isSelected) Color.White.copy(0.08f) else Color.Transparent)
                        .padding(horizontal = 16.dp, vertical = 12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(
                        modifier = Modifier
                            .size(44.dp)
                            .background(Color(0xFF2A2A2A), RoundedCornerShape(10.dp)),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            if (isSelected) Icons.Default.MusicNote else Icons.Default.MusicNote,
                            null,
                            tint = if (isSelected) Color(0xFF4FC3F7) else Color.White.copy(0.5f),
                            modifier = Modifier.size(22.dp)
                        )
                    }
                    Spacer(Modifier.width(12.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Text(track.title, color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.Medium)
                        Text(
                            "${track.artist} · ${track.duration}",
                            color = Color.White.copy(0.5f),
                            fontSize = 12.sp
                        )
                    }
                    if (isSelected) {
                        Icon(
                            Icons.Default.CheckCircle,
                            null,
                            tint = Color(0xFF4FC3F7),
                            modifier = Modifier.size(20.dp)
                        )
                    }
                }
            }
        }
    }
}

// ── Add text dialog ──────────────────────────────────────────────────────
@Composable
private fun AddTextDialog(
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
        title = {
            Text("Matn qo'shish", color = Color.White, fontWeight = FontWeight.Bold)
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
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
                // Color picker
                Text("Rang:", color = Color.White.copy(0.7f), fontSize = 13.sp)
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

// ── Filter bottom sheet ──────────────────────────────────────────────────
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun FilterBottomSheet(
    imageUri: Uri,
    selected: PostFilter,
    onSelect: (PostFilter) -> Unit,
    onDismiss: () -> Unit
) {
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        containerColor = Color(0xFF1A1A1A),
        dragHandle = {
            Box(
                modifier = Modifier
                    .padding(top = 12.dp, bottom = 8.dp)
                    .size(36.dp, 4.dp)
                    .background(Color.White.copy(0.2f), CircleShape)
            )
        }
    ) {
        Column(modifier = Modifier.padding(bottom = 32.dp)) {
            Text(
                "Filter",
                color = Color.White,
                fontWeight = FontWeight.Bold,
                fontSize = 17.sp,
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
            )
            LazyRow(
                contentPadding = PaddingValues(horizontal = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                items(PostFilter.entries) { filter ->
                    FilterItem(
                        filter = filter,
                        imageUri = imageUri,
                        isSelected = filter == selected,
                        onClick = { onSelect(filter) }
                    )
                }
            }
            Spacer(Modifier.height(16.dp))
        }
    }
}

@Composable
private fun FilterItem(
    filter: PostFilter,
    imageUri: Uri,
    isSelected: Boolean,
    onClick: () -> Unit
) {
    Column(
        modifier = Modifier
            .clickable(onClick = onClick),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Box(
            modifier = Modifier
                .size(80.dp)
                .clip(RoundedCornerShape(12.dp))
                .then(
                    if (isSelected) Modifier.border(2.5.dp, Color(0xFF4FC3F7), RoundedCornerShape(12.dp))
                    else Modifier
                )
        ) {
            val mockState = CreatePostState(selectedFilter = filter)
            AsyncImage(
                model = imageUri,
                contentDescription = null,
                modifier = Modifier.fillMaxSize(),
                contentScale = ContentScale.Crop,
                colorFilter = buildPostColorFilter(mockState)
            )
        }
        Text(
            filter.label,
            color = if (isSelected) Color(0xFF4FC3F7) else Color.White.copy(0.7f),
            fontSize = 11.sp,
            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal
        )
    }
}

// ── Adjust bottom sheet ──────────────────────────────────────────────────
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AdjustBottomSheet(
    brightness: Float,
    contrast: Float,
    saturation: Float,
    onBrightnessChange: (Float) -> Unit,
    onContrastChange: (Float) -> Unit,
    onSaturationChange: (Float) -> Unit,
    onDismiss: () -> Unit
) {
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        containerColor = Color(0xFF1A1A1A),
        dragHandle = {
            Box(
                modifier = Modifier
                    .padding(top = 12.dp, bottom = 8.dp)
                    .size(36.dp, 4.dp)
                    .background(Color.White.copy(0.2f), CircleShape)
            )
        }
    ) {
        Column(
            modifier = Modifier.padding(horizontal = 24.dp, vertical = 8.dp).padding(bottom = 32.dp),
            verticalArrangement = Arrangement.spacedBy(20.dp)
        ) {
            Text(
                "Tahrirlash",
                color = Color.White,
                fontWeight = FontWeight.Bold,
                fontSize = 17.sp
            )
            AdjustSlider("Yorqinlik", brightness, -100f, 100f, Icons.Default.WbSunny, onBrightnessChange)
            AdjustSlider("Kontrast", contrast, 0.5f, 1.5f, Icons.Default.Contrast, onContrastChange)
            AdjustSlider("To'yinganlik", saturation, 0f, 2f, Icons.Default.ColorLens, onSaturationChange)
            Spacer(Modifier.height(8.dp))
        }
    }
}

@Composable
private fun AdjustSlider(
    label: String,
    value: Float,
    min: Float,
    max: Float,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    onValueChange: (Float) -> Unit
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(icon, null, tint = Color.White.copy(0.7f), modifier = Modifier.size(18.dp))
            Spacer(Modifier.width(8.dp))
            Text(label, color = Color.White.copy(0.85f), fontSize = 13.sp)
            Spacer(Modifier.weight(1f))
            Text(
                "${((value - min) / (max - min) * 100).roundToInt()}",
                color = Color(0xFF4FC3F7),
                fontSize = 12.sp,
                fontWeight = FontWeight.Medium
            )
        }
        Slider(
            value = value,
            onValueChange = onValueChange,
            valueRange = min..max,
            colors = SliderDefaults.colors(
                thumbColor = Color(0xFF4FC3F7),
                activeTrackColor = Color(0xFF4FC3F7),
                inactiveTrackColor = Color.White.copy(0.2f)
            )
        )
    }
}

// ── Color filter builder ─────────────────────────────────────────────────
fun buildPostColorFilter(state: CreatePostState): ColorFilter? {
    val isDefault = state.selectedFilter == PostFilter.NORMAL &&
        state.brightness == 0f && state.contrast == 1f && state.saturation == 1f
    if (isDefault) return null

    val matrix = ColorMatrix()

    // Base filter
    when (state.selectedFilter) {
        PostFilter.MONO -> matrix.setToSaturation(0f)
        PostFilter.VIVID -> {
            matrix.setToSaturation(1.5f)
            val v = matrix.values
            v[4] = -10f; v[9] = -10f; v[14] = -10f // slight contrast boost
        }
        PostFilter.COOL -> {
            matrix.setToSaturation(0.95f)
            val v = matrix.values
            v[2] += 0.08f; v[14] += 15f // blue tint
        }
        PostFilter.WARM -> {
            val v = matrix.values
            v[0] = 1.15f; v[4] = 15f  // warm red boost
            v[9] = 5f                   // slight yellow
        }
        PostFilter.FADE -> {
            val v = matrix.values
            v[0] = 0.85f; v[4] = 20f
            v[6] = 0.85f; v[9] = 20f
            v[12] = 0.85f; v[14] = 20f
            matrix.setToSaturation(0.8f)
        }
        PostFilter.NORMAL -> {}
    }

    // Saturation adjustment
    if (state.saturation != 1f) {
        val satMatrix = ColorMatrix()
        satMatrix.setToSaturation(state.saturation)
        matrix.timesAssign(satMatrix)
    }

    // Brightness offset (Android ColorMatrix offsets are in 0-255 space)
    if (state.brightness != 0f) {
        val offset = state.brightness * 1.2f
        val v = matrix.values
        v[4] += offset; v[9] += offset; v[14] += offset
    }

    // Contrast
    if (state.contrast != 1f) {
        val c = state.contrast
        val offset = 128f * (1f - c)
        val contrastMatrix = ColorMatrix(
            floatArrayOf(
                c, 0f, 0f, 0f, offset,
                0f, c, 0f, 0f, offset,
                0f, 0f, c, 0f, offset,
                0f, 0f, 0f, 1f, 0f
            )
        )
        matrix.timesAssign(contrastMatrix)
    }

    return ColorFilter.colorMatrix(matrix)
}
