package com.example.myapplication.data.remote.devices

import com.google.gson.JsonObject
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.HTTP
import retrofit2.http.POST

/**
 * Device push-token endpoints (confirmed backend contract, deviceRoutes.js):
 *  - POST   /api/v1/devices/push-token { token, platform, deviceId, appVersion? }
 *  - DELETE /api/v1/devices/push-token { token | deviceId } (body required, so @HTTP hasBody)
 */
interface DeviceApi {
    @POST("api/v1/devices/push-token")
    suspend fun registerPushToken(@Body body: RegisterPushTokenRequest): Response<JsonObject>

    @HTTP(method = "DELETE", path = "api/v1/devices/push-token", hasBody = true)
    suspend fun deletePushToken(@Body body: DeletePushTokenRequest): Response<JsonObject>
}

data class RegisterPushTokenRequest(
    val token: String,
    val platform: String = "android",
    val deviceId: String,
    val appVersion: String? = null
)

data class DeletePushTokenRequest(
    val token: String? = null,
    val deviceId: String? = null
)
