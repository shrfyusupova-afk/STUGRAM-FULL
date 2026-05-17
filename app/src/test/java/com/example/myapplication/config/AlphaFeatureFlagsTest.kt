package com.example.myapplication.config

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class AlphaFeatureFlagsTest {

    @Test
    fun alphaDefaults_lockUnsafeFeatures() {
        assertTrue(AlphaFeatureFlags.ALPHA_MODE)
        assertFalse(AlphaFeatureFlags.FEED_INTERACTIONS_ENABLED)
        assertFalse(AlphaFeatureFlags.STORIES_ENABLED)
        assertFalse(AlphaFeatureFlags.REELS_ENABLED)
        assertFalse(AlphaFeatureFlags.SEARCH_DISCOVERY_ENABLED)
        assertFalse(AlphaFeatureFlags.CAMERA_CREATE_ENABLED)
        assertFalse(AlphaFeatureFlags.GROUP_CHAT_ENABLED)
        assertFalse(AlphaFeatureFlags.ADVANCED_SETTINGS_ENABLED)
    }

    @Test
    fun alphaDefaults_keepCoreFeaturesEnabled() {
        assertTrue(AlphaFeatureFlags.REQUESTS_ENABLED)
        assertTrue(AlphaFeatureFlags.EDIT_PROFILE_ENABLED)
        assertTrue(AlphaFeatureFlags.DIRECT_MESSAGES_ENABLED)
        assertTrue(AlphaFeatureFlags.PROFILE_ENABLED)
        assertTrue(AlphaFeatureFlags.BASIC_FEED_READ_ENABLED)
    }

    @Test
    fun homeTabGuard_blocksDisabledReelsTab() {
        assertTrue(AlphaFeatureFlags.isHomeTabEnabled(0))
        assertTrue(AlphaFeatureFlags.isHomeTabEnabled(1))
        assertFalse(AlphaFeatureFlags.isHomeTabEnabled(2))
        assertTrue(AlphaFeatureFlags.isHomeTabEnabled(3))
        assertTrue(AlphaFeatureFlags.isHomeTabEnabled(4))
    }
}

