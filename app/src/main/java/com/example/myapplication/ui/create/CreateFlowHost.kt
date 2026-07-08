package com.example.myapplication.ui.create

import android.net.Uri
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue

/**
 * Two-step create flow: capture/pick media (camera or gallery), then preview +
 * caption + upload in CreatePostScreen. A video captured from a POST entry
 * becomes a REEL (a reel is just a video post server-side); a video from a
 * STORY entry stays a video story.
 */
@Composable
fun CreateFlowHost(
    type: CreateType,
    isDarkMode: Boolean,
    onClose: () -> Unit,
    onPosted: () -> Unit
) {
    var selectedMedia by remember { mutableStateOf<List<Uri>?>(null) }
    var selectedIsVideo by remember { mutableStateOf(false) }

    val media = selectedMedia
    if (media == null) {
        CameraCaptureScreen(
            type = type,
            onClose = onClose,
            onMediaSelected = { uris, isVideo ->
                selectedIsVideo = isVideo
                selectedMedia = uris
            }
        )
    } else {
        val effectiveType = if (selectedIsVideo && type == CreateType.POST) CreateType.REEL else type
        CreatePostScreen(
            type = effectiveType,
            isDarkMode = isDarkMode,
            onClose = onClose,
            onPosted = onPosted,
            initialMedia = media,
            initialIsVideo = selectedIsVideo,
            onBackToCapture = { selectedMedia = null }
        )
    }
}
