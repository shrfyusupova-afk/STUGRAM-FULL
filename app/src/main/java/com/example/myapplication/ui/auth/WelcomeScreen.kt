package com.example.myapplication.ui.auth

import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.*
import androidx.compose.ui.draw.blur
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.myapplication.R
import com.example.myapplication.ui.auth.components.*

@Composable
fun WelcomeScreen(
    onLoginClick: () -> Unit,
    onRegisterClick: () -> Unit
) {
    var startAnimation by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) { startAnimation = true }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFFF0F2F5))
    ) {
        // Setka (grid) fon
        Canvas(modifier = Modifier.fillMaxSize()) {
            val step = 50.dp.toPx()
            val gridColor = Color(0xFFE2E8F0)
            for (x in 0..size.width.toInt() step step.toInt()) {
                drawLine(gridColor, Offset(x.toFloat(), 0f), Offset(x.toFloat(), size.height), 1f)
            }
            for (y in 0..size.height.toInt() step step.toInt()) {
                drawLine(gridColor, Offset(0f, y.toFloat()), Offset(size.width, y.toFloat()), 1f)
            }
        }

        // Oq yuzalik — katta burchakli
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(top = 100.dp)
                .background(Color.White.copy(alpha = 0.7f), RoundedCornerShape(topStart = 80.dp))
                .border(1.dp, Color.White, RoundedCornerShape(topStart = 80.dp))
        )

        // Dekorativ yumshoq dog'
        Box(
            modifier = Modifier
                .size(300.dp)
                .align(Alignment.TopEnd)
                .offset(x = 100.dp, y = (-50).dp)
                .blur(80.dp)
                .background(Color(0xFFD1D5DB).copy(alpha = 0.3f), CircleShape)
        )

        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 40.dp, vertical = 60.dp),
            horizontalAlignment = Alignment.Start
        ) {
            Image(
                painter = painterResource(id = R.drawable.logo),
                contentDescription = "App Logo",
                modifier = Modifier.size(60.dp)
            )

            Spacer(Modifier.height(32.dp))

            // Brend sarlavhasi
            AnimatedVisibility(
                visible = startAnimation,
                enter = fadeIn(tween(800)) + slideInHorizontally(tween(800)) { -40 }
            ) {
                Column {
                    Text(
                        text = "STUGRAM",
                        style = TextStyle(
                            fontSize = 56.sp,
                            fontWeight = FontWeight.Black,
                            color = Color(0xFF1A1C1E),
                            letterSpacing = (-1).sp
                        )
                    )
                    Spacer(Modifier.height(8.dp))
                    Text(
                        text = "Talabalar uchun\nijtimoiy tarmoq",
                        style = TextStyle(
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Normal,
                            color = Color(0xFF64748B),
                            lineHeight = 26.sp
                        )
                    )
                }
            }

            Spacer(Modifier.weight(1f))

            // Kirish / Ro'yxatdan o'tish tugmalari
            AnimatedVisibility(
                visible = startAnimation,
                enter = fadeIn(tween(800, delayMillis = 400)) +
                        slideInVertically(tween(800, delayMillis = 400)) { 60 }
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    PremiumButton(text = "Kirish", onClick = onLoginClick)

                    OutlinedButton(
                        onClick = onRegisterClick,
                        modifier = Modifier.fillMaxWidth().height(60.dp),
                        shape = RoundedCornerShape(24.dp),
                        border = BorderStroke(1.5.dp, Color(0xFF1A1C1E).copy(0.15f)),
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = Color(0xFF1A1C1E))
                    ) {
                        Text(
                            text = "Ro'yxatdan o'tish",
                            style = TextStyle(
                                fontSize = 17.sp,
                                fontWeight = FontWeight.SemiBold,
                                letterSpacing = 0.2.sp
                            )
                        )
                    }
                }
            }

            Spacer(Modifier.height(40.dp))
        }
    }
}
