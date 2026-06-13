package com.example.myapplication.ui.auth

import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.DarkMode
import androidx.compose.material.icons.filled.LightMode
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.example.myapplication.ui.LoginContent
import com.example.myapplication.ui.LoginViewModel
import com.example.myapplication.ui.auth.components.*
import com.example.myapplication.ui.auth.register.RegisterContent
import com.example.myapplication.ui.auth.register.RegisterViewModel
import com.example.myapplication.ui.theme.*

@Composable
fun AuthScreen(
    onNavigateToHome: () -> Unit,
    isDarkMode: Boolean = true,
    onThemeChange: (Boolean) -> Unit = {}
) {
    val palette = authPalette(isDarkMode)
    var selectedTab by remember { mutableIntStateOf(0) }

    val loginViewModel: LoginViewModel = viewModel()
    val registerViewModel: RegisterViewModel = viewModel()

    val loginState by loginViewModel.uiState.collectAsState()
    val registerState by registerViewModel.uiState.collectAsState()

    LaunchedEffect(loginState.isSuccess, registerState.isSuccess) {
        if (loginState.isSuccess || registerState.isSuccess) {
            onNavigateToHome()
        }
    }

    Box(modifier = Modifier.fillMaxSize().background(palette.bg)) {
        LiquidGlassBackdrop(isDarkMode = isDarkMode)

        if (loginState.isLoading || registerState.isLoading) {
            LoadingOverlay(isDarkMode = isDarkMode)
        }

        Column(
            modifier = Modifier
                .fillMaxSize()
                .statusBarsPadding()
                .navigationBarsPadding()
        ) {
            // ── Top bar with theme toggle ───────────────────────────
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.End,
                verticalAlignment = Alignment.CenterVertically
            ) {
                ThemeToggleButton(
                    isDarkMode = isDarkMode,
                    onToggle = { onThemeChange(!isDarkMode) }
                )
            }

            Column(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 24.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Spacer(modifier = Modifier.height(12.dp))

                PremiumLogo(isDarkMode = isDarkMode)

                Spacer(modifier = Modifier.height(20.dp))

                Text(
                    text = "Xush kelibsiz",
                    color = palette.textPrimary,
                    fontSize = 30.sp,
                    fontWeight = FontWeight.Black,
                    letterSpacing = 0.5.sp
                )

                Text(
                    text = "Talabalar uchun ijtimoiy tarmoq",
                    color = palette.textSecondary,
                    fontSize = 14.sp,
                    lineHeight = 20.sp,
                    fontWeight = FontWeight.Medium,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.padding(top = 6.dp)
                )

                Spacer(modifier = Modifier.height(28.dp))

                TabSwitch(
                    selectedIndex = selectedTab,
                    onTabSelected = { selectedTab = it },
                    isDarkMode = isDarkMode
                )

                Spacer(modifier = Modifier.height(24.dp))

                AnimatedContent(
                    targetState = selectedTab,
                    transitionSpec = {
                        if (targetState > initialState) {
                            (slideInHorizontally(animationSpec = tween(400)) { it } + fadeIn(tween(400)))
                                .togetherWith(slideOutHorizontally(animationSpec = tween(400)) { -it } + fadeOut(tween(400)))
                        } else {
                            (slideInHorizontally(animationSpec = tween(400)) { -it } + fadeIn(tween(400)))
                                .togetherWith(slideOutHorizontally(animationSpec = tween(400)) { it } + fadeOut(tween(400)))
                        }.using(SizeTransform(clip = false))
                    },
                    label = "auth_content"
                ) { targetTab ->
                    if (targetTab == 0) {
                        LoginContent(
                            viewModel = loginViewModel,
                            uiState = loginState,
                            onNavigateToRegister = { selectedTab = 1 },
                            contentColor = palette.textPrimary,
                            isDarkMode = isDarkMode
                        )
                    } else {
                        RegisterContent(
                            viewModel = registerViewModel,
                            uiState = registerState,
                            onNavigateToLogin = { selectedTab = 0 },
                            isDarkMode = isDarkMode
                        )
                    }
                }

                Spacer(modifier = Modifier.height(32.dp))
            }
        }

        if (loginState.showPasswordResetModal) {
            PasswordResetModal(
                uiState = loginState,
                isDarkMode = isDarkMode,
                onDismiss = { loginViewModel.togglePasswordResetModal(false) },
                onEmailChange = loginViewModel::onResetEmailChange,
                onOtpChange = loginViewModel::onResetOtpChange,
                onNewPasswordChange = loginViewModel::onResetNewPasswordChange,
                onConfirmPasswordChange = loginViewModel::onResetConfirmPasswordChange,
                onSendOtp = loginViewModel::submitForgotPassword,
                onAdvanceToStep3 = loginViewModel::advanceResetToStep3,
                onSubmitReset = loginViewModel::submitResetPassword,
                onPrevStep = loginViewModel::prevResetStep
            )
        }
    }
}

@Composable
private fun ThemeToggleButton(
    isDarkMode: Boolean,
    onToggle: () -> Unit
) {
    val palette = authPalette(isDarkMode)

    Box(
        modifier = Modifier
            .size(44.dp)
            .clip(CircleShape)
            .background(palette.surface)
            .border(1.dp, palette.border.copy(0.6f), CircleShape)
            .clickable(onClick = onToggle),
        contentAlignment = Alignment.Center
    ) {
        AnimatedContent(
            targetState = isDarkMode,
            transitionSpec = {
                (fadeIn(tween(250)) + scaleIn(initialScale = 0.6f, animationSpec = tween(250)))
                    .togetherWith(fadeOut(tween(150)) + scaleOut(targetScale = 0.6f, animationSpec = tween(150)))
            },
            label = "icon_swap"
        ) { dark ->
            Icon(
                imageVector = if (dark) Icons.Filled.LightMode else Icons.Filled.DarkMode,
                contentDescription = if (dark) "Yorug' rejim" else "Tungi rejim",
                tint = palette.accent,
                modifier = Modifier.size(22.dp)
            )
        }
    }
}

@Composable
private fun LiquidGlassBackdrop(isDarkMode: Boolean) {
    val infinite = rememberInfiniteTransition(label = "bg")
    val drift by infinite.animateFloat(
        initialValue = -60f,
        targetValue = 60f,
        animationSpec = infiniteRepeatable(
            animation = tween(6000, easing = EaseInOutSine),
            repeatMode = RepeatMode.Reverse
        ),
        label = "drift"
    )

    val blobA = if (isDarkMode) Color(0xFF1B5EBC) else Color(0xFF7EC8FF)
    val blobB = if (isDarkMode) Color(0xFF36B6FF) else Color(0xFFB8D6FF)

    Box(modifier = Modifier.fillMaxSize()) {
        Canvas(
            modifier = Modifier
                .fillMaxSize()
                .blur(110.dp)
        ) {
            drawCircle(
                brush = Brush.radialGradient(listOf(blobA.copy(alpha = if (isDarkMode) 0.50f else 0.28f), Color.Transparent)),
                radius = size.minDimension * 0.45f,
                center = Offset(size.width * 0.25f + drift, size.height * 0.28f)
            )
            drawCircle(
                brush = Brush.radialGradient(listOf(blobB.copy(alpha = if (isDarkMode) 0.40f else 0.26f), Color.Transparent)),
                radius = size.minDimension * 0.50f,
                center = Offset(size.width * 0.78f - drift, size.height * 0.72f)
            )
        }
    }
}
