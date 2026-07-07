package com.example.myapplication.data.remote

import android.content.Context
import com.example.myapplication.core.storage.TokenManager
import com.example.myapplication.data.remote.chat.ChatSocketManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.channels.BufferOverflow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.withContext

/**
 * Single source of truth for session lifecycle: cold-start restore, explicit
 * logout, and forced logout when a refresh fails. UI observes [forceLogout] to
 * bounce the user back to the Auth screen.
 */
object SessionManager {

    // replay=0 keeps stale logout events from firing on new collectors, while
    // extraBufferCapacity=1 + DROP_OLDEST guarantees tryEmit() always succeeds:
    // if an event is already buffered it is replaced, so we never silently drop
    // a logout because no collector happened to be active at that instant.
    private val _forceLogout = MutableSharedFlow<Unit>(
        replay = 0,
        extraBufferCapacity = 1,
        onBufferOverflow = BufferOverflow.DROP_OLDEST
    )
    val forceLogout: SharedFlow<Unit> = _forceLogout

    enum class Restore { HOME, AUTH }

    /**
     * Reads persisted tokens off the main thread and decides where to start.
     * If the access token is missing/expired but the refresh token is valid,
     * refreshes silently and still lands on HOME.
     */
    suspend fun restoreSession(context: Context): Restore = withContext(Dispatchers.IO) {
        val tokenManager = TokenManager(context)
        tokenManager.initialize()

        val access = tokenManager.peekAccessToken()
        val refresh = tokenManager.peekRefreshToken()

        if (!access.isNullOrBlank() && !JwtUtils.isExpiredOrExpiringSoon(access)) {
            AuthSession.accessToken = access
            ChatSocketManager.updateAccessToken(access)
            return@withContext Restore.HOME
        }

        if (!refresh.isNullOrBlank()) {
            val outcome = RetrofitClient.performRefreshSync(refresh, tokenManager)
            if (outcome is RetrofitClient.RefreshOutcome.Success) {
                // performRefreshSync already updated AuthSession + socket.
                return@withContext Restore.HOME
            }
            if (outcome is RetrofitClient.RefreshOutcome.Transient && !access.isNullOrBlank()) {
                // Server unreachable (e.g. Render cold start) but we still hold a
                // token pair — enter the app optimistically; the Authenticator
                // will refresh on the first real 401.
                AuthSession.accessToken = access
                ChatSocketManager.updateAccessToken(access)
                return@withContext Restore.HOME
            }
        }

        clearLocalSession(tokenManager)
        Restore.AUTH
    }

    /** Explicit user logout (Settings). Fully clears state and signals the UI. */
    suspend fun logout(context: Context) = withContext(Dispatchers.IO) {
        // Needs the still-valid session, so it must run before clearing tokens.
        runCatching { com.example.myapplication.push.PushTokenManager.unregister(context) }
        clearLocalSession(TokenManager(context))
        _forceLogout.tryEmit(Unit)
    }

    /**
     * Called from the OkHttp Authenticator (background thread) when the refresh
     * token is rejected. Wipes the session and asks the UI to return to Auth.
     */
    fun onRefreshFailed(context: Context) {
        val tokenManager = TokenManager(context)
        tokenManager.clearTokensSync()
        AuthSession.accessToken = null
        ChatSocketManager.disconnect()
        _forceLogout.tryEmit(Unit)
    }

    private suspend fun clearLocalSession(tokenManager: TokenManager) {
        runCatching { tokenManager.clearTokens() }
        AuthSession.accessToken = null
        ChatSocketManager.disconnect()
    }
}
