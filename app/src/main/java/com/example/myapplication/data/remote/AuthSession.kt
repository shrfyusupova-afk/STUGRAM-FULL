package com.example.myapplication.data.remote

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

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
}
