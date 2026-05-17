package com.example.myapplication

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.lifecycle.lifecycleScope
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import com.example.myapplication.core.storage.TokenManager
import com.example.myapplication.data.local.chat.ChatDatabase
import com.example.myapplication.data.local.chat.ChatOutboxScheduler
import com.example.myapplication.data.remote.AuthSession
import com.example.myapplication.data.remote.RetrofitClient
import com.example.myapplication.data.remote.chat.ChatSocketManager
import com.example.myapplication.navigation.AuthNavGraph
import com.example.myapplication.ui.theme.MyApplicationTheme
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        // Make RetrofitClient aware of TokenManager so the TokenAuthenticator
        // can refresh tokens and clear the session on 401 failures.
        RetrofitClient.initialize(TokenManager(applicationContext))

        setContent {
            val systemTheme = isSystemInDarkTheme()
            val isDarkMode = rememberSaveable { mutableStateOf(systemTheme) }

            MyApplicationTheme(darkTheme = isDarkMode.value) {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    AuthNavGraph(
                        isDarkMode = isDarkMode.value,
                        onThemeChange = { isDarkMode.value = it }
                    )
                }
            }
        }
    }

    override fun onStart() {
        super.onStart()
        lifecycleScope.launch {
            // Restore access token from encrypted storage into the in-memory
            // AuthSession so that the socket and outgoing requests can use it
            // immediately after the app returns from the background.
            val tokenManager = TokenManager(applicationContext)
            val storedToken = tokenManager.accessToken.first()
            if (storedToken != null && AuthSession.accessToken == null) {
                AuthSession.setToken(storedToken)
            }
            ChatSocketManager.updateAccessToken(AuthSession.accessToken)

            val hasPending = ChatDatabase.getInstance(applicationContext)
                .chatPendingMessageDao()
                .hasPending()
            if (hasPending) {
                ChatOutboxScheduler.schedule(applicationContext)
            }
        }
    }
}
