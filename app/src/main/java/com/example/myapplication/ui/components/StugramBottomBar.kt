package com.example.myapplication.ui.components

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.scaleOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.layout.wrapContentWidth
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.ChatBubble
import androidx.compose.material.icons.rounded.Home
import androidx.compose.material.icons.rounded.Movie
import androidx.compose.material.icons.rounded.Person
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material3.Icon
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInParent
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import kotlinx.coroutines.launch

/**
 * The 5 STUGRAM tabs in fixed index order. [onTabSelected] always receives one
 * of these indices, including re-taps of the already-selected tab (the caller
 * decides what a re-tap means, e.g. scroll-to-top).
 */
const val STUGRAM_TAB_HOME = 0
const val STUGRAM_TAB_SEARCH = 1
const val STUGRAM_TAB_REELS = 2
const val STUGRAM_TAB_CHATS = 3
const val STUGRAM_TAB_PROFILE = 4

private data class BottomNavTab(val label: String, val icon: ImageVector)

private val bottomNavTabs = listOf(
    BottomNavTab("Home", Icons.Rounded.Home),
    BottomNavTab("Search", Icons.Rounded.Search),
    BottomNavTab("Reels", Icons.Rounded.Movie),
    BottomNavTab("Chats", Icons.Rounded.ChatBubble),
    BottomNavTab("Profile", Icons.Rounded.Person)
)

private val PillBackground = Color(0xFF1E1E1E)
private val PillAccent = Color(0xFF4D9FFF)
private val UnselectedLabel = Color(0xFFB0B0B0)
private val BubbleSpring = spring<Float>(dampingRatio = 0.75f, stiffness = Spring.StiffnessMediumLow)
private val BubbleWidthSpring = spring<androidx.compose.ui.unit.Dp>(dampingRatio = 0.75f, stiffness = Spring.StiffnessMediumLow)

private const val BAR_HEIGHT_DP = 64
private const val CORNER_RADIUS_DP = BAR_HEIGHT_DP / 2

/**
 * Reusable floating pill bottom nav bar, Telegram-iOS style, for STUGRAM's dark theme.
 *
 * [selectedTab]/[onTabSelected] are the single source of truth for the active tab, hoisted
 * to the caller (see [STUGRAM_TAB_HOME] etc.) — the caller owns navigation (index-based
 * crossfade today, or a NavController's current-route mapping if migrated later).
 *
 * [visible] drives the hide-on-scroll slide/fade; callers that want to disable that behavior
 * for a given screen can simply always pass `true`.
 */
@Composable
fun StugramBottomBar(
    selectedTab: Int,
    onTabSelected: (Int) -> Unit,
    unreadCount: Int = 0,
    avatarUrl: String? = null,
    modifier: Modifier = Modifier,
    visible: Boolean = true
) {
    AnimatedVisibility(
        visible = visible,
        enter = slideInVertically(spring(dampingRatio = 0.8f, stiffness = Spring.StiffnessLow)) { it } +
            fadeIn(tween(200)),
        exit = slideOutVertically(spring(dampingRatio = 0.8f, stiffness = Spring.StiffnessLow)) { it } +
            fadeOut(tween(150)),
        modifier = modifier
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .windowInsetsPadding(WindowInsets.navigationBars)
                .padding(bottom = 16.dp, start = 20.dp, end = 20.dp),
            contentAlignment = Alignment.Center
        ) {
            StugramBottomBarSurface(
                selectedTab = selectedTab,
                onTabSelected = onTabSelected,
                unreadCount = unreadCount,
                avatarUrl = avatarUrl
            )
        }
    }
}

