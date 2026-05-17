package com.example.myapplication.ui.home

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
fun StoryViewerModal(
    storyProfiles: List<StoryProfile>,
    startProfileIndex: Int,
    isDarkMode: Boolean,
    accentBlue: Color,
    myStoryViewers: List<StoryActivityUser>,
    myStoryLikes: List<StoryActivityUser>,
    myStoryComments: List<StoryActivityUser>,
    onDismiss: () -> Unit
) {
    val bg = if (isDarkMode) Color(0xFF0F0F0F) else Color.White
    val fg = if (isDarkMode) Color.White else Color.Black

    Box(modifier = Modifier.fillMaxSize().background(bg), contentAlignment = Alignment.Center) {
        Card(
            modifier = Modifier.padding(horizontal = 24.dp),
            shape = RoundedCornerShape(20.dp),
            colors = CardDefaults.cardColors(containerColor = fg.copy(alpha = 0.08f))
        ) {
            Column(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 24.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text(
                    text = "Stories are disabled for this alpha",
                    color = fg,
                    fontWeight = FontWeight.Bold,
                    fontSize = 18.sp,
                    textAlign = TextAlign.Center
                )
                Spacer(Modifier.height(8.dp))
                Text(
                    text = "Story viewer will be enabled after backend-backed story reliability is ready.",
                    color = fg.copy(alpha = 0.75f),
                    fontSize = 13.sp,
                    textAlign = TextAlign.Center
                )
                Spacer(Modifier.height(16.dp))
                Button(onClick = onDismiss, colors = ButtonDefaults.buttonColors(containerColor = accentBlue)) {
                    Text("Close", color = Color.White)
                }
            }
        }
    }
}
