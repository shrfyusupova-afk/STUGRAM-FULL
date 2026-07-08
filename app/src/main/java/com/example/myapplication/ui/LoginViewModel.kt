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
import com.example.myapplication.data.remote.LoginRequest
import com.example.myapplication.data.remote.OtpRequest
import com.example.myapplication.data.remote.ResetPasswordRequest
import com.example.myapplication.data.remote.VerifyOtpRequest
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.gson.JsonParser
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
                        AuthSession.accessToken = access
                        ChatSocketManager.updateAccessToken(access)
                        TokenManager(context).saveTokens(access, refresh)
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
                        AuthSession.accessToken = access
                        ChatSocketManager.updateAccessToken(access)
                        TokenManager(context).saveTokens(access, refresh)
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

    // --- Parolni tiklash (username → Telegram/email OTP → yangi parol) ---

    fun openForgotPassword() {
        _uiState.update {
            it.copy(
                forgotVisible = true,
                forgotStep = 1,
                forgotUsername = it.username.trim(),
                forgotOtp = "",
                forgotNewPassword = "",
                forgotConfirmPassword = "",
                forgotLoading = false,
                forgotError = null,
                forgotInfo = null
            )
        }
    }

    fun dismissForgotPassword() {
        _uiState.update { it.copy(forgotVisible = false, forgotError = null) }
    }

    fun onForgotUsernameChange(value: String) {
        _uiState.update { it.copy(forgotUsername = value, forgotError = null) }
    }

    fun onForgotOtpChange(value: String) {
        if (value.length <= 6 && value.all { c -> c.isDigit() }) {
            _uiState.update { it.copy(forgotOtp = value, forgotError = null) }
        }
    }

    fun onForgotNewPasswordChange(value: String) {
        _uiState.update { it.copy(forgotNewPassword = value, forgotError = null) }
    }

    fun onForgotConfirmPasswordChange(value: String) {
        _uiState.update { it.copy(forgotConfirmPassword = value, forgotError = null) }
    }

    private fun parseApiMessage(raw: String?): String? = try {
        raw?.let { JsonParser.parseString(it).asJsonObject.get("message")?.asString }
    } catch (_: Exception) {
        null
    }

    fun submitForgotUsername() {
        val username = _uiState.value.forgotUsername.trim()
        if (username.length < 3) {
            _uiState.update { it.copy(forgotError = "Username kiriting") }
            return
        }

        viewModelScope.launch {
            _uiState.update { it.copy(forgotLoading = true, forgotError = null) }
            try {
                val response = withContext(Dispatchers.IO) {
                    RetrofitClient.instance.sendOtp(OtpRequest(identity = username, purpose = "forgot_password"))
                }
                if (response.isSuccessful) {
                    val data = response.body()?.getAsJsonObject("data")
                    val channel = data?.get("channel")?.takeIf { !it.isJsonNull }?.asString
                    val masked = data?.get("maskedDestination")?.takeIf { !it.isJsonNull }?.asString
                    val info = when (channel) {
                        "telegram" -> "Tasdiqlash kodi Telegramingizga yuborildi 📩"
                        "email" -> "Tasdiqlash kodi emailingizga yuborildi${if (masked != null) " ($masked)" else ""}"
                        "sms" -> "Tasdiqlash kodi SMS orqali yuborildi${if (masked != null) " ($masked)" else ""}"
                        else -> "Tasdiqlash kodi yuborildi"
                    }
                    _uiState.update { it.copy(forgotLoading = false, forgotStep = 2, forgotInfo = info) }
                } else {
                    val msg = parseApiMessage(response.errorBody()?.string())
                    _uiState.update { it.copy(forgotLoading = false, forgotError = msg ?: "Xatolik (${response.code()})") }
                }
            } catch (e: Exception) {
                _uiState.update { it.copy(forgotLoading = false, forgotError = "Tarmoq xatosi: ${e.message}") }
            }
        }
    }

    fun submitForgotReset() {
        val state = _uiState.value
        val username = state.forgotUsername.trim()
        if (state.forgotOtp.length != 6) {
            _uiState.update { it.copy(forgotError = "6 xonali kodni kiriting") }
            return
        }
        if (state.forgotNewPassword.length < 8) {
            _uiState.update { it.copy(forgotError = "Parol kamida 8 ta belgidan iborat bo'lsin") }
            return
        }
        if (state.forgotNewPassword != state.forgotConfirmPassword) {
            _uiState.update { it.copy(forgotError = "Parollar mos kelmadi") }
            return
        }

        viewModelScope.launch {
            _uiState.update { it.copy(forgotLoading = true, forgotError = null) }
            try {
                val verifyResponse = withContext(Dispatchers.IO) {
                    RetrofitClient.instance.verifyOtp(
                        VerifyOtpRequest(identity = username, otp = state.forgotOtp, purpose = "forgot_password")
                    )
                }
                if (!verifyResponse.isSuccessful) {
                    val msg = parseApiMessage(verifyResponse.errorBody()?.string())
                    _uiState.update { it.copy(forgotLoading = false, forgotError = msg ?: "Kod noto'g'ri (${verifyResponse.code()})") }
                    return@launch
                }

                val resetResponse = withContext(Dispatchers.IO) {
                    RetrofitClient.instance.resetPassword(
                        ResetPasswordRequest(
                            identity = username,
                            otp = state.forgotOtp,
                            password = state.forgotNewPassword,
                            confirmPassword = state.forgotConfirmPassword
                        )
                    )
                }
                if (resetResponse.isSuccessful) {
                    _uiState.update {
                        it.copy(
                            forgotLoading = false,
                            forgotVisible = false,
                            username = username,
                            password = "",
                            error = null,
                            infoMessage = "Parol yangilandi ✅ Endi yangi parol bilan kiring"
                        )
                    }
                } else {
                    val msg = parseApiMessage(resetResponse.errorBody()?.string())
                    _uiState.update { it.copy(forgotLoading = false, forgotError = msg ?: "Xatolik (${resetResponse.code()})") }
                }
            } catch (e: Exception) {
                _uiState.update { it.copy(forgotLoading = false, forgotError = "Tarmoq xatosi: ${e.message}") }
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
    val infoMessage: String? = null,
    val forgotVisible: Boolean = false,
    val forgotStep: Int = 1,
    val forgotUsername: String = "",
    val forgotOtp: String = "",
    val forgotNewPassword: String = "",
    val forgotConfirmPassword: String = "",
    val forgotLoading: Boolean = false,
    val forgotError: String? = null,
    val forgotInfo: String? = null
)
