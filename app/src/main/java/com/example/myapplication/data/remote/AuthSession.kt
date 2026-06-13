package com.example.myapplication.data.remote

import android.util.Base64
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import org.json.JSONObject

/**
 * In-memory auth session. The access token here is the live value used by
 * RetrofitClient interceptors and ChatSocketManager. It is populated at app
 * startup from EncryptedSharedPreferences via TokenManager and cleared on
 * logout or when a token refresh fails.
 *
 * Observers (e.g. AuthNavGraph) can watch [sessionState] to react to
 * forced logouts triggered by an expired refresh token.
 */
object AuthSession {

    enum class State { AUTHENTICATED, LOGGED_OUT }

    private val _sessionState = MutableStateFlow(State.LOGGED_OUT)
    val sessionState: StateFlow<State> = _sessionState.asStateFlow()

    @Volatile
    var accessToken: String? = null
        private set

    fun setToken(token: String) {
        accessToken = token
        _sessionState.value = State.AUTHENTICATED
    }

    fun clearSession() {
        accessToken = null
        _sessionState.value = State.LOGGED_OUT
    }

    /**
     * The current profile id (`pid` claim, falling back to legacy `sub`),
     * decoded from the JWT access token. Used to determine "mine" state for
     * reactions, replies, and pinned messages without an extra API call.
     */
    val currentUserId: String?
        get() = accessToken?.let { decodeProfileIdFromJwt(it) }

    private fun decodeProfileIdFromJwt(token: String): String? {
        return try {
            val parts = token.split(".")
            if (parts.size < 2) return null
            val payloadJson = String(Base64.decode(parts[1], Base64.URL_SAFE or Base64.NO_WRAP or Base64.NO_PADDING))
            val payload = JSONObject(payloadJson)
            payload.optString("pid").ifBlank { payload.optString("sub") }.ifBlank { null }
        } catch (_: Exception) {
            null
        }
    }
}
