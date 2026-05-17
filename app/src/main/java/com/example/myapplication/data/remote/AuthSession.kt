package com.example.myapplication.data.remote

object AuthSession {
    @Volatile
    var accessToken: String? = null
}
