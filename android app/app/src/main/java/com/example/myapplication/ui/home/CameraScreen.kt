package com.example.myapplication.ui.home

import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import kotlinx.coroutines.launch

@Composable
fun CameraScreen(
    onDismiss: () -> Unit,
    accentBlue: Color
) {
    val modes = listOf("POST", "STORY", "REELS")
    val pagerState = rememberPagerState(pageCount = { modes.size }, initialPage = 1)
    val scope = rememberCoroutineScope()

    Box(modifier = Modifier.fillMaxSize().background(Color.Black)) {
        // --- KAMERA PREVIEW (Simulyatsiya) ---
        Box(modifier = Modifier.fillMaxSize()) {
            Box(modifier = Modifier.fillMaxSize().background(
                Brush.verticalGradient(listOf(Color(0xFF1A1A1A), Color.Black))
            ))
            Text(
                "KAMERA ISHLAMOQDA...",
                color = Color.White.copy(alpha = 0.3f),
                modifier = Modifier.align(Alignment.Center),
                fontWeight = FontWeight.Bold,
                fontSize = 20.sp
            )
        }

        // --- TOP CONTROLS ---
        Row(
            modifier = Modifier.fillMaxWidth().statusBarsPadding().padding(16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            IconButton(onClick = onDismiss) {
                Icon(Icons.Default.Close, null, tint = Color.White, modifier = Modifier.size(32.dp))
            }
            IconButton(onClick = { }) {
                Icon(Icons.Default.FlashOn, null, tint = Color.White)
            }
            IconButton(onClick = { }) {
                Icon(Icons.Default.Settings, null, tint = Color.White)
            }
        }

        // --- BOTTOM CONTROLS ---
        Column(
            modifier = Modifier.align(Alignment.BottomCenter).navigationBarsPadding().padding(bottom = 30.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // Shutter Button
            Box(
                modifier = Modifier
                    .size(85.dp)
                    .border(5.dp, Color.White, CircleShape)
                    .padding(8.dp)
                    .clip(CircleShape)
                    .background(Color.White)
                    .clickable { /* Capture */ }
            )

            Spacer(Modifier.height(30.dp))

            // Modes Slider (Post, Story, Reels)
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.Center,
                verticalAlignment = Alignment.CenterVertically
            ) {
                modes.forEachIndexed { index, mode ->
                    val isSelected = pagerState.currentPage == index
                    val alpha by animateFloatAsState(if (isSelected) 1f else 0.5f, label = "alpha")
                    val scale by animateFloatAsState(if (isSelected) 1.1f else 0.9f, label = "scale")

                    Text(
                        text = mode,
                        color = Color.White.copy(alpha = alpha),
                        fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                        fontSize = 14.sp,
                        modifier = Modifier
                            .padding(horizontal = 12.dp)
                            .graphicsLayer(scaleX = scale, scaleY = scale)
                            .clickable {
                                scope.launch { pagerState.animateScrollToPage(index) }
                            }
                    )
                }
            }
        }

        // --- GALLERY BUTTON ---
        Box(
            modifier = Modifier
                .align(Alignment.BottomStart)
                .navigationBarsPadding()
                .padding(start = 30.dp, bottom = 110.dp)
                .size(48.dp)
                .clip(RoundedCornerShape(12.dp))
                .border(2.dp, Color.White, RoundedCornerShape(12.dp))
                .background(Color.DarkGray)
                .clickable { /* Open Gallery */ },
            contentAlignment = Alignment.Center
        ) {
            AsyncImage(
                model = "https://picsum.photos/seed/gallery/100/100",
                contentDescription = null,
                contentScale = ContentScale.Crop
            )
        }

        // --- FLIP CAMERA ---
        IconButton(
            onClick = { },
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .navigationBarsPadding()
                .padding(end = 30.dp, bottom = 110.dp)
                .size(48.dp)
                .background(Color.White.copy(0.2f), CircleShape)
        ) {
            Icon(Icons.Default.FlipCameraAndroid, null, tint = Color.White)
        }
    }
}
