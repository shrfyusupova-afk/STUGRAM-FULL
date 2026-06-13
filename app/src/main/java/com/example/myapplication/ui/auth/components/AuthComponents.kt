package com.example.myapplication.ui.auth.components

import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.*
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shadow
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onKeyEvent
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.example.myapplication.R
import com.example.myapplication.ui.theme.*
import kotlin.math.roundToInt

@Composable
fun PremiumLogo(modifier: Modifier = Modifier, isDarkMode: Boolean = true) {
    val infiniteTransition = rememberInfiniteTransition(label = "logo_glow")
    val glowAlpha by infiniteTransition.animateFloat(
        initialValue = 0.35f,
        targetValue = 0.75f,
        animationSpec = infiniteRepeatable(
            animation = tween(2500, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "glow"
    )

    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = modifier
    ) {
        Box(
            contentAlignment = Alignment.Center,
            modifier = Modifier.padding(10.dp)
        ) {
            // Soft outer glow
            Box(
                modifier = Modifier
                    .size(110.dp)
                    .blur(46.dp)
                    .background(
                        brush = Brush.radialGradient(
                            colors = listOf(PremiumBlue.copy(alpha = glowAlpha), Color.Transparent),
                            radius = 220f
                        ),
                        shape = CircleShape
                    )
            )

            // Liquid glass ring around the logo
            val ringColor = if (isDarkMode) Color.White.copy(0.10f) else Color.Black.copy(0.05f)
            Box(
                modifier = Modifier
                    .size(96.dp)
                    .background(ringColor, CircleShape)
                    .border(
                        BorderStroke(
                            1.dp,
                            Brush.linearGradient(
                                listOf(PremiumBlue.copy(0.6f), Color.White.copy(0.0f))
                            )
                        ),
                        CircleShape
                    )
            )

            Image(
                painter = painterResource(id = R.drawable.logo),
                contentDescription = "App Logo",
                modifier = Modifier
                    .size(82.dp)
                    .graphicsLayer {
                        shadowElevation = 28f
                        shape = CircleShape
                    }
            )
        }
    }
}

@Composable
fun PremiumTextField(
    value: String,
    onValueChange: (String) -> Unit,
    placeholder: String,
    leadingIcon: ImageVector,
    label: String = "",
    isError: Boolean = false,
    errorMessage: String? = null,
    visualTransformation: VisualTransformation = VisualTransformation.None,
    trailingIcon: @Composable (() -> Unit)? = null,
    keyboardOptions: KeyboardOptions = KeyboardOptions.Default,
    isDarkMode: Boolean = true
) {
    val p = authPalette(isDarkMode)
    val interactionSource = remember { MutableInteractionSource() }
    val isFocused by interactionSource.collectIsFocusedAsState()

    val glowColor by animateColorAsState(
        targetValue = if (isFocused) p.accent.copy(0.10f) else Color.Transparent,
        label = "glow"
    )

    Column(modifier = Modifier.fillMaxWidth()) {
        OutlinedTextField(
            value = value,
            onValueChange = onValueChange,
            modifier = Modifier
                .fillMaxWidth()
                .height(64.dp)
                .background(glowColor, RoundedCornerShape(20.dp)),
            textStyle = TextStyle(color = p.textPrimary, fontSize = 16.sp),
            label = if (label.isNotEmpty()) { { Text(label, color = p.textSecondary.copy(0.75f), fontSize = 12.sp) } } else null,
            placeholder = { Text(placeholder, color = p.textSecondary.copy(0.45f), fontSize = 15.sp) },
            leadingIcon = {
                Icon(
                    imageVector = leadingIcon,
                    contentDescription = null,
                    tint = if (isFocused) p.accent else p.textSecondary.copy(0.6f),
                    modifier = Modifier.size(24.dp)
                )
            },
            trailingIcon = trailingIcon,
            shape = RoundedCornerShape(20.dp),
            singleLine = true,
            isError = isError,
            visualTransformation = visualTransformation,
            keyboardOptions = keyboardOptions,
            interactionSource = interactionSource,
            colors = OutlinedTextFieldDefaults.colors(
                focusedTextColor = p.textPrimary,
                unfocusedTextColor = p.textPrimary,
                focusedBorderColor = if (isError) p.error else p.accent,
                unfocusedBorderColor = if (isError) p.error.copy(0.4f) else p.border.copy(0.6f),
                focusedContainerColor = p.surface,
                unfocusedContainerColor = p.surface,
                cursorColor = p.accent,
                errorBorderColor = p.error
            )
        )
        if (isError && errorMessage != null) {
            Text(
                text = errorMessage,
                color = p.error,
                fontSize = 12.sp,
                modifier = Modifier.padding(start = 14.dp, top = 4.dp)
            )
        }
    }
}

@Composable
fun PremiumButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    isLoading: Boolean = false,
    enabled: Boolean = true
) {
    val interactionSource = remember { MutableInteractionSource() }
    val isPressed by interactionSource.collectIsPressedAsState()
    val scale by animateFloatAsState(
        targetValue = if (isPressed) 0.94f else 1f,
        animationSpec = spring(dampingRatio = Spring.DampingRatioMediumBouncy, stiffness = Spring.StiffnessLow),
        label = "scale"
    )

    Box(
        modifier = modifier
            .fillMaxWidth()
            .height(60.dp)
            .scale(scale)
            .graphicsLayer {
                shadowElevation = 25f
                shape = RoundedCornerShape(24.dp)
                clip = true
            }
            .background(
                brush = Brush.horizontalGradient(PremiumGradient),
                shape = RoundedCornerShape(24.dp)
            )
            .clickable(
                interactionSource = interactionSource,
                indication = LocalIndication.current,
                enabled = enabled && !isLoading,
                onClick = onClick
            ),
        contentAlignment = Alignment.Center
    ) {
        // Shine/Glow overlay
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    Brush.verticalGradient(
                        listOf(Color.White.copy(0.15f), Color.Transparent)
                    )
                )
        )

        if (isLoading) {
            CircularProgressIndicator(
                modifier = Modifier.size(26.dp), 
                color = Color.White, 
                strokeWidth = 3.dp
            )
        } else {
            Text(
                text = text,
                style = TextStyle(
                    color = Color.White,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.ExtraBold,
                    letterSpacing = 0.5.sp,
                    shadow = Shadow(
                        color = Color.Black.copy(alpha = 0.3f),
                        offset = Offset(0f, 3f),
                        blurRadius = 6f
                    )
                )
            )
        }
    }
}

