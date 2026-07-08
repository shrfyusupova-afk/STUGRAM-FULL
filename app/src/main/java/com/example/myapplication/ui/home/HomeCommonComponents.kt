package com.example.myapplication.ui.home

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.foundation.layout.Box
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * Double-tap "like" burst animation. Kept as a reusable primitive for the feed
 * and (upcoming) real reels; contains no mock/placeholder data.
 */
@Composable
fun PopLikeAnimation(offset: Offset) {
    val scale = remember { Animatable(0f) }
    val alpha = remember { Animatable(0f) }

    LaunchedEffect(Unit) {
        launch {
            alpha.animateTo(1f, tween(200))
            delay(400)
            alpha.animateTo(0f, tween(200))
        }
        scale.animateTo(1.2f, spring(dampingRatio = Spring.DampingRatioMediumBouncy, stiffness = Spring.StiffnessLow))
        scale.animateTo(0f, tween(200))
    }

    Box(
        Modifier
            .offset { IntOffset(offset.x.toInt() - 60, offset.y.toInt() - 60) }
            .size(120.dp)
            .graphicsLayer(scaleX = scale.value, scaleY = scale.value, alpha = alpha.value),
        contentAlignment = Alignment.Center
    ) {
        Icon(Icons.Default.Favorite, null, tint = Color.Red, modifier = Modifier.fillMaxSize())
    }
}
