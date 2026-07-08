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

// --- Auth screen palette ---
// Scoped to the Auth flow only (login/register); the Premium* tokens above
// stay untouched since they're also used for chat bubble tint elsewhere.
// These follow the same day/night colors as the main app (Home) instead of a
// fixed palette, so functions (parameterized by isDarkMode) are used instead
// of plain vals -- matching the per-screen isDarkMode convention used
// throughout the rest of the app.
val AuthBlue = Color(0xFF00A3FF)
val AuthError = Color(0xFFE2483A)

fun authBackground(isDarkMode: Boolean) = if (isDarkMode) Color(0xFF0F0F0F) else Color(0xFFF2F2F2)
fun authCard(isDarkMode: Boolean) = if (isDarkMode) Color(0xFF1A1A1A) else Color.White
fun authInputFill(isDarkMode: Boolean) = if (isDarkMode) Color(0xFF262626) else Color(0xFFF5F5F5)
fun authTextPrimary(isDarkMode: Boolean) = if (isDarkMode) Color.White else Color(0xFF17140D)
fun authTextSecondary(isDarkMode: Boolean) = if (isDarkMode) Color(0xFFAAAAAA) else Color(0xFF8B8A85)
