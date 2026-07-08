package com.example.myapplication.data.remote

import android.content.Context
import com.example.myapplication.BuildConfig
import com.example.myapplication.core.storage.TokenManager
import java.io.IOException
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit

object RetrofitClient {
    private const val BASE_URL = "https://stugram-beckend.onrender.com/"

    // Application context, set once from Application/MainActivity. Used by the
    // Authenticator to read/rotate encrypted tokens off the main thread.
    @Volatile
    private var appContext: Context? = null

    fun initialize(context: Context) {
        if (appContext == null) {
            appContext = context.applicationContext
        }
    }

    private val sensitiveJsonFields = listOf(
        "accessToken",
        "refreshToken",
        "token",
        "password",
        "currentPassword",
        "newPassword",
        "confirmPassword",
        "otp",
        "code"
    )

    private fun sanitizeLogLine(line: String): String {
        var sanitized = line.replace(Regex("Bearer\\s+[A-Za-z0-9\\-._~+/]+=*"), "Bearer ***")
        sensitiveJsonFields.forEach { field ->
            sanitized = sanitized.replace(
                Regex("\"$field\"\\s*:\\s*\"[^\"]*\"", RegexOption.IGNORE_CASE),
                "\"$field\":\"***\""
            )
        }
        return sanitized
    }

    private val loggingInterceptor = HttpLoggingInterceptor { message ->
        if (BuildConfig.DEBUG) {
            HttpLoggingInterceptor.Logger.DEFAULT.log(sanitizeLogLine(message))
        }
    }.apply {
        redactHeader("Authorization")
        redactHeader("Cookie")
        level = if (BuildConfig.DEBUG) {
            HttpLoggingInterceptor.Level.BODY
        } else {
            HttpLoggingInterceptor.Level.NONE
        }
    }

    private val okHttpClient = OkHttpClient.Builder()
        .addInterceptor { chain ->
            val requestBuilder = chain.request().newBuilder()
            val token = AuthSession.accessToken
            if (!token.isNullOrBlank()) {
                requestBuilder.addHeader("Authorization", "Bearer $token")
            }
            chain.proceed(requestBuilder.build())
        }
        .addInterceptor(loggingInterceptor)
        // On 401 this refreshes the token pair once (guarded), then retries.
        .authenticator(StugramAuthenticator { appContext })
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .build()

    // Separate client for /auth/refresh-token: NO auth interceptor and NO
    // Authenticator, so a 401 here cannot re-enter the refresh flow.
    private val refreshOkHttpClient = OkHttpClient.Builder()
        .addInterceptor(loggingInterceptor)
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .build()

    private val retrofit: Retrofit by lazy {
        Retrofit.Builder()
            .baseUrl(BASE_URL)
            .client(okHttpClient)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
    }

    private val refreshRetrofit: Retrofit by lazy {
        Retrofit.Builder()
            .baseUrl(BASE_URL)
            .client(refreshOkHttpClient)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
    }

    val instance: AuthApi by lazy {
        retrofit.create(AuthApi::class.java)
    }

    private val refreshApi: RefreshApi by lazy {
        refreshRetrofit.create(RefreshApi::class.java)
    }

    fun <T> createService(service: Class<T>): T {
        return retrofit.create(service)
    }

    /**
     * Result of a synchronous refresh attempt.
     * - [Success]: got a fresh access token (already persisted + cached).
     * - [AuthError]: server rejected the refresh token (401/403) -> caller must log out.
     * - [Transient]: network/other failure -> keep the session, just fail this call.
     */
    sealed class RefreshOutcome {
        data class Success(val accessToken: String) : RefreshOutcome()
        object AuthError : RefreshOutcome()
        object Transient : RefreshOutcome()
    }

    /**
     * Calls the refresh endpoint synchronously (BACKGROUND THREAD ONLY: splash
     * coroutine on Dispatchers.IO, or the OkHttp Authenticator). Rotates and
     * persists the new token pair on success and updates [AuthSession] + the
     * chat socket.
     */
    fun performRefreshSync(refreshToken: String, tokenManager: TokenManager): RefreshOutcome {
        val response = try {
            refreshApi.refresh(RefreshRequest(refreshToken)).execute()
        } catch (_: IOException) {
            return RefreshOutcome.Transient
        }

        if (response.code() == 401 || response.code() == 403) {
            return RefreshOutcome.AuthError
        }
        if (!response.isSuccessful) {
            return RefreshOutcome.Transient
        }

        val data = response.body()?.getAsJsonObject("data")
        val newAccess = data?.get("accessToken")?.takeUnless { it.isJsonNull }?.asString
        val newRefresh = data?.get("refreshToken")?.takeUnless { it.isJsonNull }?.asString
        if (newAccess.isNullOrBlank() || newRefresh.isNullOrBlank()) {
            return RefreshOutcome.AuthError
        }

        tokenManager.saveTokensSync(newAccess, newRefresh)
        AuthSession.accessToken = newAccess
        com.example.myapplication.data.remote.chat.ChatSocketManager.updateAccessToken(newAccess)
        return RefreshOutcome.Success(newAccess)
    }
}
