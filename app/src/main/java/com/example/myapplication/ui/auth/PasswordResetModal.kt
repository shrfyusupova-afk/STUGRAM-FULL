package com.example.myapplication.ui.auth

import androidx.activity.compose.BackHandler
import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.blur
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.example.myapplication.ui.LoginUiState
import com.example.myapplication.ui.auth.components.*
import com.example.myapplication.ui.theme.*

@Composable
fun PasswordResetModal(
    uiState: LoginUiState,
    isDarkMode: Boolean = true,
    onDismiss: () -> Unit,
    onEmailChange: (String) -> Unit,
    onOtpChange: (String) -> Unit,
    onNewPasswordChange: (String) -> Unit,
    onConfirmPasswordChange: (String) -> Unit,
    onSendOtp: () -> Unit,
    onAdvanceToStep3: () -> Unit,
    onSubmitReset: () -> Unit,
    onPrevStep: () -> Unit
) {
    val p = authPalette(isDarkMode)

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(
            usePlatformDefaultWidth = false,
            dismissOnBackPress = false,
            dismissOnClickOutside = false
        )
    ) {
        BackHandler { onPrevStep() }

        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(p.bg)
        ) {
            // Liquid glass backdrop blobs
            BackdropBlobs(isDarkMode = isDarkMode)

            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .statusBarsPadding()
                    .navigationBarsPadding()
            ) {
                // ── Top bar ──────────────────────────────────────────
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 6.dp, vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    IconButton(onClick = onPrevStep) {
                        Icon(
                            Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Orqaga",
                            tint = p.textPrimary
                        )
                    }
                    Text(
                        text = "Parolni tiklash",
                        color = p.textPrimary,
                        fontSize = 17.sp,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.weight(1f),
                        textAlign = TextAlign.Center
                    )
                    IconButton(onClick = onDismiss) {
                        Icon(
                            Icons.Default.Close,
                            contentDescription = "Yopish",
                            tint = p.textSecondary
                        )
                    }
                }

                // ── Scrollable content area ──────────────────────────
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f)
                        .verticalScroll(rememberScrollState())
                        .padding(horizontal = 24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Spacer(Modifier.height(8.dp))

                    AnimatedVisibility(
                        visible = uiState.resetStep < 4,
                        enter = fadeIn(tween(300)),
                        exit = fadeOut(tween(300))
                    ) {
                        ResetStepIndicator(
                            currentStep = uiState.resetStep,
                            isDarkMode = isDarkMode
                        )
                    }

                    Spacer(Modifier.height(28.dp))

                    AnimatedContent(
                        targetState = uiState.resetStep,
                        transitionSpec = {
                            if (targetState > initialState) {
                                (slideInHorizontally(tween(380)) { it } + fadeIn(tween(380)))
                                    .togetherWith(slideOutHorizontally(tween(380)) { -it } + fadeOut(tween(380)))
                            } else {
                                (slideInHorizontally(tween(380)) { -it } + fadeIn(tween(380)))
                                    .togetherWith(slideOutHorizontally(tween(380)) { it } + fadeOut(tween(380)))
                            }.using(SizeTransform(clip = false))
                        },
                        label = "reset_step"
                    ) { step ->
                        Column(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            when (step) {
                                1 -> Step1Content(
                                    identity = uiState.resetEmail,
                                    onIdentityChange = onEmailChange,
                                    isLoading = uiState.isResetLoading,
                                    hasError = uiState.resetError != null,
                                    onSendOtp = onSendOtp,
                                    isDarkMode = isDarkMode
                                )
                                2 -> Step2Content(
                                    identity = uiState.resetEmail,
                                    otp = uiState.resetOtp,
                                    onOtpChange = onOtpChange,
                                    onAdvance = onAdvanceToStep3,
                                    onResend = onSendOtp,
                                    isLoading = uiState.isResetLoading,
                                    isDarkMode = isDarkMode
                                )
                                3 -> Step3Content(
                                    newPassword = uiState.resetNewPassword,
                                    confirmPassword = uiState.resetConfirmPassword,
                                    onNewPasswordChange = onNewPasswordChange,
                                    onConfirmPasswordChange = onConfirmPasswordChange,
                                    onSubmit = onSubmitReset,
                                    isLoading = uiState.isResetLoading,
                                    isDarkMode = isDarkMode
                                )
                                4 -> SuccessContent(
                                    onClose = onDismiss,
                                    isDarkMode = isDarkMode
                                )
                            }
                        }
                    }

                    AnimatedVisibility(
                        visible = !uiState.resetError.isNullOrBlank() && uiState.resetStep < 4,
                        enter = fadeIn(tween(250)) + expandVertically(),
                        exit = fadeOut(tween(200)) + shrinkVertically()
                    ) {
                        Surface(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(top = 16.dp),
                            shape = RoundedCornerShape(14.dp),
                            color = p.error.copy(0.10f),
                            border = BorderStroke(1.dp, p.error.copy(0.30f))
                        ) {
                            Row(
                                modifier = Modifier.padding(12.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Icon(Icons.Default.Error, null, tint = p.error, modifier = Modifier.size(18.dp))
                                Spacer(Modifier.width(8.dp))
                                Text(
                                    text = uiState.resetError ?: "",
                                    color = p.error,
                                    fontSize = 13.sp,
                                    modifier = Modifier.weight(1f)
                                )
                            }
                        }
                    }

                    Spacer(Modifier.height(32.dp))
                }
            }
        }
    }
}

