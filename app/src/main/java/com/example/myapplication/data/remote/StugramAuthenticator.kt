package com.example.myapplication.data.remote

import android.content.Context
import com.example.myapplication.core.storage.TokenManager
import okhttp3.Authenticator
import okhttp3.Request
import okhttp3.Response
import okhttp3.Route

/**
 * Refreshes the access token exactly once per 401 burst, then retries the
 * failed request. Runs on OkHttp's background dispatcher, so blocking token
 * I/O here is safe (never the main thread).
 *
 * Edge cases handled:
 *  - Concurrent 401s: a single [refreshLock] serializes refreshes; threads that
 *    arrive after another has already refreshed simply retry with the new token.
 *  - Refresh endpoint itself failing with 401/403: force logout to the Auth screen.
 *  - Retry loops: [MAX_ATTEMPTS] caps how many times we re-sign a single request.
 */
class StugramAuthenticator(
    private val contextProvider: () -> Context?
) : Authenticator {

    override fun authenticate(route: Route?, response: Response): Request? {
        val context = contextProvider() ?: return null

        // Never try to refresh the refresh call or anything without prior auth.
        val failedAuthHeader = response.request.header("Authorization") ?: return null
        val failedToken = failedAuthHeader.removePrefix("Bearer ").trim()

        if (attemptCount(response) >= MAX_ATTEMPTS) {
            // We already retried this request after a refresh and still got 401.
            SessionManager.onRefreshFailed(context)
            return null
        }

        synchronized(refreshLock) {
            val current = AuthSession.accessToken

            // Another parallel request already refreshed the token — just retry.
            if (!current.isNullOrBlank() && current != failedToken) {
                return response.request.newBuilder()
                    .header("Authorization", "Bearer $current")
                    .build()
            }

            val tokenManager = TokenManager(context)
            val refresh = tokenManager.peekRefreshToken()
            if (refresh.isNullOrBlank()) {
                SessionManager.onRefreshFailed(context)
                return null
            }

            return when (val outcome = RetrofitClient.performRefreshSync(refresh, tokenManager)) {
                is RetrofitClient.RefreshOutcome.Success ->
                    response.request.newBuilder()
                        .header("Authorization", "Bearer ${outcome.accessToken}")
                        .build()

                RetrofitClient.RefreshOutcome.AuthError -> {
                    SessionManager.onRefreshFailed(context)
                    null
                }

                // Transient network error: don't destroy the session, just give up
                // on this request. It can be retried by the caller later.
                RetrofitClient.RefreshOutcome.Transient -> null
            }
        }
    }

    private fun attemptCount(response: Response): Int {
        var prior = response.priorResponse
        var count = 1
        while (prior != null) {
            count++
            prior = prior.priorResponse
        }
        return count
    }

    companion object {
        private const val MAX_ATTEMPTS = 2
        private val refreshLock = Any()
    }
}
