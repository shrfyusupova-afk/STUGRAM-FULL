package com.example.myapplication.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AlternateEmail
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.LockReset
import androidx.compose.material.icons.filled.Pin
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import com.example.myapplication.R
import com.example.myapplication.ui.auth.components.PremiumButton
import com.example.myapplication.ui.auth.components.PremiumTextField
import com.example.myapplication.ui.auth.components.PremiumSocialButton
import com.example.myapplication.ui.theme.AuthBlue
import com.example.myapplication.ui.theme.AuthError
import com.example.myapplication.ui.theme.authCard
import com.example.myapplication.ui.theme.authTextPrimary
import com.example.myapplication.ui.theme.authTextSecondary

@Composable
fun LoginContent(
    viewModel: LoginViewModel,
    uiState: LoginUiState,
    onNavigateToRegister: () -> Unit,
    contentColor: Color,
    isDarkMode: Boolean
) {
    var passwordVisible by remember { mutableStateOf(false) }
    val context = LocalContext.current
    val textSecondary = authTextSecondary(isDarkMode)

    Column(
        modifier = Modifier.fillMaxWidth(),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        PremiumTextField(
            value = uiState.username,
            onValueChange = viewModel::onUsernameChange,
            label = "Username yoki Email",
            placeholder = "example@gmail.com",
            leadingIcon = Icons.Default.AlternateEmail,
            isError = uiState.error != null,
            isDarkMode = isDarkMode
        )

        Spacer(modifier = Modifier.height(16.dp))

        PremiumTextField(
            value = uiState.password,
            onValueChange = viewModel::onPasswordChange,
            label = "Parol",
            placeholder = "Parolingizni kiriting",
            leadingIcon = Icons.Default.Lock,
            visualTransformation = if (passwordVisible) VisualTransformation.None else PasswordVisualTransformation(),
            trailingIcon = {
                IconButton(onClick = { passwordVisible = !passwordVisible }) {
                    Icon(
                        imageVector = if (passwordVisible) Icons.Default.Visibility else Icons.Default.VisibilityOff,
                        contentDescription = null,
                        tint = textSecondary.copy(0.6f)
                    )
                }
            },
            isDarkMode = isDarkMode
        )

        Box(modifier = Modifier.fillMaxWidth(), contentAlignment = Alignment.CenterEnd) {
            TextButton(
                onClick = viewModel::openForgotPassword
            ) {
                Text(
                    "Parolni unutdingizmi?",
                    color = AuthBlue,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Medium
                )
            }
        }

        Spacer(modifier = Modifier.height(24.dp))

        PremiumButton(
            text = "Kirish",
            onClick = { viewModel.login(context) },
            isLoading = uiState.isLoading
        )

        Spacer(modifier = Modifier.height(24.dp))

        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            HorizontalDivider(modifier = Modifier.weight(1f), color = textSecondary.copy(0.15f))
            Text(
                text = "yoki",
                modifier = Modifier.padding(horizontal = 16.dp),
                color = textSecondary,
                fontSize = 12.sp
            )
            HorizontalDivider(modifier = Modifier.weight(1f), color = textSecondary.copy(0.15f))
        }

        Spacer(modifier = Modifier.height(24.dp))

        PremiumSocialButton(
            painter = painterResource(id = R.drawable.ic_google_g),
            text = "Google orqali kirish",
            onClick = { viewModel.loginWithGoogle(context) },
            isDarkMode = isDarkMode
        )

        uiState.error?.let {
            Text(
                text = it,
                color = AuthError,
                fontSize = 12.sp,
                modifier = Modifier.padding(top = 16.dp)
            )
        }

        uiState.infoMessage?.let {
            Text(
                text = it,
                color = AuthBlue,
                fontSize = 12.sp,
                fontWeight = FontWeight.Medium,
                modifier = Modifier.padding(top = 16.dp)
            )
        }
    }

    if (uiState.forgotVisible) {
        ForgotPasswordDialog(
            uiState = uiState,
            viewModel = viewModel,
            isDarkMode = isDarkMode
        )
    }
}

/**
 * Parolni tiklash oynasi: 1) username kiritiladi (kod Telegram/emailga
 * yuboriladi), 2) kod + yangi parol kiritiladi.
 */
