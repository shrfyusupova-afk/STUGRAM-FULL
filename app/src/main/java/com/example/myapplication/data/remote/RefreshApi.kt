package com.example.myapplication.data.remote

import com.google.gson.JsonObject
import retrofit2.Call
import retrofit2.http.Body
import retrofit2.http.POST

/**
 * Dedicated refresh endpoint. It is served by a Retrofit instance that has
 * NEITHER the auth interceptor NOR the Authenticator attached, so a 401 while
 * refreshing can never re-enter the refresh flow (no infinite loop).
 *
 * Backend contract (already implemented): POST /api/v1/auth/refresh-token
 * body { refreshToken } -> 200 { data: { accessToken, refreshToken, ... } }.
 * The refresh token is rotated server-side, so the returned pair MUST replace
 * the stored one.
 */
interface RefreshApi {
    @POST("api/v1/auth/refresh-token")
    fun refresh(@Body body: RefreshRequest): Call<JsonObject>
}

data class RefreshRequest(val refreshToken: String)
