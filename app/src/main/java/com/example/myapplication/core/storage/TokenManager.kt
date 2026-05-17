package com.example.myapplication.core.storage

import android.content.Context
import android.content.SharedPreferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking

private val Context.dataStore by preferencesDataStore(name = "auth_prefs")

class TokenManager(private val context: Context) {
    private val accessTokenKey = stringPreferencesKey("access_token")
    private val refreshTokenKey = stringPreferencesKey("refresh_token")

    private val securePrefs: SharedPreferences by lazy {
        val masterKey = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
        EncryptedSharedPreferences.create(
            context,
            "auth_prefs_secure",
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
    }

    private val accessState = MutableStateFlow<String?>(null)
    private val refreshState = MutableStateFlow<String?>(null)

    val accessToken: Flow<String?> = accessState.asStateFlow()
    val refreshToken: Flow<String?> = refreshState.asStateFlow()

    init {
        runBlocking {
            migrateLegacyTokensIfNeeded()
            syncStateFromSecureStorage()
        }
    }

    suspend fun saveTokens(access: String, refresh: String) {
        securePrefs.edit()
            .putString("access_token", access)
            .putString("refresh_token", refresh)
            .apply()
        syncStateFromSecureStorage()
    }

    suspend fun clearTokens() {
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

    private suspend fun migrateLegacyTokensIfNeeded() {
        val legacy = context.dataStore.data.first()
        val secureAccess = securePrefs.getString("access_token", null)
        val secureRefresh = securePrefs.getString("refresh_token", null)
        val legacyAccess = legacy[accessTokenKey]
        val legacyRefresh = legacy[refreshTokenKey]

        if (secureAccess.isNullOrBlank() && !legacyAccess.isNullOrBlank()) {
            securePrefs.edit().putString("access_token", legacyAccess).apply()
        }
        if (secureRefresh.isNullOrBlank() && !legacyRefresh.isNullOrBlank()) {
            securePrefs.edit().putString("refresh_token", legacyRefresh).apply()
        }

        if (!legacyAccess.isNullOrBlank() || !legacyRefresh.isNullOrBlank()) {
            context.dataStore.edit { prefs ->
                prefs.remove(accessTokenKey)
                prefs.remove(refreshTokenKey)
            }
        }
    }

    private fun syncStateFromSecureStorage() {
        accessState.value = securePrefs.getString("access_token", null)
        refreshState.value = securePrefs.getString("refresh_token", null)
    }
}
