package com.example.myapplication.data.remote

import com.example.myapplication.BuildConfig
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit

object RetrofitClient {
    private const val BASE_URL = "https://stugram-beckend.onrender.com/"

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

    val instance: AuthApi by lazy {
        retrofit.create(AuthApi::class.java)
    }

    fun <T> createService(service: Class<T>): T {
        return retrofit.create(service)
    }
}
