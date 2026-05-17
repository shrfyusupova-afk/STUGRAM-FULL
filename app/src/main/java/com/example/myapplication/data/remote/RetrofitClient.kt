package com.example.myapplication.data.remote

import com.example.myapplication.core.storage.TokenManager
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit
import com.example.myapplication.BuildConfig

object RetrofitClient {
    private const val BASE_URL = "https://stugram-beckend.onrender.com/"

    // Sensitive JSON field names to redact from debug logs.
    private val sensitiveJsonFields = listOf(
        "accessToken", "refreshToken", "token", "password",
        "currentPassword", "newPassword", "confirmPassword", "otp", "code"
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
        level = if (BuildConfig.DEBUG) HttpLoggingInterceptor.Level.BODY
                else HttpLoggingInterceptor.Level.NONE
    }

    // Injected by MainActivity.initialize() before any network call is made.
    @Volatile private var tokenManager: TokenManager? = null
    @Volatile private var authenticator: TokenAuthenticator? = null

    // Called once from MainActivity.onCreate() before the UI is shown so the
    // authenticator has a TokenManager before the first request fires.
    fun initialize(manager: TokenManager) {
        if (tokenManager != null) return  // guard against double-init
        tokenManager = manager
        authenticator = TokenAuthenticator(
            tokenManager = manager,
            refreshApiProvider = { refreshClient.create(AuthApi::class.java) }
        )
    }

    // Plain client used only by TokenAuthenticator for the refresh call.
    // Must NOT have an authenticator attached to avoid infinite 401 loops.
    private val refreshClient: Retrofit by lazy {
        Retrofit.Builder()
            .baseUrl(BASE_URL)
            .client(
                OkHttpClient.Builder()
                    .connectTimeout(30, TimeUnit.SECONDS)
                    .readTimeout(30, TimeUnit.SECONDS)
                    .writeTimeout(30, TimeUnit.SECONDS)
                    .build()
            )
            .addConverterFactory(GsonConverterFactory.create())
            .build()
    }

    private val okHttpClient: OkHttpClient by lazy {
        OkHttpClient.Builder()
            .addInterceptor { chain ->
                val requestBuilder = chain.request().newBuilder()
                val token = AuthSession.accessToken
                if (!token.isNullOrBlank()) {
                    requestBuilder.addHeader("Authorization", "Bearer $token")
                }
                chain.proceed(requestBuilder.build())
            }
            .addInterceptor(loggingInterceptor)
            .authenticator(
                authenticator
                    ?: throw IllegalStateException(
                        "RetrofitClient.initialize(tokenManager) must be called from " +
                        "MainActivity.onCreate() before any network request is made."
                    )
            )
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .writeTimeout(30, TimeUnit.SECONDS)
            .build()
    }

    private val retrofit: Retrofit by lazy {
        Retrofit.Builder()
            .baseUrl(BASE_URL)
            .client(okHttpClient)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
    }

    val instance: AuthApi by lazy {
        retrofit.create(AuthApi::class.java)
    }

    fun <T> createService(service: Class<T>): T = retrofit.create(service)
}
