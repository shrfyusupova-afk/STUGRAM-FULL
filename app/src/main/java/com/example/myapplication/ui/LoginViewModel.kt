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
        _uiState.update { it.copy(showPasswordResetModal = show) }
    }
}

data class LoginUiState(
    val username: String = "",
    val password: String = "",
    val isLoading: Boolean = false,
    val error: String? = null,
    val isSuccess: Boolean = false,
    val showPasswordResetModal: Boolean = false
)