@Composable
private fun StugramBottomBarSurface(
    selectedTab: Int,
    onTabSelected: (Int) -> Unit,
    unreadCount: Int,
    avatarUrl: String?
) {
    Surface(
        modifier = Modifier
            .wrapContentWidth()
            .height(BAR_HEIGHT_DP.dp),
        shape = RoundedCornerShape(CORNER_RADIUS_DP.dp),
        color = PillBackground.copy(alpha = 0.92f),
        shadowElevation = 12.dp
    ) {
        val density = LocalDensity.current
        val scope = rememberCoroutineScope()

        // Measured per-tab x-offset/width in px, captured via onGloballyPositioned so the
        // sliding bubble can be sized/positioned to hug each tab's real content, not a
        // fixed equal-weight slot.
        val tabOffsetsPx = remember { mutableStateOf(FloatArray(bottomNavTabs.size)) }
        val tabWidthsPx = remember { mutableStateOf(FloatArray(bottomNavTabs.size)) }
        val bubbleOffsetPx = remember { Animatable(0f) }
        val bubbleInitialized = remember { mutableStateOf(false) }

        val targetOffsetPx = tabOffsetsPx.value.getOrElse(selectedTab) { 0f }
        val targetWidthDp = with(density) { tabWidthsPx.value.getOrElse(selectedTab) { 0f }.toDp() }
        val bubbleWidth by animateDpAsState(targetValue = targetWidthDp, animationSpec = BubbleWidthSpring, label = "bubble_width")

        LaunchedEffect(selectedTab, targetOffsetPx) {
            if (targetWidthDp <= 0.dp) return@LaunchedEffect
            if (!bubbleInitialized.value) {
                // First real measurement: snap into place instead of animating in from x=0,
                // which would otherwise show a spurious slide-in on initial screen render.
                bubbleOffsetPx.snapTo(targetOffsetPx)
                bubbleInitialized.value = true
            } else {
                bubbleOffsetPx.animateTo(targetOffsetPx, BubbleSpring)
            }
        }

        Box(modifier = Modifier.padding(horizontal = 12.dp).fillMaxHeight()) {
            // Shared sliding selection bubble.
            Box(
                modifier = Modifier
                    .align(Alignment.CenterStart)
                    .graphicsLayer { translationX = bubbleOffsetPx.value }
                    .width(bubbleWidth)
                    .fillMaxHeight()
                    .padding(vertical = 6.dp)
                    .clip(RoundedCornerShape(50))
                    .background(PillAccent.copy(alpha = 0.15f))
            )

            Row(modifier = Modifier.fillMaxHeight(), verticalAlignment = Alignment.CenterVertically) {
                bottomNavTabs.forEachIndexed { index, tab ->
                    val isSelected = selectedTab == index
                    val scale = remember { Animatable(1f) }

                    Box(
                        modifier = Modifier
                            .onGloballyPositioned { coordinates ->
                                val x = coordinates.positionInParent().x
                                val w = coordinates.size.width.toFloat()
                                if (tabOffsetsPx.value.getOrNull(index) != x || tabWidthsPx.value.getOrNull(index) != w) {
                                    tabOffsetsPx.value = tabOffsetsPx.value.copyOf().also { it[index] = x }
                                    tabWidthsPx.value = tabWidthsPx.value.copyOf().also { it[index] = w }
                                }
                            }
                            .fillMaxHeight()
                            .clickable(
                                interactionSource = remember { MutableInteractionSource() },
                                indication = null
                            ) {
                                scope.launch {
                                    scale.animateTo(0.9f, spring(stiffness = Spring.StiffnessHigh))
                                    scale.animateTo(1f, spring(dampingRatio = Spring.DampingRatioMediumBouncy))
                                }
                                onTabSelected(index)
                            }
                            .padding(horizontal = 14.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        TabContent(
                            tab = tab,
                            index = index,
                            isSelected = isSelected,
                            scale = scale.value,
                            unreadCount = if (index == STUGRAM_TAB_CHATS) unreadCount else 0,
                            avatarUrl = if (index == STUGRAM_TAB_PROFILE) avatarUrl else null
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun TabContent(
    tab: BottomNavTab,
    index: Int,
    isSelected: Boolean,
    scale: Float,
    unreadCount: Int,
    avatarUrl: String?
) {
    val iconColor by animateColorAsState(
        targetValue = if (isSelected) PillAccent else Color.White,
        animationSpec = tween(250),
        label = "icon_color"
    )
    val labelColor by animateColorAsState(
        targetValue = if (isSelected) PillAccent else UnselectedLabel,
        animationSpec = tween(250),
        label = "label_color"
    )

    Box(
        modifier = Modifier.graphicsLayer { scaleX = scale; scaleY = scale },
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            if (index == STUGRAM_TAB_PROFILE) {
                ProfileAvatar(avatarUrl = avatarUrl, isSelected = isSelected, iconColor = iconColor)
            } else {
                Icon(tab.icon, contentDescription = tab.label, tint = iconColor, modifier = Modifier.size(24.dp))
            }
            Text(
                text = tab.label,
                color = labelColor,
                fontSize = 11.sp,
                fontWeight = if (isSelected) FontWeight.SemiBold else FontWeight.Normal,
                modifier = Modifier.padding(top = 2.dp)
            )
        }

        if (index == STUGRAM_TAB_CHATS) {
            UnreadBadge(unreadCount = unreadCount, modifier = Modifier.align(Alignment.TopEnd))
        }
    }
}

@Composable
private fun ProfileAvatar(avatarUrl: String?, isSelected: Boolean, iconColor: Color) {
    val ringWidth by animateDpAsState(
        targetValue = if (isSelected) 2.dp else 0.dp,
        animationSpec = tween(250),
        label = "avatar_ring"
    )
    Box(
        modifier = Modifier
            .size(26.dp)
            .border(ringWidth, PillAccent, CircleShape)
            .padding(ringWidth)
            .clip(CircleShape),
        contentAlignment = Alignment.Center
    ) {
        if (!avatarUrl.isNullOrBlank()) {
            AsyncImage(
                model = avatarUrl,
                contentDescription = "Profile",
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize()
            )
        } else {
            Icon(Icons.Rounded.Person, contentDescription = "Profile", tint = iconColor, modifier = Modifier.fillMaxSize())
        }
    }
}

@Composable
private fun UnreadBadge(unreadCount: Int, modifier: Modifier = Modifier) {
    AnimatedVisibility(
        visible = unreadCount > 0,
        enter = scaleIn(spring(dampingRatio = Spring.DampingRatioMediumBouncy)) + fadeIn(),
        exit = scaleOut() + fadeOut(),
        modifier = modifier.offset(x = 10.dp, y = (-2).dp)
    ) {
        Box(
            modifier = Modifier
                .size(16.dp)
                .background(PillAccent, CircleShape),
            contentAlignment = Alignment.Center
        ) {
            AnimatedContent(
                targetState = unreadCount,
                transitionSpec = {
                    (slideInVertically { h -> h } + fadeIn())
                        .togetherWith(slideOutVertically { h -> -h } + fadeOut())
                },
                label = "badge_count"
            ) { count ->
                Text(
                    text = if (count > 99) "99+" else count.toString(),
                    color = Color.White,
                    fontSize = 9.sp,
                    fontWeight = FontWeight.Bold
                )
            }
        }
    }
}
