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

// --- Auth screen palette (light yellow/black/white) ---
// Scoped to the Auth flow only (login/register); the Premium* tokens above
// stay untouched since they're also used for chat bubble tint elsewhere.
val AuthYellow = Color(0xFFFFC229)
val AuthYellowDeep = Color(0xFFF7A600)
val AuthYellowSoft = Color(0xFFFFE9B8)
val AuthCard = Color(0xFFFFFFFF)
val AuthInputFill = Color(0xFFF1F1F4)
val AuthTextPrimary = Color(0xFF17140D)
val AuthTextSecondary = Color(0xFF8B8A85)
val AuthButtonBlack = Color(0xFF161616)
val AuthError = Color(0xFFE2483A)