@Composable
fun PremiumSocialButton(
    painter: androidx.compose.ui.graphics.painter.Painter,
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    isDarkMode: Boolean = true
) {
    val p = authPalette(isDarkMode)
    val interactionSource = remember { MutableInteractionSource() }
    val isPressed by interactionSource.collectIsPressedAsState()
    val scale by animateFloatAsState(
        targetValue = if (isPressed) 0.96f else 1f,
        label = "social_scale"
    )

    OutlinedButton(
        onClick = onClick,
        modifier = modifier
            .fillMaxWidth()
            .height(56.dp)
            .scale(scale),
        shape = RoundedCornerShape(20.dp),
        border = BorderStroke(1.dp, p.border.copy(0.6f)),
        colors = ButtonDefaults.outlinedButtonColors(
            containerColor = p.surface,
            contentColor = p.textPrimary
        ),
        interactionSource = interactionSource,
        contentPadding = PaddingValues(horizontal = 24.dp)
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.Center
        ) {
            Image(
                painter = painter,
                contentDescription = null,
                modifier = Modifier.size(24.dp)
            )
            Spacer(modifier = Modifier.width(12.dp))
            Text(
                text = text,
                style = TextStyle(
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Medium,
                    letterSpacing = 0.2.sp
                )
            )
        }
    }
}

