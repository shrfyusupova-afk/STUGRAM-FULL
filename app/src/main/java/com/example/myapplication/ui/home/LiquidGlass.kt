package com.example.myapplication.ui.home

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/**
 * Shared "liquid glass" surface — translucent gradient body, soft edge
 * highlight and a top "wet" sheen, matching the frosted-glass look used by
 * [GlassSlidingNavigation] / [LiquidGlassPlusButton]. Use this to give other
 * surfaces (bars, pills, input rows) the same trending glass treatment.
 */
@Composable
fun LiquidGlassSurface(
    modifier: Modifier = Modifier,
    shape: Shape = RoundedCornerShape(20.dp),
    isDarkMode: Boolean,
    elevation: Dp = 0.dp,
    onClick: (() -> Unit)? = null,
    content: @Composable BoxScope.() -> Unit
) {
    val surfaceTint = if (isDarkMode) Color(0xFF1A1A1A).copy(alpha = 0.55f) else Color.White.copy(alpha = 0.55f)
    val borderTint = if (isDarkMode) Color.White.copy(alpha = 0.14f) else Color.White.copy(alpha = 0.65f)

    Box(
        modifier = modifier
            .then(
                if (elevation > 0.dp) {
                    Modifier.shadow(
                        elevation = elevation,
                        shape = shape,
                        ambientColor = Color.Black.copy(alpha = 0.10f),
                        spotColor = Color.Black.copy(alpha = 0.16f)
                    )
                } else Modifier
            )
            .clip(shape)
            .then(if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier)
            .background(
                Brush.linearGradient(
                    listOf(
                        surfaceTint.copy(alpha = (surfaceTint.alpha + 0.10f).coerceAtMost(1f)),
                        surfaceTint.copy(alpha = (surfaceTint.alpha - 0.12f).coerceAtLeast(0.20f))
                    )
                )
            )
            .border(
                width = 1.dp,
                brush = Brush.verticalGradient(
                    listOf(borderTint, borderTint.copy(alpha = borderTint.alpha * 0.3f))
                ),
                shape = shape
            )
    ) {
        // "Wet" top sheen — the signature liquid-glass shine
        Box(
            modifier = Modifier
                .matchParentSize()
                .background(
                    Brush.verticalGradient(
                        listOf(Color.White.copy(alpha = if (isDarkMode) 0.10f else 0.35f), Color.Transparent)
                    )
                )
        )
        content()
    }
}