// ── Qadam 1 ────────────────────────────────────────────────────────────
@Composable
private fun Step1Content(
    identity: String,
    onIdentityChange: (String) -> Unit,
    isLoading: Boolean,
    hasError: Boolean,
    onSendOtp: () -> Unit,
    isDarkMode: Boolean
) {
    StepHeader(
        icon = Icons.Default.AlternateEmail,
        iconTint = PremiumBlue,
        title = "Email yoki Username",
        subtitle = "Hisobingizga bog'liq emailga\n6 xonali tasdiqlash kodi yuboramiz",
        isDarkMode = isDarkMode
    )
    Spacer(Modifier.height(32.dp))
    PremiumTextField(
        value = identity,
        onValueChange = onIdentityChange,
        label = "Email yoki Username",
        placeholder = "example@gmail.com",
        leadingIcon = Icons.Default.AlternateEmail,
        isError = hasError,
        isDarkMode = isDarkMode
    )
    Spacer(Modifier.height(24.dp))
    PremiumButton(text = "Kodni yuborish", onClick = onSendOtp, isLoading = isLoading)
}

// ── Qadam 2 ────────────────────────────────────────────────────────────
@Composable
private fun Step2Content(
    identity: String,
    otp: String,
    onOtpChange: (String) -> Unit,
    onAdvance: () -> Unit,
    onResend: () -> Unit,
    isLoading: Boolean,
    isDarkMode: Boolean
) {
    val displayIdentity = if (identity.length > 24) identity.take(24) + "…" else identity

    StepHeader(
        icon = Icons.Default.Email,
        iconTint = Color(0xFF4FC3F7),
        title = "Kodni kiriting",
        subtitle = "$displayIdentity ga\nyuborilgan 6 xonali kodni kiriting",
        isDarkMode = isDarkMode
    )
    Spacer(Modifier.height(32.dp))

    OtpInputField(
        otpText = otp,
        onOtpTextChange = { code, _ -> onOtpChange(code) },
        otpCount = 6,
        isDarkMode = isDarkMode
    )

    Spacer(Modifier.height(28.dp))
    PremiumButton(
        text = "Davom etish",
        onClick = onAdvance,
        isLoading = isLoading,
        enabled = otp.length == 6
    )
    TextButton(onClick = onResend, modifier = Modifier.padding(top = 4.dp)) {
        Text("Kodni qayta yuborish", color = PremiumBlue, fontSize = 13.sp)
    }
}

