package com.example.myapplication.ui.home

import android.net.Uri
import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.*
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
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage

@Composable
fun PostPublishScreen(
    imageUri: Uri,
    state: CreatePostState,
    viewModel: CreatePostViewModel,
    onBack: () -> Unit,
    onSuccess: () -> Unit
) {
    val context = LocalContext.current
    var showAudienceMenu by remember { mutableStateOf(false) }
    var showTagPeople by remember { mutableStateOf(false) }
    var tagSearchText by remember { mutableStateOf("") }

    LaunchedEffect(state.isSuccess) {
        if (state.isSuccess) onSuccess()
    }

    Box(modifier = Modifier.fillMaxSize().background(Color(0xFF0F0F0F))) {
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
                    text = "Yangi post",
                    color = Color.White,
                    fontWeight = FontWeight.Bold,
                    fontSize = 17.sp,
                    modifier = Modifier.weight(1f),
                    textAlign = TextAlign.Center
                )
                Spacer(Modifier.width(48.dp))
            }

            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f)
                    .verticalScroll(rememberScrollState())
            ) {
                // Image + caption row
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 12.dp),
                    verticalAlignment = Alignment.Top
                ) {
                    AsyncImage(
                        model = imageUri,
                        contentDescription = null,
                        modifier = Modifier
                            .size(80.dp)
                            .clip(RoundedCornerShape(10.dp)),
                        contentScale = ContentScale.Crop,
                        colorFilter = buildPostColorFilter(state)
                    )
                    Spacer(Modifier.width(12.dp))
                    // Caption
                    OutlinedTextField(
                        value = state.caption,
                        onValueChange = viewModel::onCaptionChange,
                        placeholder = {
                            Text(
                                "Izoh qo'shish...",
                                color = Color.White.copy(0.35f),
                                fontSize = 15.sp
                            )
                        },
                        modifier = Modifier
                            .weight(1f)
                            .heightIn(min = 80.dp),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = Color.White,
                            unfocusedTextColor = Color.White,
                            focusedBorderColor = Color.Transparent,
                            unfocusedBorderColor = Color.Transparent
                        ),
                        textStyle = LocalTextStyle.current.copy(fontSize = 15.sp),
                        maxLines = 8
                    )
                }

                HorizontalDivider(color = Color.White.copy(0.07f))

                // Suggested audio chips
                if (state.selectedAudio != null || true) {
                    Spacer(Modifier.height(8.dp))
                    LazyRow(
                        contentPadding = PaddingValues(horizontal = 16.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        items(suggestedAudioTracks.take(5)) { track ->
                            val isSelected = state.selectedAudio?.id == track.id
                            AudioChip(
                                track = track,
                                isSelected = isSelected,
                                onClick = {
                                    viewModel.onAudioSelected(if (isSelected) null else track)
                                }
                            )
                        }
                    }
                    Spacer(Modifier.height(8.dp))
                    HorizontalDivider(color = Color.White.copy(0.07f))
                }

                // Add audio row
                PublishRow(
                    icon = Icons.Default.MusicNote,
                    label = "Musiqa qo'shish",
                    value = state.selectedAudio?.let { "${it.title} · ${it.artist}" },
                    onClick = { viewModel.onAudioSelected(suggestedAudioTracks.firstOrNull()) }
                )

                HorizontalDivider(color = Color.White.copy(0.07f))

                // Tag people
                PublishRow(
                    icon = Icons.Default.Person,
                    label = "Odam belgilash",
                    value = if (state.taggedUsers.isNotEmpty()) state.taggedUsers.joinToString(", ") { "@$it" } else null,
                    onClick = { showTagPeople = true }
                )

                HorizontalDivider(color = Color.White.copy(0.07f))

                // Add location
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 14.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        Icons.Default.LocationOn,
                        null,
                        tint = Color.White.copy(0.7f),
                        modifier = Modifier.size(22.dp)
                    )
                    Spacer(Modifier.width(14.dp))
                    OutlinedTextField(
                        value = state.location,
                        onValueChange = viewModel::onLocationChange,
                        placeholder = {
                            Text("Joylashuv qo'shish", color = Color.White.copy(0.4f), fontSize = 14.sp)
                        },
                        modifier = Modifier.weight(1f),
                        singleLine = true,
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = Color.White,
                            unfocusedTextColor = Color.White.copy(0.75f),
                            focusedBorderColor = Color.Transparent,
                            unfocusedBorderColor = Color.Transparent
                        )
                    )
                }

                HorizontalDivider(color = Color.White.copy(0.07f))

                // Audience
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { showAudienceMenu = true }
                        .padding(horizontal = 16.dp, vertical = 16.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        Icons.Default.Public,
                        null,
                        tint = Color.White.copy(0.7f),
                        modifier = Modifier.size(22.dp)
                    )
                    Spacer(Modifier.width(14.dp))
                    Text(
                        "Auditoriya",
                        color = Color.White,
                        fontSize = 14.sp,
                        modifier = Modifier.weight(1f)
                    )
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            text = when (state.audience) {
                                "followers" -> "Kuzatuvchilar"
                                else -> "Hamma"
                            },
                            color = Color.White.copy(0.5f),
                            fontSize = 13.sp
                        )
                        Icon(
                            Icons.Default.ChevronRight,
                            null,
                            tint = Color.White.copy(0.35f),
                            modifier = Modifier.size(20.dp)
                        )
                    }
                }

                HorizontalDivider(color = Color.White.copy(0.07f))

                // Error message
                AnimatedVisibility(visible = state.error != null) {
                    state.error?.let {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(16.dp)
                                .background(Color(0xFFFF4B4B).copy(0.12f), RoundedCornerShape(12.dp))
                                .padding(12.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(Icons.Default.Error, null, tint = Color(0xFFFF4B4B), modifier = Modifier.size(18.dp))
                            Spacer(Modifier.width(8.dp))
                            Text(it, color = Color(0xFFFF4B4B), fontSize = 13.sp)
                        }
                    }
                }

                Spacer(Modifier.height(120.dp))
            }
        }

        // Share button
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .align(Alignment.BottomCenter)
                .background(
                    Color(0xFF0F0F0F).copy(0.96f)
                )
                .navigationBarsPadding()
                .padding(horizontal = 16.dp, vertical = 12.dp)
        ) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(56.dp)
                    .shadow(8.dp, RoundedCornerShape(28.dp))
                    .clip(RoundedCornerShape(28.dp))
                    .background(
                        if (state.isLoading) Color(0xFF3A3A3A)
                        else Color(0xFF3897F0)
                    )
                    .clickable(
                        enabled = !state.isLoading,
                        indication = null,
                        interactionSource = remember { MutableInteractionSource() }
                    ) { viewModel.publishPost(context) },
                contentAlignment = Alignment.Center
            ) {
                if (state.isLoading) {
                    CircularProgressIndicator(
                        color = Color.White,
                        modifier = Modifier.size(24.dp),
                        strokeWidth = 2.5.dp
                    )
                } else {
                    Text(
                        "Ulashish",
                        color = Color.White,
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }
        }
    }

    // Audience dropdown
    if (showAudienceMenu) {
        AlertDialog(
            onDismissRequest = { showAudienceMenu = false },
            containerColor = Color(0xFF1E1E1E),
            title = { Text("Auditoriya", color = Color.White, fontWeight = FontWeight.Bold) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    listOf("everyone" to "Hamma", "followers" to "Faqat kuzatuvchilar").forEach { (key, label) ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(10.dp))
                                .background(if (state.audience == key) Color.White.copy(0.1f) else Color.Transparent)
                                .clickable { viewModel.onAudienceChange(key); showAudienceMenu = false }
                                .padding(14.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(label, color = Color.White, fontSize = 15.sp, modifier = Modifier.weight(1f))
                            if (state.audience == key) {
                                Icon(Icons.Default.Check, null, tint = Color(0xFF4FC3F7), modifier = Modifier.size(18.dp))
                            }
                        }
                    }
                }
            },
            confirmButton = {}
        )
    }

    // Tag people dialog
    if (showTagPeople) {
        AlertDialog(
            onDismissRequest = { showTagPeople = false },
            containerColor = Color(0xFF1E1E1E),
            title = { Text("Odam belgilash", color = Color.White, fontWeight = FontWeight.Bold) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    OutlinedTextField(
                        value = tagSearchText,
                        onValueChange = { tagSearchText = it },
                        placeholder = { Text("@username", color = Color.White.copy(0.4f)) },
                        singleLine = true,
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = Color.White,
                            unfocusedTextColor = Color.White,
                            focusedBorderColor = Color(0xFF4FC3F7),
                            unfocusedBorderColor = Color.White.copy(0.2f)
                        ),
                        modifier = Modifier.fillMaxWidth()
                    )
                    if (state.taggedUsers.isNotEmpty()) {
                        Text("Belgilangan:", color = Color.White.copy(0.6f), fontSize = 12.sp)
                        state.taggedUsers.forEach { username ->
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(Color.White.copy(0.08f))
                                    .padding(horizontal = 12.dp, vertical = 8.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text("@$username", color = Color.White, fontSize = 14.sp, modifier = Modifier.weight(1f))
                                IconButton(
                                    onClick = { viewModel.toggleTagUser(username) },
                                    modifier = Modifier.size(24.dp)
                                ) {
                                    Icon(Icons.Default.Close, null, tint = Color.White.copy(0.6f), modifier = Modifier.size(16.dp))
                                }
                            }
                        }
                    }
                }
            },
            confirmButton = {
                TextButton(onClick = {
                    if (tagSearchText.isNotBlank()) {
                        viewModel.toggleTagUser(tagSearchText.trimStart('@'))
                        tagSearchText = ""
                    } else {
                        showTagPeople = false
                    }
                }) {
                    Text(
                        if (tagSearchText.isNotBlank()) "Qo'shish" else "Tayyor",
                        color = Color(0xFF4FC3F7),
                        fontWeight = FontWeight.Bold
                    )
                }
            },
            dismissButton = {
                TextButton(onClick = { showTagPeople = false }) {
                    Text("Yopish", color = Color.White.copy(0.6f))
                }
            }
        )
    }
}

