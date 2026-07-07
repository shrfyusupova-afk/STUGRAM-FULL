package com.example.myapplication.ui.auth

import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.blur
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
    onNavigateToHome: () -> Unit
) {
    var selectedTab by remember { mutableIntStateOf(0) } // 0: Login, 1: Register

    val loginViewModel: LoginViewModel = viewModel()
    val registerViewModel: RegisterViewModel = viewModel()

    val loginState by loginViewModel.uiState.collectAsState()
    val registerState by registerViewModel.uiState.collectAsState()

    // Navigate to home on success
    LaunchedEffect(loginState.isSuccess, registerState.isSuccess) {
        if (loginState.isSuccess || registerState.isSuccess) {
            onNavigateToHome()
        }
    }

    // Staged entrance: hero content, then the sheet slides/fades up right after.
    // One-shot only (not infinite), so it costs nothing after the first frame.
    var heroVisible by remember { mutableStateOf(false) }
    var sheetVisible by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) {
        heroVisible = true
        sheetVisible = true
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(AuthCard)
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .imePadding()
        ) {
            AnimatedVisibility(
                visible = heroVisible,
                enter = fadeIn(tween(450)) + slideInVertically(tween(450, easing = FastOutSlowInEasing)) { -it / 4 }
            ) {
                AuthHero()
            }

            AnimatedVisibility(
                visible = sheetVisible,
                enter = fadeIn(tween(500, delayMillis = 80)) + slideInVertically(tween(500, delayMillis = 80, easing = FastOutSlowInEasing)) { it / 6 }
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(AuthCard, RoundedCornerShape(topStart = 32.dp, topEnd = 32.dp))
                        .padding(horizontal = 24.dp)
                        .padding(top = 28.dp, bottom = 32.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    TabSwitch(
                        selectedIndex = selectedTab,
                        onTabSelected = { selectedTab = it }
                    )

                    Spacer(modifier = Modifier.height(28.dp))

                    AnimatedContent(
                        targetState = selectedTab,
                        transitionSpec = {
                            if (targetState > initialState) {
                                (slideInHorizontally(animationSpec = tween(400)) { it } + fadeIn(animationSpec = tween(400)))
                                    .togetherWith(slideOutHorizontally(animationSpec = tween(400)) { -it } + fadeOut(animationSpec = tween(400)))
                            } else {
                                (slideInHorizontally(animationSpec = tween(400)) { -it } + fadeIn(animationSpec = tween(400)))
                                    .togetherWith(slideOutHorizontally(animationSpec = tween(400)) { it } + fadeOut(animationSpec = tween(400)))
                            }.using(SizeTransform(clip = false))
                        },
                        label = "auth_content"
                    ) { targetTab ->
                        if (targetTab == 0) {
                            LoginContent(
                                viewModel = loginViewModel,
                                uiState = loginState,
                                onNavigateToRegister = { selectedTab = 1 },
                                contentColor = AuthTextPrimary,
                                isDarkMode = false
                            )
                        } else {
                            RegisterContent(
                                viewModel = registerViewModel,
                                uiState = registerState,
                                onNavigateToLogin = { selectedTab = 0 }
                            )
                        }
                    }
                }
            }
        }

        // Global Loading Overlay
        if (loginState.isLoading || registerState.isLoading) {
            LoadingOverlay()
        }
    }
}

/**
 * Yellow hero band: logo + welcome copy, with soft drifting amber blobs for a
 * touch of life. Drawn on the Canvas draw-phase only (no layout recomposition),
 * so it stays cheap and smooth regardless of what the form below is doing.
 */
@Composable
private fun AuthHero() {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .background(AuthYellow, RoundedCornerShape(bottomStart = 40.dp, bottomEnd = 40.dp))
    ) {
        HeroBlobs()

        Column(
            modifier = Modifier
                .fillMaxWidth()
                .statusBarsPadding()
                .padding(horizontal = 24.dp)
                .padding(top = 28.dp, bottom = 36.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            PremiumLogo()

            Spacer(modifier = Modifier.height(18.dp))

            Text(
                text = "Xush kelibsiz",
                color = AuthTextPrimary,
                fontSize = 28.sp,
                fontWeight = FontWeight.Black,
                letterSpacing = 0.3.sp
            )

            Text(
                text = "Talabalar uchun zamonaviy ijtimoiy tarmoq platformasi",
                color = AuthTextPrimary.copy(alpha = 0.7f),
                fontSize = 13.sp,
                lineHeight = 18.sp,
                fontWeight = FontWeight.Medium,
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(top = 6.dp, start = 12.dp, end = 12.dp)
            )
        }
    }
}

@Composable
private fun HeroBlobs() {
    val transition = rememberInfiniteTransition(label = "hero_blobs")
    val drift by transition.animateFloat(
        initialValue = -30f,
        targetValue = 30f,
        animationSpec = infiniteRepeatable(
            animation = tween(4200, easing = EaseInOutSine),
            repeatMode = RepeatMode.Reverse
        ),
        label = "drift"
    )

    Canvas(
        modifier = Modifier
            .fillMaxWidth()
            .height(260.dp)
            .blur(60.dp)
    ) {
        drawCircle(
            brush = Brush.radialGradient(listOf(AuthYellowSoft.copy(alpha = 0.9f), Color.Transparent)),
            radius = size.minDimension * 0.4f,
            center = Offset(size.width * 0.85f + drift, size.height * 0.15f)
        )
        drawCircle(
            brush = Brush.radialGradient(listOf(AuthYellowDeep.copy(alpha = 0.35f), Color.Transparent)),
            radius = size.minDimension * 0.5f,
            center = Offset(size.width * 0.1f - drift, size.height * 0.75f)
        )
    }
}