// ── Qadam 3 ────────────────────────────────────────────────────────────
@Composable
private fun Step3Content(
    newPassword: String,
    confirmPassword: String,
    onNewPasswordChange: (String) -> Unit,
    onConfirmPasswordChange: (String) -> Unit,
    onSubmit: () -> Unit,
    isLoading: Boolean,
    isDarkMode: Boolean
) {
    val p = authPalette(isDarkMode)
    var passwordVisible by remember { mutableStateOf(false) }
    var confirmPasswordVisible by remember { mutableStateOf(false) }
    val mismatch = confirmPassword.isNotBlank() && newPassword != confirmPassword

    StepHeader(
        icon = Icons.Default.Lock,
        iconTint = PremiumBlue,
        title = "Yangi parol",
        subtitle = "Xavfsiz yangi parol kiriting\n(kamida 8 ta belgi)",
        isDarkMode = isDarkMode
    )
    Spacer(Modifier.height(28.dp))
    PremiumTextField(
        value = newPassword,
        onValueChange = onNewPasswordChange,
        label = "Yangi parol",
        placeholder = "Kamida 8 ta belgi",
        leadingIcon = Icons.Default.Lock,
        visualTransformation = if (passwordVisible) VisualTransformation.None else PasswordVisualTransformation(),
        trailingIcon = {
            IconButton(onClick = { passwordVisible = !passwordVisible }) {
                Icon(
                    if (passwordVisible) Icons.Default.Visibility else Icons.Default.VisibilityOff,
                    null, tint = p.textSecondary.copy(0.7f)
                )
            }
        },
        isDarkMode = isDarkMode
    )
    Spacer(Modifier.height(14.dp))
    PremiumTextField(
        value = confirmPassword,
        onValueChange = onConfirmPasswordChange,
        label = "Parolni tasdiqlang",
        placeholder = "Parolni qayta kiriting",
        leadingIcon = Icons.Default.LockReset,
        isError = mismatch,
        errorMessage = if (mismatch) "Parollar mos kelmadi" else null,
        visualTransformation = if (confirmPasswordVisible) VisualTransformation.None else PasswordVisualTransformation(),
        trailingIcon = {
            IconButton(onClick = { confirmPasswordVisible = !confirmPasswordVisible }) {
                Icon(
                    if (confirmPasswordVisible) Icons.Default.Visibility else Icons.Default.VisibilityOff,
                    null, tint = p.textSecondary.copy(0.7f)
                )
            }
        },
        isDarkMode = isDarkMode
    )
    Spacer(Modifier.height(24.dp))
    PremiumButton(
        text = "Parolni yangilash",
        onClick = onSubmit,
        isLoading = isLoading,
        enabled = newPassword.isNotBlank() && confirmPassword.isNotBlank() && !mismatch
    )
}

// ── Qadam 4: Muvaffaqiyat ─────────────────────────────────────────────
@Composable
private fun SuccessContent(onClose: () -> Unit, isDarkMode: Boolean) {
    val p = authPalette(isDarkMode)
    var visible by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) { visible = true }

    val scale by animateFloatAsState(
        targetValue = if (visible) 1f else 0f,
        animationSpec = spring(
            dampingRatio = Spring.DampingRatioMediumBouncy,
            stiffness = Spring.StiffnessMedium
        ),
        label = "check_scale"
    )
    val alpha by animateFloatAsState(
        targetValue = if (visible) 1f else 0f,
        animationSpec = tween(600, delayMillis = 200),
        label = "text_alpha"
    )

    Column(
        modifier = Modifier.fillMaxWidth(),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Spacer(Modifier.height(12.dp))

        Box(
            modifier = Modifier
                .size(120.dp)
                .graphicsLayer { scaleX = scale; scaleY = scale },
            contentAlignment = Alignment.Center
        ) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .blur(36.dp)
                    .background(Color(0xFF4CAF50).copy(0.35f), CircleShape)
            )
            Box(
                modifier = Modifier
                    .size(100.dp)
                    .background(Color(0xFF4CAF50).copy(0.15f), CircleShape)
                    .border(2.dp, Color(0xFF4CAF50).copy(0.55f), CircleShape),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    Icons.Default.Check,
                    null,
                    tint = Color(0xFF4CAF50),
                    modifier = Modifier.size(56.dp)
                )
            }
        }

        Column(modifier = Modifier.graphicsLayer { this.alpha = alpha }) {
            Spacer(Modifier.height(24.dp))
            Text(
                text = "Parol yangilandi!",
                color = p.textPrimary,
                fontSize = 24.sp,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth()
            )
            Spacer(Modifier.height(12.dp))
            Text(
                text = "Parolingiz muvaffaqiyatli yangilandi.\nEndi yangi parolingiz bilan kirishingiz mumkin.",
                color = p.textSecondary,
                fontSize = 14.sp,
                textAlign = TextAlign.Center,
                lineHeight = 22.sp,
                modifier = Modifier.fillMaxWidth()
            )
            Spacer(Modifier.height(32.dp))
            PremiumButton(text = "Kirish sahifasiga", onClick = onClose)
        }
    }
}

