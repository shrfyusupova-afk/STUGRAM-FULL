package com.example.myapplication.config

object AlphaFeatureFlags {
    const val ALPHA_MODE: Boolean = true

    const val FEED_INTERACTIONS_ENABLED: Boolean = false
    const val STORIES_ENABLED: Boolean = true
    const val REELS_ENABLED: Boolean = true
    const val SEARCH_DISCOVERY_ENABLED: Boolean = true
    const val CAMERA_CREATE_ENABLED: Boolean = true
    const val GROUP_CHAT_ENABLED: Boolean = false
    const val ADVANCED_SETTINGS_ENABLED: Boolean = false

    const val REQUESTS_ENABLED: Boolean = true
    const val EDIT_PROFILE_ENABLED: Boolean = true
    const val DIRECT_MESSAGES_ENABLED: Boolean = true
    const val PROFILE_ENABLED: Boolean = true
    const val BASIC_FEED_READ_ENABLED: Boolean = true

    fun isHomeTabEnabled(index: Int): Boolean = when (index) {
        0 -> BASIC_FEED_READ_ENABLED
        1 -> true
        2 -> REELS_ENABLED
        3 -> DIRECT_MESSAGES_ENABLED
        4 -> PROFILE_ENABLED
        else -> false
    }

    fun canOpenStoryViewer(): Boolean = STORIES_ENABLED
    fun canOpenCameraCreate(): Boolean = CAMERA_CREATE_ENABLED
    fun canOpenGroupChat(): Boolean = GROUP_CHAT_ENABLED
    fun canUseFeedInteractions(): Boolean = FEED_INTERACTIONS_ENABLED
}

