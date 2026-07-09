package com.example.myapplication.ui.auth

import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
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
    isDarkMode: Boolean,
    onNavigateToHome: () -> Unit,
    pendingTelegramCode: String? = null,
    onTelegramCodeConsumed: () -> Unit = {}
) {
    var selectedTab by remember { mutableIntStateOf(0) } // 0: Login, 1: Register
    val context = LocalContext.current

    val loginViewModel: LoginViewModel = viewModel()
    val registerViewModel: RegisterViewModel = viewModel()

    val loginState by loginViewModel.uiState.collectAsState()
    val registerState by registerViewModel.uiState.collectAsState()

    LaunchedEffect(loginState.isSuccess, registerState.isSuccess) {
        if (loginState.isSuccess || registerState.isSuccess) {
            onNavigateToHome()
        }
    }

    // Opened via the Telegram bot's "Ilovani ochish" bridge link: jump
    // straight into the register flow and resolve the code into step 3.
    LaunchedEffect(pendingTelegramCode) {
        val code = pendingTelegramCode ?: return@LaunchedEffect
        selectedTab = 1
        registerViewModel.resumeFromTelegramCode(context, code)
        onTelegramCodeConsumed()
    }

    // One-shot entrance only, so it costs nothing after the first frame.
    var contentVisible by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) { contentVisible = true }

    val backgroundColor = authBackground(isDarkMode)
    val textPrimary = authTextPrimary(isDarkMode)
    val textSecondary = authTextSecondary(isDarkMode)

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(backgroundColor)
    ) {
        AnimatedVisibility(
            visible = contentVisible,
            enter = fadeIn(tween(400)) + slideInVertically(tween(400, easing = FastOutSlowInEasing)) { it / 10 }
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .statusBarsPadding()
                    .imePadding()
                    .padding(horizontal = 24.dp)
                    .padding(top = 20.dp, bottom = 20.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                PremiumLogo()

                Spacer(modifier = Modifier.height(10.dp))

                Text(
                    text = "Xush kelibsiz",
                    color = textPrimary,
                    fontSize = 24.sp,
                    fontWeight = FontWeight.Black,
                    letterSpacing = 0.3.sp
                )

                Text(
                    text = "Talabalar uchun zamonaviy ijtimoiy tarmoq platformasi",
                    color = textSecondary,
                    fontSize = 13.sp,
                    lineHeight = 17.sp,
                    fontWeight = FontWeight.Medium,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.padding(top = 4.dp, start = 12.dp, end = 12.dp)
                )

                Spacer(modifier = Modifier.height(20.dp))

                TabSwitch(
                    selectedIndex = selectedTab,
                    onTabSelected = { selectedTab = it },
                    isDarkMode = isDarkMode
                )

                Spacer(modifier = Modifier.height(20.dp))

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
                            contentColor = textPrimary,
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
            }
        }

        // Global Loading Overlay
        if (loginState.isLoading || registerState.isLoading) {
            LoadingOverlay(isDarkMode = isDarkMode)
        }
    }
}