// ── Qadam sarlavhasi ──────────────────────────────────────────────────
@Composable
private fun StepHeader(
    icon: ImageVector,
    iconTint: Color,
    title: String,
    subtitle: String,
    isDarkMode: Boolean
) {
    val p = authPalette(isDarkMode)
    Box(modifier = Modifier.size(80.dp), contentAlignment = Alignment.Center) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .blur(24.dp)
                .background(iconTint.copy(0.25f), CircleShape)
        )
        Box(
            modifier = Modifier
                .size(64.dp)
                .background(
                    if (isDarkMode) iconTint.copy(0.14f) else iconTint.copy(0.10f),
                    CircleShape
                )
                .border(1.dp, iconTint.copy(0.35f), CircleShape),
            contentAlignment = Alignment.Center
        ) {
            Icon(icon, null, tint = iconTint, modifier = Modifier.size(32.dp))
        }
    }
    Spacer(Modifier.height(18.dp))
    Text(
        text = title,
        color = p.textPrimary,
        fontSize = 22.sp,
        fontWeight = FontWeight.Bold,
        textAlign = TextAlign.Center
    )
    Spacer(Modifier.height(8.dp))
    Text(
        text = subtitle,
        color = p.textSecondary,
        fontSize = 14.sp,
        textAlign = TextAlign.Center,
        lineHeight = 20.sp
    )
}

// ── Qadam ko'rsatkichi ────────────────────────────────────────────────
@Composable
private fun ResetStepIndicator(currentStep: Int, isDarkMode: Boolean) {
    val p = authPalette(isDarkMode)
    Row(
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically
    ) {
        for (i in 1..3) {
            val isCompleted = i < currentStep
            val isActive = i == currentStep

            val dotColor by animateColorAsState(
                targetValue = if (isCompleted || isActive) p.accent else p.textSecondary.copy(0.25f),
                animationSpec = tween(400),
                label = "dot_$i"
            )
            val dotSize by animateDpAsState(
                targetValue = if (isActive) 12.dp else 8.dp,
                animationSpec = tween(300),
                label = "size_$i"
            )
            Box(modifier = Modifier.size(dotSize).background(dotColor, CircleShape))

            if (i < 3) {
                val lineColor by animateColorAsState(
                    targetValue = if (isCompleted) p.accent else p.textSecondary.copy(0.18f),
                    animationSpec = tween(400),
                    label = "line_$i"
                )
                Box(
                    modifier = Modifier
                        .width(36.dp)
                        .height(2.dp)
                        .background(lineColor, RoundedCornerShape(1.dp))
                )
            }
        }
    }
}

// ── Backdrop blobs (liquid glass) ─────────────────────────────────────
@Composable
private fun BackdropBlobs(isDarkMode: Boolean) {
    val infinite = rememberInfiniteTransition(label = "reset_bg")
    val drift by infinite.animateFloat(
        initialValue = -40f,
        targetValue = 40f,
        animationSpec = infiniteRepeatable(
            animation = tween(5500, easing = EaseInOutSine),
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
                .blur(100.dp)
        ) {
            drawCircle(
                brush = Brush.radialGradient(listOf(blobA.copy(alpha = if (isDarkMode) 0.40f else 0.22f), Color.Transparent)),
                radius = size.minDimension * 0.40f,
                center = Offset(size.width * 0.20f + drift, size.height * 0.25f)
            )
            drawCircle(
                brush = Brush.radialGradient(listOf(blobB.copy(alpha = if (isDarkMode) 0.35f else 0.22f), Color.Transparent)),
                radius = size.minDimension * 0.45f,
                center = Offset(size.width * 0.80f - drift, size.height * 0.78f)
            )
        }
    }
}
