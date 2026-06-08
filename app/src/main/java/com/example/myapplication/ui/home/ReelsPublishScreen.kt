package com.example.myapplication.ui.home

import android.net.Uri
import androidx.compose.animation.*
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage

/**
 * Reels publish flow:
 * - Big vertical (9:16) video thumbnail at top
 * - Single-line "Catch reels music" suggestion strip
 * - Caption field (scrollable, full-width)
 * - Audience pill row (Public / Followers)
 * - Bottom "Share Reel" pill button
 *
 * Distinct from PostPublish — no thumbnail+caption row, no location, no tag people dialog;
 * the focus is the video and a short caption like TikTok / IG Reels.
 */
@Composable
fun ReelsPublishScreen(
    videoUri: Uri,
    state: CreatePostState,
    viewModel: CreatePostViewModel,
    onBack: () -> Unit,
    onSuccess: () -> Unit
) {
    val context = LocalContext.current

    LaunchedEffect(state.isSuccess) {
        if (state.isSuccess) onSuccess()
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF0A0A0A))
            .imePadding()
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
                    text = "Yangi Reel",
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
                    .padding(horizontal = 16.dp)
            ) {
                Spacer(Modifier.height(8.dp))

                // Video poster — 9:16 thumbnail with play overlay
                Box(
                    modifier = Modifier
                        .fillMaxWidth(0.7f)
                        .aspectRatio(9f / 16f)
                        .align(Alignment.CenterHorizontally)
                        .clip(RoundedCornerShape(18.dp))
                        .background(Color.Black),
                    contentAlignment = Alignment.Center
                ) {
                    AsyncImage(
                        model = videoUri,
                        contentDescription = null,
                        modifier = Modifier.fillMaxSize().background(
                            Brush.linearGradient(
                                listOf(Color(0xFF1A1A2E), Color(0xFF16213E))
                            )
                        )
                    )
                    Box(
                        modifier = Modifier
                            .size(60.dp)
                            .background(Color.Black.copy(0.5f), CircleShape)
                            .border(2.dp, Color.White.copy(0.55f), CircleShape),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            Icons.Default.PlayArrow,
                            null,
                            tint = Color.White,
                            modifier = Modifier.size(34.dp)
                        )
                    }
                    // 9:16 chip
                    Box(
                        modifier = Modifier
                            .align(Alignment.TopEnd)
                            .padding(8.dp)
                            .background(Color.Black.copy(0.55f), RoundedCornerShape(8.dp))
                            .padding(horizontal = 8.dp, vertical = 3.dp)
                    ) {
                        Text("9:16", color = Color.White, fontSize = 10.sp, fontWeight = FontWeight.ExtraBold)
                    }
                }

                Spacer(Modifier.height(20.dp))

                // Caption — full-width, internally scrollable
                Text(
                    "Tavsif",
                    color = Color.White.copy(0.7f),
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold
                )
                Spacer(Modifier.height(6.dp))
                OutlinedTextField(
                    value = state.caption,
                    onValueChange = viewModel::onCaptionChange,
                    placeholder = {
                        Text(
                            "Reel haqida bir narsa yozing... #hashtag",
                            color = Color.White.copy(0.35f),
                            fontSize = 14.sp
                        )
                    },
                    modifier = Modifier
                        .fillMaxWidth()
                        .heightIn(min = 100.dp, max = 180.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = Color.White,
                        unfocusedTextColor = Color.White,
                        focusedBorderColor = Color(0xFFFF3B6B).copy(0.5f),
                        unfocusedBorderColor = Color.White.copy(0.08f),
                        focusedContainerColor = Color.White.copy(0.04f),
                        unfocusedContainerColor = Color.White.copy(0.04f),
                        cursorColor = Color(0xFFFF3B6B)
                    ),
                    shape = RoundedCornerShape(14.dp),
                    textStyle = LocalTextStyle.current.copy(fontSize = 14.sp, lineHeight = 20.sp)
                )

                Spacer(Modifier.height(16.dp))

                // Audience pills
                Text("Kim ko'ra oladi", color = Color.White.copy(0.7f), fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                Spacer(Modifier.height(6.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    ReelsAudienceChip(
                        label = "Hamma",
                        icon = Icons.Default.Public,
                        active = state.audience == "everyone",
                        onClick = { viewModel.onAudienceChange("everyone") }
                    )
                    ReelsAudienceChip(
                        label = "Kuzatuvchilar",
                        icon = Icons.Default.People,
                        active = state.audience == "followers",
                        onClick = { viewModel.onAudienceChange("followers") }
                    )
                }

                Spacer(Modifier.height(20.dp))

                // Error
                AnimatedVisibility(visible = state.error != null) {
                    state.error?.let {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
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

        // Bottom Share button
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .align(Alignment.BottomCenter)
                .background(Color(0xFF0A0A0A).copy(0.96f))
                .navigationBarsPadding()
                .padding(horizontal = 16.dp, vertical = 12.dp)
        ) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(54.dp)
                    .clip(RoundedCornerShape(28.dp))
                    .background(
                        if (state.isLoading) Color(0xFF3A3A3A) else Color(0xFFFF3B6B)
                    )
                    .clickable(enabled = !state.isLoading) {
                        viewModel.publishReel(context)
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
                        Icon(Icons.Default.PlayArrow, null, tint = Color.White, modifier = Modifier.size(22.dp))
                        Spacer(Modifier.width(6.dp))
                        Text("Reel ulashish", color = Color.White, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}

@Composable
private fun ReelsAudienceChip(
    label: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    active: Boolean,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .clip(RoundedCornerShape(20.dp))
            .background(if (active) Color(0xFFFF3B6B).copy(0.18f) else Color.White.copy(0.06f))
            .border(
                1.dp,
                if (active) Color(0xFFFF3B6B) else Color.White.copy(0.1f),
                RoundedCornerShape(20.dp)
            )
            .clickable(onClick = onClick)
            .padding(horizontal = 14.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(
            icon,
            null,
            tint = if (active) Color(0xFFFF3B6B) else Color.White.copy(0.6f),
            modifier = Modifier.size(15.dp)
        )
        Spacer(Modifier.width(6.dp))
        Text(
            label,
            color = if (active) Color.White else Color.White.copy(0.75f),
            fontSize = 13.sp,
            fontWeight = if (active) FontWeight.Bold else FontWeight.Medium
        )
    }
}
