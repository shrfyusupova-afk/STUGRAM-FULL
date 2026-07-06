package com.example.myapplication

import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.util.Log
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.lifecycle.lifecycleScope
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import com.example.myapplication.data.local.chat.ChatDatabase
import com.example.myapplication.data.local.chat.ChatOutboxScheduler
import com.example.myapplication.data.remote.AuthSession
import com.example.myapplication.data.remote.RetrofitClient
import com.example.myapplication.data.remote.SessionManager
import com.example.myapplication.data.remote.chat.ChatSocketManager
import com.example.myapplication.navigation.AuthNavGraph
import com.example.myapplication.navigation.Screen
import com.example.myapplication.ui.theme.MyApplicationTheme
import java.security.MessageDigest
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Must run before any authenticated request so the Authenticator can
        // reach the encrypted token store.
        RetrofitClient.initialize(applicationContext)

        printSHA1()
        enableEdgeToEdge()

        setContent {
            val systemTheme = isSystemInDarkTheme()
            val isDarkMode = rememberSaveable { mutableStateOf(systemTheme) }

            // null = still restoring session (show splash). Deliberately NOT
            // rememberSaveable: after process death the in-memory AuthSession is
            // gone, so the restore must re-run to repopulate it.
            var startDestination by remember { mutableStateOf<String?>(null) }

            LaunchedEffect(Unit) {
                val restore = SessionManager.restoreSession(applicationContext)
                startDestination = when (restore) {
                    SessionManager.Restore.HOME -> Screen.Home.route
                    SessionManager.Restore.AUTH -> Screen.Auth.route
                }
            }

            MyApplicationTheme(darkTheme = isDarkMode.value) {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    val start = startDestination
                    if (start == null) {
                        SplashScreen()
                    } else {
                        AuthNavGraph(
                            startDestination = start,
                            isDarkMode = isDarkMode.value,
                            onThemeChange = { isDarkMode.value = it }
                        )
                    }
                }
            }
        }
    }

    override fun onStart() {
        super.onStart()
        ChatSocketManager.updateAccessToken(AuthSession.accessToken)
        lifecycleScope.launch {
            val hasPending = ChatDatabase.getInstance(applicationContext)
                .chatPendingMessageDao()
                .hasPending()
            if (hasPending) {
                ChatOutboxScheduler.schedule(applicationContext)
            }
        }
    }

    private fun printSHA1() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                val info = packageManager.getPackageInfo(packageName, PackageManager.GET_SIGNING_CERTIFICATES)
                val signingInfo = info.signingInfo
                if (signingInfo != null) {
                    val signatures = if (signingInfo.hasMultipleSigners()) {
                        signingInfo.apkContentsSigners
                    } else {
                        signingInfo.signingCertificateHistory
                    }
                    if (signatures != null) {
                        for (signature in signatures) {
                            val md = MessageDigest.getInstance("SHA")
                            md.update(signature.toByteArray())
                            val sha1 = md.digest().joinToString(":") { "%02X".format(it) }
                            Log.d("MY_SHA1", "SHA-1: $sha1")
                        }
                    }
                }
            } else {
                @Suppress("DEPRECATION")
                val info = packageManager.getPackageInfo(packageName, PackageManager.GET_SIGNATURES)
                @Suppress("DEPRECATION")
                info.signatures?.forEach { signature ->
                    val md = MessageDigest.getInstance("SHA")
                    md.update(signature.toByteArray())
                    val sha1 = md.digest().joinToString(":") { "%02X".format(it) }
                    Log.d("MY_SHA1", "SHA-1: $sha1")
                }
            }
        } catch (e: Exception) {
            Log.e("MY_SHA1", "Error printing SHA-1", e)
        }
    }
}

@Composable
private fun SplashScreen() {
    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        CircularProgressIndicator(color = MaterialTheme.colorScheme.primary)
    }
}
