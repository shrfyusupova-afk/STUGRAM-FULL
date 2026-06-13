package com.example.myapplication.ui.theme

import androidx.compose.ui.graphics.Color

// 8% Logic: Darker than pure black (dark) and Lighter than pure white (light)
val Dark8Percent = Color(0xFF141414)  // 8% Grey-Black effect
val Light8Percent = Color(0xFFF7F7F7) // 8% Off-White effect

// 15% Logic: More pronounced shades
val Dark15Percent = Color(0xFF262626)  // 15% Grey-Black effect
val Light15Percent = Color(0xFFD9D9D9) // 15% Off-White/Grey effect

val PremiumBlue = Color(0xFF2979FF)
val PremiumBg = Dark8Percent
val PremiumSurface = Color(0xFF1E1E1E)
val PremiumTextPrimary = Color(0xFFFFFFFF)
val PremiumTextSecondary = Color(0xFFAAAAAA)
val PremiumError = Color(0xFFFF5252)

val PremiumGradient = listOf(
    Color(0xFF2979FF),
    Color(0xFF448AFF)
)

val PrimaryBlue = Color(0xFF2979FF)
val PrimaryBlueLight = Color(0xFF448AFF)
val AccentBlue = Color(0xFF00B0FF)

val BrandBlue = Color(0xFF1332DE)
val PremiumBlueDark = Color(0xFF1332DE)

// ── Light theme palette ───────────────────────────────────────────────
// Background is intentionally slightly off-white (warm grey) so it does
// not feel harsh on the eyes — matches the home screen aesthetic.
val LightBg            = Color(0xFFEDEEF2)
val LightSurface       = Color(0xFFFFFFFF)
val LightTextPrimary   = Color(0xFF111418)
val LightTextSecondary = Color(0xFF6B7280)
val LightGlassBorder   = Color(0xFFD8DCE3)

// Theme-aware accessors used by auth screens.
data class AuthPalette(
    val bg: Color,
    val surface: Color,
    val surfaceAlt: Color,
    val textPrimary: Color,
    val textSecondary: Color,
    val border: Color,
    val accent: Color,
    val accentSoft: Color,
    val error: Color,
    val divider: Color
)

val DarkAuthPalette = AuthPalette(
    bg = PremiumBg,
    surface = PremiumSurface,
    surfaceAlt = Color(0xFF161616),
    textPrimary = PremiumTextPrimary,
    textSecondary = PremiumTextSecondary,
    border = Color(0x33FFFFFF),
    accent = PremiumBlue,
    accentSoft = PremiumBlue.copy(alpha = 0.14f),
    error = PremiumError,
    divider = Color(0x1AFFFFFF)
)

val LightAuthPalette = AuthPalette(
    bg = LightBg,
    surface = LightSurface,
    surfaceAlt = Color(0xFFE6E8EF),
    textPrimary = LightTextPrimary,
    textSecondary = LightTextSecondary,
    border = LightGlassBorder,
    accent = PremiumBlue,
    accentSoft = PremiumBlue.copy(alpha = 0.10f),
    error = PremiumError,
    divider = Color(0x1F000000)
)

fun authPalette(isDarkMode: Boolean): AuthPalette =
    if (isDarkMode) DarkAuthPalette else LightAuthPalette