@Composable
private fun ForgotPasswordDialog(
    uiState: LoginUiState,
    viewModel: LoginViewModel,
    isDarkMode: Boolean
) {
    val textPrimary = authTextPrimary(isDarkMode)
    val textSecondary = authTextSecondary(isDarkMode)
    val cardColor = authCard(isDarkMode)
    var newPasswordVisible by remember { mutableStateOf(false) }

    Dialog(onDismissRequest = viewModel::dismissForgotPassword) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .background(cardColor, RoundedCornerShape(24.dp))
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                text = "Parolni tiklash",
                color = textPrimary,
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold
            )

            Spacer(modifier = Modifier.height(6.dp))

            if (uiState.forgotStep == 1) {
                Text(
                    text = "Username'ingizni kiriting — tasdiqlash kodi Telegram yoki emailingizga yuboriladi.",
                    color = textSecondary,
                    fontSize = 13.sp,
                    lineHeight = 18.sp,
                    textAlign = TextAlign.Center
                )

                Spacer(modifier = Modifier.height(16.dp))

                PremiumTextField(
                    value = uiState.forgotUsername,
                    onValueChange = viewModel::onForgotUsernameChange,
                    label = "Username",
                    placeholder = "username",
                    leadingIcon = Icons.Default.AlternateEmail,
                    isDarkMode = isDarkMode
                )

                Spacer(modifier = Modifier.height(16.dp))

                PremiumButton(
                    text = "Kod yuborish",
                    onClick = viewModel::submitForgotUsername,
                    isLoading = uiState.forgotLoading
                )
            } else {
                uiState.forgotInfo?.let {
                    Text(
                        text = it,
                        color = AuthBlue,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Medium,
                        textAlign = TextAlign.Center
                    )
                    Spacer(modifier = Modifier.height(14.dp))
                }

                PremiumTextField(
                    value = uiState.forgotOtp,
                    onValueChange = viewModel::onForgotOtpChange,
                    label = "Tasdiqlash kodi",
                    placeholder = "6 xonali kod",
                    leadingIcon = Icons.Default.Pin,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    isDarkMode = isDarkMode
                )

                Spacer(modifier = Modifier.height(12.dp))

                PremiumTextField(
                    value = uiState.forgotNewPassword,
                    onValueChange = viewModel::onForgotNewPasswordChange,
                    label = "Yangi parol",
                    placeholder = "Kamida 8 ta belgi",
                    leadingIcon = Icons.Default.Lock,
                    visualTransformation = if (newPasswordVisible) VisualTransformation.None else PasswordVisualTransformation(),
                    trailingIcon = {
                        IconButton(onClick = { newPasswordVisible = !newPasswordVisible }) {
                            Icon(
                                imageVector = if (newPasswordVisible) Icons.Default.Visibility else Icons.Default.VisibilityOff,
                                contentDescription = null,
                                tint = textSecondary.copy(0.6f)
                            )
                        }
                    },
                    isDarkMode = isDarkMode
                )

                Spacer(modifier = Modifier.height(12.dp))

                PremiumTextField(
                    value = uiState.forgotConfirmPassword,
                    onValueChange = viewModel::onForgotConfirmPasswordChange,
                    label = "Parolni tasdiqlang",
                    placeholder = "Parolni qayta kiriting",
                    leadingIcon = Icons.Default.LockReset,
                    visualTransformation = PasswordVisualTransformation(),
                    isDarkMode = isDarkMode
                )

                Spacer(modifier = Modifier.height(16.dp))

                PremiumButton(
                    text = "Parolni yangilash",
                    onClick = viewModel::submitForgotReset,
                    isLoading = uiState.forgotLoading
                )
            }

            uiState.forgotError?.let {
                Text(
                    text = it,
                    color = AuthError,
                    fontSize = 12.sp,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.padding(top = 12.dp)
                )
            }

            TextButton(onClick = viewModel::dismissForgotPassword, modifier = Modifier.padding(top = 4.dp)) {
                Text("Yopish", color = textSecondary, fontSize = 13.sp)
            }
        }
    }
}
