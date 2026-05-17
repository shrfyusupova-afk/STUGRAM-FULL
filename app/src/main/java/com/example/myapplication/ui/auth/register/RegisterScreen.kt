package com.example.myapplication.ui.auth.register

import androidx.compose.animation.*
import androidx.compose.foundation.layout.*
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
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.myapplication.R
import com.example.myapplication.ui.auth.components.*
import com.example.myapplication.ui.theme.PremiumTextSecondary

@Composable
fun RegisterContent(
    viewModel: RegisterViewModel,
    uiState: RegisterUiState,
    onNavigateToLogin: () -> Unit
) {
    var passwordVisible by remember { mutableStateOf(false) }
    var confirmPasswordVisible by remember { mutableStateOf(false) }
    val context = LocalContext.current

    Column(
        modifier = Modifier.fillMaxWidth(),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        // Step 1: Identity
        if (uiState.currentStep == 1) {
            PremiumTextField(
                value = uiState.identity,
                onValueChange = viewModel::onIdentityChange,
                label = "Email yoki Telefon",
                placeholder = "example@gmail.com / +998...",
                leadingIcon = Icons.Default.Email,
                isError = uiState.error != null
            )
            
            Spacer(modifier = Modifier.height(24.dp))
            
            PremiumButton(
                text = "Kodni yuborish",
                onClick = viewModel::sendOtp,
                isLoading = uiState.isLoading
            )

            Spacer(modifier = Modifier.height(24.dp))

            Row(verticalAlignment = Alignment.CenterVertically) {
                HorizontalDivider(modifier = Modifier.weight(1f), color = PremiumTextSecondary.copy(0.1f))
                Text("yoki", modifier = Modifier.padding(horizontal = 16.dp), color = PremiumTextSecondary, fontSize = 12.sp)
                HorizontalDivider(modifier = Modifier.weight(1f), color = PremiumTextSecondary.copy(0.1f))
            }

            Spacer(modifier = Modifier.height(24.dp))

            PremiumSocialButton(
                painter = painterResource(id = R.drawable.ic_google_g),
                text = "Google orqali ro'yxatdan o'tish",
                onClick = { viewModel.loginWithGoogle(context) }
            )
        }

        // Step 2: OTP
        if (uiState.currentStep == 2) {
            Text(
                text = "${uiState.identity} ga yuborilgan kodni kiriting",
                color = PremiumTextSecondary,
                fontSize = 13.sp,
                modifier = Modifier.padding(bottom = 24.dp)
            )
            
            OtpInputField(
                otpText = uiState.otp,
                onOtpTextChange = { code, _ -> viewModel.onOtpChange(code) }
            )

            Spacer(modifier = Modifier.height(32.dp))

            PremiumButton(
                text = "Tasdiqlash",
                onClick = viewModel::verifyOtp,
                isLoading = uiState.isLoading
            )
            
            TextButton(onClick = { viewModel.prevStep() }, modifier = Modifier.padding(top = 8.dp)) {
                Text("Orqaga qaytish", color = PremiumTextSecondary, fontSize = 13.sp)
            }
        }

        // Step 3: Full Registration
        if (uiState.currentStep == 3) {
            PremiumTextField(
                value = uiState.fullName,
                onValueChange = { viewModel.updateField(RegisterField.FullName(it)) },
                label = "Ism Familiya",
                placeholder = "To'liq ismingiz",
                leadingIcon = Icons.Default.Person
            )
            Spacer(modifier = Modifier.height(12.dp))
            
            PremiumTextField(
                value = uiState.username,
                onValueChange = { viewModel.updateField(RegisterField.Username(it)) },
                label = "Username",
                placeholder = "@username",
                leadingIcon = Icons.Default.AlternateEmail
            )
            Spacer(modifier = Modifier.height(12.dp))
            
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Box(modifier = Modifier.weight(1f)) {
                    AuthDropdownField(
                        value = uiState.selectedRegion,
                        onValueChange = { viewModel.updateField(RegisterField.Region(it)) },
                        label = "Viloyat",
                        options = viewModel.regions
                    )
                }
                Box(modifier = Modifier.weight(1f)) {
                    AuthDropdownField(
                        value = uiState.selectedDistrict,
                        onValueChange = { viewModel.updateField(RegisterField.District(it)) },
                        label = "Tuman",
                        options = viewModel.getDistricts(uiState.selectedRegion)
                    )
                }
            }
            
            Spacer(modifier = Modifier.height(12.dp))

            AuthDropdownField(
                value = uiState.selectedSchool,
                onValueChange = { viewModel.updateField(RegisterField.School(it)) },
                label = "Maktab / OTM",
                options = listOf("1-maktab", "2-maktab", "Prezident maktabi", "TATU", "TDPU"),
                leadingIcon = Icons.Default.School
            )

            Spacer(modifier = Modifier.height(12.dp))

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
                            tint = PremiumTextSecondary.copy(0.6f)
                        )
                    }
                }
            )
            
            Spacer(modifier = Modifier.height(12.dp))
            
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
                            tint = PremiumTextSecondary.copy(0.6f)
                        )
                    }
                }
            )

            Spacer(modifier = Modifier.height(24.dp))

            PremiumButton(
                text = "Ro'yxatdan o'tish",
                onClick = { viewModel.register(context) },
                isLoading = uiState.isLoading
            )
            
            TextButton(onClick = { viewModel.prevStep() }, modifier = Modifier.padding(top = 8.dp)) {
                Text("Orqaga", color = PremiumTextSecondary, fontSize = 13.sp)
            }
        }

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
