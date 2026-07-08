package com.example.myapplication.push

/**
 * Tracks which chat the user is currently looking at so the FCM service can
 * suppress notifications for that conversation. Composables update it via
 * DisposableEffect (set on enter, clear on dispose).
 */
object ActiveScreenTracker {
    @Volatile
    var activeChatUserName: String? = null

    fun isChatOpenWith(senderName: String?): Boolean {
        val active = activeChatUserName ?: return false
        if (senderName.isNullOrBlank()) return false
        return active.equals(senderName, ignoreCase = true)
    }
}
