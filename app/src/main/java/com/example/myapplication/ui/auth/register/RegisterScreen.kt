package com.example.myapplication.ui.auth.register

import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.myapplication.R
import com.example.myapplication.ui.auth.components.*
import com.example.myapplication.ui.theme.PremiumBlue
import com.example.myapplication.ui.theme.PremiumError
import com.example.myapplication.ui.theme.PremiumTextSecondary
import com.example.myapplication.ui.theme.authPalette

@Composable
fun RegisterContent(
    viewModel: RegisterViewModel,
    uiState: RegisterUiState,
    onNavigateToLogin: () -> Unit,
    isDarkMode: Boolean = true
) {
    val p = authPalette(isDarkMode)
    var passwordVisible by remember { mutableStateOf(false) }
    var confirmPasswordVisible by remember { mutableStateOf(false) }
    val context = LocalContext.current

    Column(
        modifier = Modifier.fillMaxWidth(),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        // Qadam ko'rsatkichi
        StepProgressIndicator(currentStep = uiState.currentStep, totalSteps = 3, isDarkMode = isDarkMode)

        Spacer(Modifier.height(28.dp))

        // Qadamlar orasida silliq o'tish animatsiyasi
        AnimatedContent(
            targetState = uiState.currentStep,
            transitionSpec = {
                if (targetState > initialState) {
                    (slideInHorizontally(tween(380)) { it } + fadeIn(tween(380)))
                        .togetherWith(slideOutHorizontally(tween(380)) { -it } + fadeOut(tween(380)))
                } else {
                    (slideInHorizontally(tween(380)) { -it } + fadeIn(tween(380)))
                        .togetherWith(slideOutHorizontally(tween(380)) { it } + fadeOut(tween(380)))
                }.using(SizeTransform(clip = false))
            },
            label = "register_step"
        ) { step ->
            Column(
                modifier = Modifier.fillMaxWidth(),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                when (step) {
                    // ── Qadam 1: Identity ────────────────────────────────
                    1 -> {
                        PremiumTextField(
                            value = uiState.identity,
                            onValueChange = viewModel::onIdentityChange,
                            label = "Email yoki Telefon",
                            placeholder = "example@gmail.com / +998...",
                            leadingIcon = Icons.Default.Email,
                            isError = uiState.error != null,
                            isDarkMode = isDarkMode
                        )
                        Spacer(Modifier.height(24.dp))
                        PremiumButton(
                            text = "Kodni yuborish",
                            onClick = viewModel::sendOtp,
                            isLoading = uiState.isLoading
                        )
                        Spacer(Modifier.height(24.dp))
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            HorizontalDivider(modifier = Modifier.weight(1f), color = p.divider)
                            Text("yoki", modifier = Modifier.padding(horizontal = 16.dp), color = p.textSecondary, fontSize = 12.sp)
                            HorizontalDivider(modifier = Modifier.weight(1f), color = p.divider)
                        }
                        Spacer(Modifier.height(24.dp))
                        PremiumSocialButton(
                            painter = painterResource(id = R.drawable.ic_google_g),
                            text = "Google orqali ro'yxatdan o'tish",
                            onClick = { viewModel.loginWithGoogle(context) },
                            isDarkMode = isDarkMode
                        )
                    }

                    // ── Qadam 2: OTP (6 xonali) ─────────────────────────
                    2 -> {
                        Text(
                            text = "${uiState.identity} ga yuborilgan\n6 xonali kodni kiriting",
                            color = p.textSecondary,
                            fontSize = 13.sp,
                            textAlign = TextAlign.Center,
                            modifier = Modifier.padding(bottom = 24.dp)
                        )
                        OtpInputField(
                            otpText = uiState.otp,
                            onOtpTextChange = { code, _ -> viewModel.onOtpChange(code) },
                            otpCount = 6,
                            isDarkMode = isDarkMode
                        )
                        Spacer(Modifier.height(32.dp))
                        PremiumButton(
                            text = "Tasdiqlash",
                            onClick = viewModel::verifyOtp,
                            isLoading = uiState.isLoading
                        )
                        TextButton(onClick = { viewModel.prevStep() }, modifier = Modifier.padding(top = 8.dp)) {
                            Text("Orqaga qaytish", color = p.textSecondary, fontSize = 13.sp)
                        }
                    }

                    // ── Qadam 3: Profilni to'ldirish ─────────────────────
                    3 -> {
                        PremiumTextField(
                            value = uiState.fullName,
                            onValueChange = { viewModel.updateField(RegisterField.FullName(it)) },
                            label = "Ism Familiya",
                            placeholder = "To'liq ismingiz",
                            leadingIcon = Icons.Default.Person,
                            isDarkMode = isDarkMode
                        )
                        Spacer(Modifier.height(12.dp))
                        PremiumTextField(
                            value = uiState.username,
                            onValueChange = { viewModel.updateField(RegisterField.Username(it)) },
                            label = "Username",
                            placeholder = "@username",
                            leadingIcon = Icons.Default.AlternateEmail,
                            isDarkMode = isDarkMode
                        )
                        Spacer(Modifier.height(12.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            Box(modifier = Modifier.weight(1f)) {
                                AuthDropdownField(
                                    value = uiState.selectedRegion,
                                    onValueChange = { viewModel.updateField(RegisterField.Region(it)) },
                                    label = "Viloyat",
                                    options = viewModel.regions,
                                    isDarkMode = isDarkMode
                                )
                            }
                            Box(modifier = Modifier.weight(1f)) {
                                AuthDropdownField(
                                    value = uiState.selectedDistrict,
                                    onValueChange = { viewModel.updateField(RegisterField.District(it)) },
                                    label = "Tuman",
                                    options = viewModel.getDistricts(uiState.selectedRegion),
                                    isDarkMode = isDarkMode
                                )
                            }
                        }
                        Spacer(Modifier.height(12.dp))
                        PremiumTextField(
                            value = uiState.selectedSchool,
                            onValueChange = { viewModel.updateField(RegisterField.School(it)) },
                            label = "Maktab / OTM",
                            placeholder = "Maktab yoki OTM nomini kiriting",
                            leadingIcon = Icons.Default.School,
                            isDarkMode = isDarkMode
                        )
                        Spacer(Modifier.height(12.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            Box(modifier = Modifier.weight(1f)) {
                                AuthDropdownField(
                                    value = uiState.grade,
                                    onValueChange = { viewModel.updateField(RegisterField.Grade(it)) },
                                    label = "Sinf",
                                    options = viewModel.grades,
                                    isDarkMode = isDarkMode
                                )
                            }
                            Box(modifier = Modifier.weight(1f)) {
                                AuthDropdownField(
                                    value = uiState.group,
                                    onValueChange = { viewModel.updateField(RegisterField.Group(it)) },
                                    label = "Guruh",
                                    options = viewModel.groups,
                                    isDarkMode = isDarkMode
                                )
                            }
                        }
                        Spacer(Modifier.height(12.dp))
                        PremiumTextField(
                            value = uiState.password,
                            onValueChange = { viewModel.updateField(RegisterField.Password(it)) },
                            label = "Parol",
                            placeholder = "Kamida 6 ta belgi",
                            leadingIcon = Icons.Default.Lock,
                            visualTransformation = if (passwordVisible) VisualTransformation.None else PasswordVisualTransformation(),
                            trailingIcon = {
                                IconButton(onClick = { passwordVisible = !passwordVisible }) {
                                    Icon(
                                        imageVector = if (passwordVisible) Icons.Default.Visibility else Icons.Default.VisibilityOff,
                                        contentDescription = null,
                                        tint = p.textSecondary.copy(0.7f)
                                    )
                                }
                            },
                            isDarkMode = isDarkMode
                        )
                        Spacer(Modifier.height(12.dp))
                        PremiumTextField(
                            value = uiState.confirmPassword,
                            onValueChange = { viewModel.updateField(RegisterField.ConfirmPassword(it)) },
                            label = "Parolni tasdiqlang",
                            placeholder = "Parolni qayta kiriting",
                            leadingIcon = Icons.Default.LockReset,
                            visualTransformation = if (confirmPasswordVisible) VisualTransformation.None else PasswordVisualTransformation(),
                            trailingIcon = {
                                IconButton(onClick = { confirmPasswordVisible = !confirmPasswordVisible }) {
                                    Icon(
                                        imageVector = if (confirmPasswordVisible) Icons.Default.Visibility else Icons.Default.VisibilityOff,
                                        contentDescription = null,
                                        tint = p.textSecondary.copy(0.7f)
                                    )
                                }
                            },
                            isDarkMode = isDarkMode
                        )
                        Spacer(Modifier.height(24.dp))
                        PremiumButton(
                            text = "Ro'yxatdan o'tish",
                            onClick = { viewModel.register(context) },
                            isLoading = uiState.isLoading
                        )
                        TextButton(onClick = { viewModel.prevStep() }, modifier = Modifier.padding(top = 8.dp)) {
                            Text("Orqaga", color = p.textSecondary, fontSize = 13.sp)
                        }
                    }
                }
            }
        }

        // Xato xabari
        uiState.error?.let {
            Spacer(Modifier.height(12.dp))
            Text(
                text = it,
                color = PremiumError,
                fontSize = 12.sp,
                modifier = Modifier.padding(horizontal = 4.dp)
            )
        }
    }
}

@Composable
private fun StepProgressIndicator(currentStep: Int, totalSteps: Int, isDarkMode: Boolean = true) {
    val p = authPalette(isDarkMode)
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically
    ) {
        for (i in 1..totalSteps) {
            val isCompleted = i < currentStep
            val isActive = i == currentStep

            val dotColor by animateColorAsState(
                targetValue = when {
                    isCompleted || isActive -> p.accent
                    else -> p.textSecondary.copy(0.25f)
                },
                animationSpec = tween(400),
                label = "dot_color"
            )
            val dotSize by animateDpAsState(
                targetValue = if (isActive) 11.dp else 8.dp,
                animationSpec = tween(300),
                label = "dot_size"
            )

            Box(
                modifier = Modifier
                    .size(dotSize)
                    .background(dotColor, CircleShape)
            )

            if (i < totalSteps) {
                Box(
                    modifier = Modifier
                        .width(32.dp)
                        .height(2.dp)
                        .background(
                            if (isCompleted) p.accent else p.textSecondary.copy(0.18f),
                            RoundedCornerShape(1.dp)
                        )
                )
            }
        }
    }
}
