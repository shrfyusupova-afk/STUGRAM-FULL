package com.example.myapplication.data.remote

import com.example.myapplication.core.storage.TokenManager
import com.example.myapplication.data.remote.chat.ChatSocketManager
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import okhttp3.Authenticator
import okhttp3.Request
import okhttp3.Response
import okhttp3.Route

/**
 * OkHttp [Authenticator] that transparently refreshes the JWT access token
 * when the server returns 401 Unauthorized.
 *
 * Flow:
 *  1. Server returns 401.
 *  2. OkHttp calls authenticate(); we check the refresh token from storage.
 *  3. We call POST /api/v1/auth/refresh via a dedicated plain client (no
 *     authenticator attached) to avoid infinite 401 → refresh loops.
 *  4. On success: persist new tokens, update AuthSession and ChatSocket, retry.
 *  5. On failure (expired refresh, network error): clear all tokens and
 *     signal AuthSession.State.LOGGED_OUT so the nav graph routes to login.
 *
 * Concurrency: the @Synchronized annotation + responseCount guard prevents
 * parallel 401 responses from triggering multiple simultaneous refresh calls.
 */
class TokenAuthenticator(
    private val tokenManager: TokenManager,
    private val refreshApiProvider: () -> AuthApi
) : Authenticator {

    @Synchronized
    override fun authenticate(route: Route?, response: Response): Request? {
        // If we've already retried once on this chain, give up to prevent loops.
        if (responseCount(response) > 1) {
            forceLogout()
            return null
        }

        val refreshToken = runBlocking { tokenManager.refreshToken.first() }
        if (refreshToken.isNullOrBlank()) {
            forceLogout()
            return null
        }

        return try {
            val refreshResponse = runBlocking {
                refreshApiProvider().refreshToken(RefreshTokenRequest(refreshToken))
            }

            if (!refreshResponse.isSuccessful) {
                forceLogout()
                return null
            }

            val data = refreshResponse.body()?.getAsJsonObject("data")
            val newAccess = data?.get("accessToken")?.asString
            val newRefresh = data?.get("refreshToken")?.asString

            if (newAccess.isNullOrBlank() || newRefresh.isNullOrBlank()) {
                forceLogout()
                return null
            }

            runBlocking { tokenManager.saveTokens(newAccess, newRefresh) }
            AuthSession.setToken(newAccess)
            ChatSocketManager.updateAccessToken(newAccess)

            response.request.newBuilder()
                .header("Authorization", "Bearer $newAccess")
                .build()
        } catch (_: Exception) {
            forceLogout()
            null
        }
    }

    private fun forceLogout() {
        runBlocking { tokenManager.clearTokens() }
        AuthSession.clearSession()
        ChatSocketManager.updateAccessToken(null)
    }

    private fun responseCount(response: Response): Int {
        var count = 1
        var prior = response.priorResponse
        while (prior != null) {
            count++
            prior = prior.priorResponse
        }
        return count
    }
}