@Composable
fun TabSwitch(
    selectedIndex: Int,
    onTabSelected: (Int) -> Unit,
    modifier: Modifier = Modifier,
    isDarkMode: Boolean = true
) {
    val p = authPalette(isDarkMode)
    Row(
        modifier = modifier
            .fillMaxWidth()
            .height(54.dp)
            .background(p.surface, RoundedCornerShape(27.dp))
            .border(1.dp, p.border.copy(0.5f), RoundedCornerShape(27.dp))
            .padding(4.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        val tabs = listOf("Kirish", "Ro'yxatdan o'tish")
        tabs.forEachIndexed { index, title ->
            val isSelected = selectedIndex == index
            val animatedBgColor by animateColorAsState(
                targetValue = if (isSelected) p.accent else Color.Transparent,
                label = "tab_bg"
            )

            Box(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxHeight()
                    .clip(RoundedCornerShape(23.dp))
                    .background(animatedBgColor)
                    .clickable { onTabSelected(index) },
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = title,
                    color = if (isSelected) Color.White else p.textSecondary.copy(0.75f),
                    fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                    fontSize = 15.sp
                )
            }
        }
    }
}

@Composable
fun LoadingOverlay(isDarkMode: Boolean = true) {
    val p = authPalette(isDarkMode)
    Dialog(
        onDismissRequest = { },
        properties = DialogProperties(dismissOnBackPress = false, dismissOnClickOutside = false)
    ) {
        Box(
            modifier = Modifier
                .size(110.dp)
                .background(p.surface, RoundedCornerShape(28.dp))
                .border(1.dp, p.border.copy(0.4f), RoundedCornerShape(28.dp)),
            contentAlignment = Alignment.Center
        ) {
            CircularProgressIndicator(
                modifier = Modifier.size(44.dp),
                color = p.accent,
                strokeWidth = 4.dp
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AuthDropdownField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    options: List<String>,
    leadingIcon: ImageVector? = null,
    isDarkMode: Boolean = true
) {
    val p = authPalette(isDarkMode)
    var expanded by remember { mutableStateOf(false) }

    ExposedDropdownMenuBox(
        expanded = expanded,
        onExpandedChange = { expanded = !expanded },
        modifier = Modifier.fillMaxWidth()
    ) {
        OutlinedTextField(
            value = value,
            onValueChange = {},
            readOnly = true,
            textStyle = TextStyle(color = p.textPrimary, fontSize = 16.sp),
            label = { Text(label, color = p.textSecondary, fontSize = 12.sp) },
            leadingIcon = leadingIcon?.let { { Icon(it, contentDescription = null, tint = p.accent, modifier = Modifier.size(20.dp)) } },
            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
            modifier = Modifier
                .menuAnchor(MenuAnchorType.PrimaryNotEditable, true)
                .fillMaxWidth(),
            shape = RoundedCornerShape(20.dp),
            colors = OutlinedTextFieldDefaults.colors(
                focusedTextColor = p.textPrimary,
                unfocusedTextColor = p.textPrimary,
                focusedBorderColor = p.accent,
                unfocusedBorderColor = p.border.copy(0.6f),
                focusedContainerColor = p.surface,
                unfocusedContainerColor = p.surface,
                cursorColor = p.accent
            )
        )

        ExposedDropdownMenu(
            expanded = expanded,
            onDismissRequest = { expanded = false },
            modifier = Modifier.background(p.surface)
        ) {
            options.forEach { option ->
                DropdownMenuItem(
                    text = { Text(option, color = p.textPrimary) },
                    onClick = {
                        onValueChange(option)
                        expanded = false
                    },
                    contentPadding = ExposedDropdownMenuDefaults.ItemContentPadding
                )
            }
        }
    }
}

@Composable
fun SwipeToComplete(
    onCompleted: () -> Unit,
    modifier: Modifier = Modifier
) {
    var dragOffset by remember { mutableStateOf(0f) }
    val maxOffset = 220f

    Box(
        modifier = modifier
            .fillMaxWidth()
            .height(64.dp)
            .background(Color(0xFFF7F8FA), RoundedCornerShape(32.dp))
            .border(1.dp, Color(0xFFE8EAF0), RoundedCornerShape(32.dp)),
        contentAlignment = Alignment.CenterStart
    ) {
        Text(
            text = "Tasdiqlash uchun suring",
            modifier = Modifier.fillMaxWidth(),
            textAlign = TextAlign.Center,
            style = TextStyle(
                color = Color(0xFF9BA3B1),
                fontSize = 15.sp,
                fontWeight = FontWeight.Medium
            )
        )

        Box(
            modifier = Modifier
                .offset { IntOffset(dragOffset.roundToInt(), 0) }
                .size(56.dp)
                .padding(4.dp)
                .background(Color.White, CircleShape)
                .shadow(elevation = 8.dp, shape = CircleShape)
                .pointerInput(Unit) {
                    detectHorizontalDragGestures(
                        onDragEnd = {
                            if (dragOffset >= maxOffset * 0.7f) {
                                dragOffset = maxOffset
                                onCompleted()
                            } else {
                                dragOffset = 0f
                            }
                        },
                        onDragCancel = {
                            dragOffset = 0f
                        },
                        onHorizontalDrag = { change, dragAmount ->
                            change.consume()
                            dragOffset = (dragOffset + dragAmount).coerceIn(0f, maxOffset)
                        }
                    )
                },
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = Icons.AutoMirrored.Filled.ArrowForward,
                contentDescription = null,
                tint = Color(0xFFC4935E),
                modifier = Modifier.size(28.dp)
            )
        }
    }
}

@Composable
fun OtpInputField(
    otpText: String,
    onOtpTextChange: (String, Boolean) -> Unit,
    modifier: Modifier = Modifier,
    otpCount: Int = 4,
    isDarkMode: Boolean = true
) {
    val p = authPalette(isDarkMode)
    val focusRequesters = remember { List(otpCount) { FocusRequester() } }

    // Match available width — 6 boxes with gaps fit on small phones too.
    BoxWithConstraints(modifier = modifier.fillMaxWidth()) {
        val gap = 8.dp
        val totalGaps = (otpCount - 1) * gap.value
        val maxBoxSize = ((maxWidth.value - totalGaps) / otpCount).coerceAtMost(56f).dp

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(gap, Alignment.CenterHorizontally),
            verticalAlignment = Alignment.CenterVertically
        ) {
            for (i in 0 until otpCount) {
                val char = if (i < otpText.length) otpText[i].toString() else ""
                val isFocused = otpText.length == i

                Box(
                    modifier = Modifier
                        .size(maxBoxSize)
                        .background(
                            if (char.isNotEmpty() || isFocused) p.accent.copy(alpha = 0.08f) else p.surface,
                            RoundedCornerShape(16.dp)
                        )
                        .border(
                            1.5.dp,
                            if (isFocused) p.accent else p.border.copy(alpha = 0.6f),
                            RoundedCornerShape(16.dp)
                        ),
                    contentAlignment = Alignment.Center
                ) {
                    BasicTextField(
                        value = char,
                        onValueChange = { newValue ->
                            if (newValue.length <= 1) {
                                val newOtp = if (i < otpText.length) {
                                    otpText.replaceRange(i, i + 1, newValue)
                                } else {
                                    otpText + newValue
                                }
                                if (newOtp.length <= otpCount) {
                                    onOtpTextChange(newOtp, newOtp.length == otpCount)
                                    if (newValue.isNotEmpty() && i < otpCount - 1) {
                                        focusRequesters[i + 1].requestFocus()
                                    }
                                }
                            }
                        },
                        modifier = Modifier
                            .focusRequester(focusRequesters[i])
                            .onKeyEvent { event ->
                                if (event.key == Key.Backspace && char.isEmpty() && i > 0) {
                                    focusRequesters[i - 1].requestFocus()
                                    val newOtp = otpText.take(i - 1) + otpText.drop(i)
                                    onOtpTextChange(newOtp, false)
                                    true
                                } else {
                                    false
                                }
                            },
                        textStyle = TextStyle(
                            color = p.textPrimary,
                            fontSize = 22.sp,
                            fontWeight = FontWeight.Bold,
                            textAlign = TextAlign.Center
                        ),
                        cursorBrush = androidx.compose.ui.graphics.SolidColor(p.accent),
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        singleLine = true
                    )

                    if (char.isEmpty() && !isFocused) {
                        Box(
                            modifier = Modifier
                                .size(8.dp)
                                .background(p.textSecondary.copy(alpha = 0.25f), CircleShape)
                        )
                    }
                }
            }
        }
    }

    LaunchedEffect(Unit) {
        if (otpText.length < otpCount) {
            focusRequesters[otpText.length].requestFocus()
        }
    }
}

@Composable
fun LiquidGlassPlusButton(
    modifier: Modifier = Modifier,
    onClick: () -> Unit = {}
) {
    Box(
        modifier = modifier
            .size(100.dp)
            .clickable(
                interactionSource = remember { MutableInteractionSource() },
                indication = null,
                onClick = onClick
            ),
        contentAlignment = Alignment.Center
    ) {
        // Outer Shadow for Depth
        Box(
            modifier = Modifier
                .fillMaxSize(0.95f)
                .shadow(
                    elevation = 20.dp,
                    shape = CircleShape,
                    spotColor = Color.Black.copy(alpha = 0.15f),
                    clip = false
                )
        )

        // Main Glass Body with Frosted Effect
        Box(
            modifier = Modifier
                .fillMaxSize()
                .clip(CircleShape)
                .background(
                    Brush.radialGradient(
                        colors = listOf(
                            Color.White.copy(alpha = 0.35f),
                            Color(0xFFF2F3F5).copy(alpha = 0.25f)
                        )
                    )
                )
                .blur(30.dp)
        )

        // Edge Highlights and Reflections
        Canvas(modifier = Modifier.fillMaxSize()) {
            val radius = size.minDimension / 2
            
            // Top-left Edge Highlight
            drawCircle(
                brush = Brush.radialGradient(
                    0.0f to Color.White.copy(alpha = 0.7f),
                    1.0f to Color.Transparent,
                    center = Offset(radius * 0.4f, radius * 0.4f),
                    radius = radius * 1.2f
                ),
                radius = radius,
                center = center
            )
            
            // Subtle Inner Diffusion
            drawCircle(
                color = Color.White.copy(alpha = 0.1f),
                radius = radius * 0.9f,
                center = center
            )
        }

        // Surface Liquid Shine (Reflection)
        Box(
            modifier = Modifier
                .fillMaxSize(0.75f)
                .offset(x = (-8).dp, y = (-8).dp)
                .graphicsLayer { rotationZ = -45f }
                .background(
                    Brush.verticalGradient(
                        listOf(Color.White.copy(alpha = 0.4f), Color.Transparent)
                    ),
                    shape = RoundedCornerShape(50)
                )
        )

        // Glowing Plus Icon
        Box(contentAlignment = Alignment.Center) {
            // Icon Glow
            Icon(
                imageVector = Icons.Default.Add,
                contentDescription = null,
                tint = Color.White.copy(alpha = 0.3f),
                modifier = Modifier
                    .size(46.dp)
                    .blur(6.dp)
            )
            
            // Main Icon
            Icon(
                imageVector = Icons.Default.Add,
                contentDescription = null,
                tint = Color.White,
                modifier = Modifier.size(42.dp)
            )
        }
    }
}
