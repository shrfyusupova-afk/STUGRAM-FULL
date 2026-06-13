package com.example.myapplication.core.storage

import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow

private val Context.dataStore by preferencesDataStore(name = "auth_prefs")

class TokenManager(private val context: Context) {
    private val accessTokenKey = stringPreferencesKey("access_token")
    private val refreshTokenKey = stringPreferencesKey("refresh_token")

    private val securePrefs: SharedPreferences by lazy { createSecurePrefs() }

    private val accessState = MutableStateFlow<String?>(null)
    private val refreshState = MutableStateFlow<String?>(null)

    val accessToken: Flow<String?> = accessState.asStateFlow()
    val refreshToken: Flow<String?> = refreshState.asStateFlow()

    init {
        try {
            syncStateFromSecureStorage()
        } catch (e: Throwable) {
            Log.e("TokenManager", "Init failed; continuing with empty session", e)
            accessState.value = null
            refreshState.value = null
        }
    }

    private fun createSecurePrefs(): SharedPreferences {
        return try {
            buildEncryptedPrefs()
        } catch (e: Throwable) {
            Log.e("TokenManager", "EncryptedSharedPreferences failed, wiping and retrying", e)
            try {
                context.deleteSharedPreferences("auth_prefs_secure")
                buildEncryptedPrefs()
            } catch (e2: Throwable) {
                Log.e("TokenManager", "EncryptedSharedPreferences unrecoverable; falling back to plain prefs", e2)
                context.getSharedPreferences("auth_prefs_plain", Context.MODE_PRIVATE)
            }
        }
    }

    private fun buildEncryptedPrefs(): SharedPreferences {
        val masterKey = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
        return EncryptedSharedPreferences.create(
            context,
            "auth_prefs_secure",
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
    }

    suspend fun saveTokens(access: String, refresh: String) {
        runCatching {
            securePrefs.edit()
                .putString("access_token", access)
                .putString("refresh_token", refresh)
                .apply()
            syncStateFromSecureStorage()
        }
    }

    suspend fun clearTokens() {
        runCatching {
            securePrefs.edit()
                .remove("access_token")
                .remove("refresh_token")
                .apply()
            context.dataStore.edit { prefs ->
                prefs.remove(accessTokenKey)
                prefs.remove(refreshTokenKey)
            }
            syncStateFromSecureStorage()
        }
    }

    private fun syncStateFromSecureStorage() {
        accessState.value = securePrefs.getString("access_token", null)
        refreshState.value = securePrefs.getString("refresh_token", null)
    }
}
