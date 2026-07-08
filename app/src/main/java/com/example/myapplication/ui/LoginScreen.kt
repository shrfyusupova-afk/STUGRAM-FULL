package com.example.myapplication.ui

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AlternateEmail
import androidx.compose.material.icons.filled.Lock
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
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.myapplication.R
import com.example.myapplication.ui.auth.components.PremiumButton
import com.example.myapplication.ui.auth.components.PremiumTextField
import com.example.myapplication.ui.auth.components.PremiumSocialButton
import com.example.myapplication.ui.theme.AuthBlue
import com.example.myapplication.ui.theme.AuthError
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
                onClick = { viewModel.togglePasswordResetModal(true) }
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
    }
}
