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
import com.example.myapplication.ui.theme.PremiumBlue
import com.example.myapplication.ui.theme.PremiumTextSecondary

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
            isError = uiState.error != null
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
                        tint = PremiumTextSecondary.copy(0.6f)
                    )
                }
            }
        )

        Box(modifier = Modifier.fillMaxWidth(), contentAlignment = Alignment.CenterEnd) {
            TextButton(
                onClick = { viewModel.togglePasswordResetModal(true) }
            ) {
                Text(
                    "Parolni unutdingizmi?",
                    color = PremiumBlue,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Medium
                )
            }
        }

        Spacer(modifier = Modifier.height(24.dp))

        PremiumButton(
            text = "Kirish",
            onClick = viewModel::login,
            isLoading = uiState.isLoading
        )

        Spacer(modifier = Modifier.height(24.dp))

        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            HorizontalDivider(modifier = Modifier.weight(1f), color = PremiumTextSecondary.copy(0.1f))
            Text(
                text = "yoki",
                modifier = Modifier.padding(horizontal = 16.dp),
                color = PremiumTextSecondary,
                fontSize = 12.sp
            )
            HorizontalDivider(modifier = Modifier.weight(1f), color = PremiumTextSecondary.copy(0.1f))
        }

        Spacer(modifier = Modifier.height(24.dp))

        PremiumSocialButton(
            painter = painterResource(id = R.drawable.ic_google_g),
            text = "Google orqali kirish",
            onClick = { /* Implement Google Sign In if needed */ }
        )

        uiState.error?.let {
            Text(
                text = it,
                color = Color.Red,
                fontSize = 12.sp,
                modifier = Modifier.padding(top = 16.dp)
            )
        }
    }
}
