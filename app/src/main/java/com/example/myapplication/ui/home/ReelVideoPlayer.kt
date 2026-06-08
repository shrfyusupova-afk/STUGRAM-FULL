package com.example.myapplication.ui.home

import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.viewinterop.AndroidView
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView

/**
 * TikTok-uslub vertikal Reels uchun video player.
 * - Avtomatik takrorlash (loop)
 * - Mute toggle
 * - Pause/play toggle
 * - Player faqat ekran ko'rinib turgan paytda ishlaydi (lifecycle bilan to'g'ri tozalanadi)
 */
@androidx.annotation.OptIn(androidx.media3.common.util.UnstableApi::class)
@Composable
fun ReelVideoPlayer(
    videoUrl: String,
    isPlaying: Boolean,
    isMuted: Boolean,
    modifier: Modifier = Modifier.fillMaxSize()
) {
    val context = LocalContext.current

    val exoPlayer = remember(videoUrl) {
        ExoPlayer.Builder(context)
            .setAudioAttributes(
                AudioAttributes.Builder()
                    .setContentType(C.AUDIO_CONTENT_TYPE_MOVIE)
                    .setUsage(C.USAGE_MEDIA)
                    .build(),
                /* handleAudioFocus= */ true
            )
            .build()
            .apply {
                setMediaItem(MediaItem.fromUri(videoUrl))
                repeatMode = Player.REPEAT_MODE_ONE
                volume = if (isMuted) 0f else 1f
                playWhenReady = isPlaying
                prepare()
            }
    }

    LaunchedEffect(isPlaying) {
        exoPlayer.playWhenReady = isPlaying
    }

    LaunchedEffect(isMuted) {
        exoPlayer.volume = if (isMuted) 0f else 1f
    }

    DisposableEffect(Unit) {
        onDispose { exoPlayer.release() }
    }

    AndroidView(
        modifier = modifier,
        factory = { ctx ->
            PlayerView(ctx).apply {
                player = exoPlayer
                useController = false
                resizeMode = androidx.media3.ui.AspectRatioFrameLayout.RESIZE_MODE_ZOOM
            }
        }
    )
}