@Composable
private fun PublishRow(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    label: String,
    value: String?,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 16.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(icon, null, tint = Color.White.copy(0.7f), modifier = Modifier.size(22.dp))
        Spacer(Modifier.width(14.dp))
        Text(label, color = Color.White, fontSize = 14.sp, modifier = Modifier.weight(1f))
        if (value != null) {
            Text(value, color = Color.White.copy(0.5f), fontSize = 12.sp)
        }
        Icon(
            Icons.Default.ChevronRight,
            null,
            tint = Color.White.copy(0.35f),
            modifier = Modifier.size(20.dp)
        )
    }
}

@Composable
private fun AudioChip(
    track: AudioTrack,
    isSelected: Boolean,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .clip(RoundedCornerShape(20.dp))
            .background(
                if (isSelected) Color(0xFF3897F0).copy(0.25f) else Color.White.copy(0.08f)
            )
            .border(
                1.dp,
                if (isSelected) Color(0xFF3897F0) else Color.White.copy(0.12f),
                RoundedCornerShape(20.dp)
            )
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        Icon(
            Icons.Default.MusicNote,
            null,
            tint = if (isSelected) Color(0xFF3897F0) else Color.White.copy(0.5f),
            modifier = Modifier.size(14.dp)
        )
        Column {
            Text(
                track.title,
                color = if (isSelected) Color.White else Color.White.copy(0.8f),
                fontSize = 12.sp,
                fontWeight = if (isSelected) FontWeight.SemiBold else FontWeight.Normal
            )
            Text(
                track.artist,
                color = Color.White.copy(0.45f),
                fontSize = 10.sp
            )
        }
    }
}
