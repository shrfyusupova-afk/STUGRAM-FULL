package com.example.myapplication

import android.content.Intent
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
import com.example.myapplication.navigation.DeepLinkTarget
import com.example.myapplication.navigation.Screen
import com.example.myapplication.push.StugramFirebaseMessagingService
import com.example.myapplication.ui.theme.MyApplicationTheme
import java.security.MessageDigest
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {

    // Set from the launch intent (notification tap) and consumed by the nav graph.
    private val pendingDeepLink = mutableStateOf<DeepLinkTarget?>(null)

    // Set when the app is opened via the Telegram bot's "stugram://telegram-register?code=..."
    // bridge link; consumed by AuthNavGraph to jump straight into the register flow.
    private val pendingTelegramCode = mutableStateOf<String?>(null)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Must run before any authenticated request so the Authenticator can
        // reach the encrypted token store.
        RetrofitClient.initialize(applicationContext)
        StugramFirebaseMessagingService.ensureNotificationChannel(applicationContext)
        pendingDeepLink.value = parseDeepLink(intent)
        pendingTelegramCode.value = parseTelegramCode(intent)

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
                            onThemeChange = { isDarkMode.value = it },
                            pendingDeepLink = pendingDeepLink.value,
                            onDeepLinkConsumed = { pendingDeepLink.value = null },
                            pendingTelegramCode = pendingTelegramCode.value,
                            onTelegramCodeConsumed = { pendingTelegramCode.value = null }
                        )
                    }
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        // singleTop: a notification tap while the app is alive lands here.
        parseDeepLink(intent)?.let { pendingDeepLink.value = it }
        parseTelegramCode(intent)?.let { pendingTelegramCode.value = it }
    }

    /** Reads "code" from a "stugram://telegram-register?code=..." VIEW intent. */
    private fun parseTelegramCode(intent: Intent?): String? {
        val uri = intent?.data ?: return null
        if (uri.scheme != "stugram" || uri.host != "telegram-register") return null
        return uri.getQueryParameter("code")?.takeIf { it.isNotBlank() }
    }

    /**
     * Reads a deep-link target either from our own extras (foreground-built
     * notifications) or from raw FCM data keys (system-tray notifications
     * attach the data payload to the launch intent).
     */
    private fun parseDeepLink(intent: Intent?): DeepLinkTarget? {
        if (intent == null) return null
        val type = intent.getStringExtra(StugramFirebaseMessagingService.EXTRA_DEEPLINK_TYPE)
            ?: intent.getStringExtra("type")
            ?: return null
        val param = intent.getStringExtra(StugramFirebaseMessagingService.EXTRA_DEEPLINK_PARAM)
            ?: intent.getStringExtra("senderName")
            ?: ""
        return DeepLinkTarget(type = type, param = param)
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
