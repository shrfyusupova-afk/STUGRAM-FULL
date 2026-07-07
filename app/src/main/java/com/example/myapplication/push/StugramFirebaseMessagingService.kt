package com.example.myapplication.push

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.example.myapplication.MainActivity
import com.example.myapplication.R
import com.example.myapplication.data.remote.AuthSession
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

/**
 * FCM entry point. Verified backend data payload (pushNotificationService.js):
 *  - chat:   { type: "chat"|"group_chat", senderName, conversationId, senderId, ... }
 *  - social: { type: "like"|"comment"|"reply"|"follow"|"follow_request"|..., actorId, postId, ... }
 * Chat notifications deep-link into the chat (route needs the user name, which
 * the payload carries as senderName); other types open the app on Home.
 */
class StugramFirebaseMessagingService : FirebaseMessagingService() {

    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onNewToken(token: String) {
        // FCM rotated the token: re-register if a session exists; otherwise the
        // next HomeScreen entry registers it.
        if (!AuthSession.accessToken.isNullOrBlank()) {
            serviceScope.launch { PushTokenManager.register(applicationContext) }
        }
    }

    override fun onMessageReceived(message: RemoteMessage) {
        val data = message.data
        val type = data["type"] ?: data["notificationType"] ?: ""
        val senderName = data["senderName"]

        // Don't notify about the chat the user is currently reading.
        if ((type == "chat" || type == "group_chat") && ActiveScreenTracker.isChatOpenWith(senderName)) {
            return
        }

        val title = message.notification?.title
            ?: senderName
            ?: "Stugram"
        val body = message.notification?.body
            ?: data["previewText"]
            ?: defaultBodyFor(type)

        showNotification(type = type, param = senderName.orEmpty(), title = title, body = body)
    }

    private fun defaultBodyFor(type: String): String = when (type) {
        "chat", "group_chat" -> "Yangi xabar"
        "like" -> "Postingizga like bosildi"
        "comment", "reply" -> "Postingizga izoh yozildi"
        "follow" -> "Sizga yangi obunachi qo'shildi"
        "follow_request" -> "Yangi obuna so'rovi"
        else -> "Yangi bildirishnoma"
    }

    private fun showNotification(type: String, param: String, title: String, body: String) {
        if (!NotificationManagerCompat.from(this).areNotificationsEnabled()) return

        ensureNotificationChannel(this)

        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra(EXTRA_DEEPLINK_TYPE, type)
            putExtra(EXTRA_DEEPLINK_PARAM, param)
        }
        val pendingIntent = PendingIntent.getActivity(
            this,
            (type + param).hashCode(),
            intent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.appicon)
            .setContentTitle(title)
            .setContentText(body)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setContentIntent(pendingIntent)
            .build()

        runCatching {
            NotificationManagerCompat.from(this).notify((type + param).hashCode(), notification)
        }.onFailure { Log.w(TAG, "Notification post failed: ${it.message}") }
    }

    override fun onDestroy() {
        serviceScope.cancel()
        super.onDestroy()
    }

    companion object {
        private const val TAG = "StugramFCM"
        const val CHANNEL_ID = "stugram_notifications"
        const val EXTRA_DEEPLINK_TYPE = "deeplink_type"
        const val EXTRA_DEEPLINK_PARAM = "deeplink_param"

        /** Idempotent; called from MainActivity on start and before every notify. */
        fun ensureNotificationChannel(context: Context) {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
            val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            if (manager.getNotificationChannel(CHANNEL_ID) != null) return
            manager.createNotificationChannel(
                NotificationChannel(
                    CHANNEL_ID,
                    "Stugram bildirishnomalari",
                    NotificationManager.IMPORTANCE_HIGH
                ).apply {
                    description = "Xabarlar, obunalar, like va izohlar"
                }
            )
        }
    }
}
