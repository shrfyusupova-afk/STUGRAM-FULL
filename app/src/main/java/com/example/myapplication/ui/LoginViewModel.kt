package com.example.myapplication.ui

import android.content.Context
import com.example.myapplication.R
import com.example.myapplication.core.storage.TokenManager
import com.example.myapplication.data.remote.AuthSession
import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import com.example.myapplication.data.remote.GoogleLoginRequest
import com.example.myapplication.data.remote.RetrofitClient
import com.example.myapplication.data.remote.chat.ChatSocketManager
import com.google.android.libraries.identity.googleid.GetGoogleIdOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import com.google.android.libraries.identity.googleid.GoogleIdTokenParsingException
import com.example.myapplication.data.remote.ForgotPasswordRequest
import com.example.myapplication.data.remote.LoginRequest
import com.example.myapplication.data.remote.ResetPasswordRequest
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class LoginViewModel : ViewModel() {

    private val _uiState = MutableStateFlow(LoginUiState())
    val uiState: StateFlow<LoginUiState> = _uiState.asStateFlow()

    fun onUsernameChange(username: String) {
        _uiState.update { it.copy(username = username, error = null) }
    }

    fun onPasswordChange(password: String) {
        _uiState.update { it.copy(password = password, error = null) }
    }

    fun login(context: Context) {
        if (_uiState.value.username.isBlank() || _uiState.value.password.isBlank()) {
            _uiState.update { it.copy(error = "Iltimos, barcha maydonlarni to'ldiring") }
            return
        }

        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }
            try {
                val response = withContext(Dispatchers.IO) {
                    RetrofitClient.instance.login(
                        LoginRequest(
                            identityOrUsername = _uiState.value.username.trim(),
                            password = _uiState.value.password
                        )
                    )
                }

                if (response.isSuccessful) {
                    val data = response.body()?.getAsJsonObject("data")
                    val access = data?.get("accessToken")?.asString
                    val refresh = data?.get("refreshToken")?.asString
                    if (!access.isNullOrBlank() && !refresh.isNullOrBlank()) {
                        TokenManager(context).saveTokens(access, refresh)
                        AuthSession.setToken(access)
                        ChatSocketManager.updateAccessToken(access)
                    }
                    _uiState.update { it.copy(isLoading = false, isSuccess = true) }
                } else {
                    val body = response.errorBody()?.string()?.take(250)
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            error = "Login xatosi (${response.code()}): ${body ?: "Invalid credentials"}"
                        )
                    }
                }
            } catch (e: Exception) {
                _uiState.update { it.copy(isLoading = false, error = "Tarmoq xatosi: ${e.message}") }
            }
        }
    }

    fun loginWithGoogle(context: Context) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }
            try {
                val webClientId = context.getString(R.string.google_web_client_id).trim()
                if (webClientId.isBlank() || webClientId == "YOUR_GOOGLE_WEB_CLIENT_ID") {
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            error = "Google Client ID o'rnatilmagan. strings.xml ga google_web_client_id qo'shing."
                        )
                    }
                    return@launch
                }

                val credentialManager = CredentialManager.create(context)
                val googleIdOption = GetGoogleIdOption.Builder()
                    .setFilterByAuthorizedAccounts(false)
                    .setServerClientId(webClientId)
                    .setAutoSelectEnabled(false)
                    .build()

                val request = GetCredentialRequest.Builder()
                    .addCredentialOption(googleIdOption)
                    .build()

                val result = credentialManager.getCredential(context, request)
                val credential = result.credential

                if (credential !is CustomCredential || credential.type != GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL) {
                    _uiState.update { it.copy(isLoading = false, error = "Google credential olinmadi") }
                    return@launch
                }

                val googleIdTokenCredential = try {
                    GoogleIdTokenCredential.createFrom(credential.data)
                } catch (_: GoogleIdTokenParsingException) {
                    _uiState.update { it.copy(isLoading = false, error = "Google token parse xatosi") }
                    return@launch
                }

                val idToken = googleIdTokenCredential.idToken
                val response = withContext(Dispatchers.IO) {
                    RetrofitClient.instance.googleLogin(GoogleLoginRequest(idToken))
                }

                if (response.isSuccessful) {
                    val data = response.body()?.getAsJsonObject("data")
                    val access = data?.get("accessToken")?.asString
                    val refresh = data?.get("refreshToken")?.asString
                    if (!access.isNullOrBlank() && !refresh.isNullOrBlank()) {
                        TokenManager(context).saveTokens(access, refresh)
                        AuthSession.setToken(access)
                        ChatSocketManager.updateAccessToken(access)
                    } else {
                        _uiState.update {
                            it.copy(
                                isLoading = false,
                                error = "Google login javobi noto'g'ri formatda (token topilmadi)."
                            )
                        }
                        return@launch
                    }
                    _uiState.update { it.copy(isLoading = false, isSuccess = true) }
                } else {
                    val errorBody = response.errorBody()?.string()?.take(300)
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            error = "Google login muvaffaqiyatsiz (${response.code()}) ${errorBody ?: ""}".trim()
                        )
                    }
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        error = "Google login xatosi: ${e.message ?: "Unknown error"}"
                    )
                }
            }
        }
    }

    fun togglePasswordResetModal(show: Boolean) {
        _uiState.update {
            it.copy(
                showPasswordResetModal = show,
                resetStep = 1,
                resetEmail = "",
                resetOtp = "",
                resetNewPassword = "",
                resetConfirmPassword = "",
                resetError = null,
                resetSuccess = false,
                resetOtpSent = false
            )
        }
    }

    fun onResetEmailChange(value: String) {
        _uiState.update { it.copy(resetEmail = value, resetError = null) }
    }

    fun onResetOtpChange(value: String) {
        _uiState.update { it.copy(resetOtp = value, resetError = null) }
    }

    fun onResetNewPasswordChange(value: String) {
        _uiState.update { it.copy(resetNewPassword = value, resetError = null) }
    }

    fun onResetConfirmPasswordChange(value: String) {
        _uiState.update { it.copy(resetConfirmPassword = value, resetError = null) }
    }

    fun advanceResetToStep3() {
        if (_uiState.value.resetOtp.length != 6) {
            _uiState.update { it.copy(resetError = "6 xonali kodni to'liq kiriting") }
            return
        }
        _uiState.update { it.copy(resetStep = 3, resetError = null) }
    }

    fun prevResetStep() {
        val step = _uiState.value.resetStep
        if (step > 1) {
            _uiState.update { it.copy(resetStep = step - 1, resetError = null) }
        } else {
            togglePasswordResetModal(false)
        }
    }

    fun submitForgotPassword() {
        val email = _uiState.value.resetEmail.trim()
        if (email.isBlank()) {
            _uiState.update { it.copy(resetError = "Email yoki username kiriting") }
            return
        }
        viewModelScope.launch {
            _uiState.update { it.copy(isResetLoading = true, resetError = null) }
            try {
                val response = withContext(Dispatchers.IO) {
                    RetrofitClient.instance.forgotPassword(ForgotPasswordRequest(identity = email))
                }
                if (response.isSuccessful) {
                    _uiState.update { it.copy(isResetLoading = false, resetOtpSent = true, resetStep = 2) }
                } else {
                    val body = response.errorBody()?.string()?.take(250)
                    _uiState.update {
                        it.copy(
                            isResetLoading = false,
                            resetError = "Xato (${response.code()}): ${body ?: "So'rov muvaffaqiyatsiz"}"
                        )
                    }
                }
            } catch (e: Exception) {
                _uiState.update { it.copy(isResetLoading = false, resetError = "Tarmoq xatosi: ${e.message}") }
            }
        }
    }

    fun submitResetPassword() {
        val state = _uiState.value
        if (state.resetOtp.isBlank() || state.resetNewPassword.isBlank() || state.resetConfirmPassword.isBlank()) {
            _uiState.update { it.copy(resetError = "Barcha maydonlarni to'ldiring") }
            return
        }
        if (state.resetNewPassword.length < 8) {
            _uiState.update { it.copy(resetError = "Parol kamida 8 ta belgidan iborat bo'lishi kerak") }
            return
        }
        if (state.resetNewPassword != state.resetConfirmPassword) {
            _uiState.update { it.copy(resetError = "Parollar mos kelmadi") }
            return
        }
        viewModelScope.launch {
            _uiState.update { it.copy(isResetLoading = true, resetError = null) }
            try {
                val response = withContext(Dispatchers.IO) {
                    RetrofitClient.instance.resetPassword(
                        ResetPasswordRequest(
                            identity = state.resetEmail.trim(),
                            otp = state.resetOtp.trim(),
                            password = state.resetNewPassword,
                            confirmPassword = state.resetConfirmPassword
                        )
                    )
                }
                if (response.isSuccessful) {
                    _uiState.update { it.copy(isResetLoading = false, resetSuccess = true, resetStep = 4) }
                } else {
                    val body = response.errorBody()?.string()?.take(250)
                    _uiState.update {
                        it.copy(
                            isResetLoading = false,
                            resetError = "Xato (${response.code()}): ${body ?: "Parolni tiklash muvaffaqiyatsiz"}"
                        )
                    }
                }
            } catch (e: Exception) {
                _uiState.update { it.copy(isResetLoading = false, resetError = "Tarmoq xatosi: ${e.message}") }
            }
        }
    }
}

data class LoginUiState(
    val username: String = "",
    val password: String = "",
    val isLoading: Boolean = false,
    val error: String? = null,
    val isSuccess: Boolean = false,
    val showPasswordResetModal: Boolean = false,
    val resetStep: Int = 1,
    val resetEmail: String = "",
    val resetOtp: String = "",
    val resetNewPassword: String = "",
    val resetConfirmPassword: String = "",
    val isResetLoading: Boolean = false,
    val resetError: String? = null,
    val resetOtpSent: Boolean = false,
    val resetSuccess: Boolean = false
)
