package com.example.myapplication.push

import android.annotation.SuppressLint
import android.content.Context
import android.provider.Settings
import android.util.Log
import com.example.myapplication.BuildConfig
import com.example.myapplication.data.remote.AuthSession
import com.example.myapplication.data.remote.RetrofitClient
import com.example.myapplication.data.remote.devices.DeletePushTokenRequest
import com.example.myapplication.data.remote.devices.DeviceApi
import com.example.myapplication.data.remote.devices.RegisterPushTokenRequest
import com.google.firebase.messaging.FirebaseMessaging
import kotlin.coroutines.resume
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext

/**
 * Registers/unregisters the FCM token with the backend. Registration is a
 * no-op when the user has no session (the service's onNewToken can fire before
 * login); HomeScreen re-registers on every entry, covering login, register and
 * cold-start restore with one call site.
 */
object PushTokenManager {
    private const val TAG = "PushTokenManager"

    private val deviceApi: DeviceApi by lazy { RetrofitClient.createService(DeviceApi::class.java) }

    suspend fun register(context: Context) = withContext(Dispatchers.IO) {
        if (AuthSession.accessToken.isNullOrBlank()) return@withContext
        val token = fetchFcmToken() ?: return@withContext
        val result = runCatching {
            deviceApi.registerPushToken(
                RegisterPushTokenRequest(
                    token = token,
                    platform = "android",
                    deviceId = stableDeviceId(context),
                    appVersion = BuildConfig.VERSION_NAME
                )
            )
        }
        result.onFailure { Log.w(TAG, "Push token registration failed: ${it.message}") }
        result.onSuccess { response ->
            if (!response.isSuccessful) {
                Log.w(TAG, "Push token registration rejected (${response.code()})")
            }
        }
    }

    /** Must be called BEFORE the session is cleared — the endpoint needs auth. */
    suspend fun unregister(context: Context) = withContext(Dispatchers.IO) {
        if (AuthSession.accessToken.isNullOrBlank()) return@withContext
        val result = runCatching {
            deviceApi.deletePushToken(DeletePushTokenRequest(deviceId = stableDeviceId(context)))
        }
        result.onFailure { Log.w(TAG, "Push token unregister failed: ${it.message}") }
    }

    @SuppressLint("HardwareIds")
    private fun stableDeviceId(context: Context): String =
        Settings.Secure.getString(context.contentResolver, Settings.Secure.ANDROID_ID) ?: "unknown-device"

    // Guarded: if google-services.json wasn't present at build time, no
    // FirebaseApp is configured and getInstance() throws synchronously — this
    // must never crash a screen that merely wants to register for push.
    private suspend fun fetchFcmToken(): String? = runCatching {
        suspendCancellableCoroutine { cont ->
            FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
                cont.resume(if (task.isSuccessful) task.result else null)
            }
        }
    }.onFailure { Log.w(TAG, "FCM unavailable: ${it.message}") }.getOrNull()
}
