package com.example.myapplication.data.remote

import android.util.Base64
import org.json.JSONObject

/**
 * Minimal, dependency-free JWT inspection. We only read the `exp` claim to
 * decide whether to refresh silently at startup — we never trust it for
 * authorization (the server is the source of truth). No token value is logged.
 */
object JwtUtils {
    /**
     * Returns true if the token is missing/malformed or expires within [skewSeconds].
     * A short skew avoids racing a token that dies mid-request.
     */
    fun isExpiredOrExpiringSoon(token: String?, skewSeconds: Long = 30): Boolean {
        val exp = expiryEpochSeconds(token) ?: return true
        val nowSeconds = System.currentTimeMillis() / 1000
        return exp - skewSeconds <= nowSeconds
    }

    private fun expiryEpochSeconds(token: String?): Long? {
        if (token.isNullOrBlank()) return null
        val parts = token.split(".")
        if (parts.size < 2) return null
        return runCatching {
            val payloadJson = String(
                Base64.decode(parts[1], Base64.URL_SAFE or Base64.NO_WRAP or Base64.NO_PADDING)
            )
            val exp = JSONObject(payloadJson).optLong("exp", 0L)
            if (exp > 0L) exp else null
        }.getOrNull()
    }
}
