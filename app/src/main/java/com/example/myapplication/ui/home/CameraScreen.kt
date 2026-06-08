package com.example.myapplication.ui.home

import android.Manifest
import android.content.pm.PackageManager
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageCapture
import androidx.camera.core.ImageCaptureException
import androidx.camera.view.LifecycleCameraController
import androidx.camera.view.PreviewView
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import java.io.File

@Composable
fun CameraScreen(
    onImageSelected: (Uri) -> Unit,
    onClose: () -> Unit,
    currentMode: CreateMode = CreateMode.POST,
    onModeChange: (CreateMode) -> Unit = {},
    onVideoSelected: (Uri) -> Unit = {}
) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current

    var hasPermission by remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) ==
                PackageManager.PERMISSION_GRANTED
        )
    }

    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted -> hasPermission = granted }

    val galleryLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.GetContent()
    ) { uri -> uri?.let { onImageSelected(it) } }

    val videoGalleryLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.GetContent()
    ) { uri -> uri?.let { onVideoSelected(it) } }

    val cameraController = remember { LifecycleCameraController(context) }
    var lensFacing by remember { mutableStateOf(CameraSelector.LENS_FACING_BACK) }
    var isCapturing by remember { mutableStateOf(false) }
    var flashEnabled by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        if (!hasPermission) permissionLauncher.launch(Manifest.permission.CAMERA)
        cameraController.bindToLifecycle(lifecycleOwner)
    }

    LaunchedEffect(lensFacing) {
        cameraController.cameraSelector = if (lensFacing == CameraSelector.LENS_FACING_BACK)
            CameraSelector.DEFAULT_BACK_CAMERA else CameraSelector.DEFAULT_FRONT_CAMERA
    }

    LaunchedEffect(flashEnabled) {
        cameraController.imageCaptureFlashMode = if (flashEnabled)
            ImageCapture.FLASH_MODE_ON else ImageCapture.FLASH_MODE_OFF
    }

    Box(modifier = Modifier.fillMaxSize().background(Color.Black)) {
        if (hasPermission) {
            AndroidView(
                factory = { ctx ->
                    PreviewView(ctx).apply {
                        controller = cameraController
                        scaleType = PreviewView.ScaleType.FILL_CENTER
                    }
                },
                modifier = Modifier.fillMaxSize()
            )
        } else {
            CameraNoPermission(onRequest = { permissionLauncher.launch(Manifest.permission.CAMERA) })
        }

        // Top bar
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .statusBarsPadding()
                .padding(horizontal = 12.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            CameraIconButton(onClick = onClose) {
                Icon(Icons.Default.Close, null, tint = Color.White, modifier = Modifier.size(22.dp))
            }

            Spacer(Modifier.weight(1f))

            // Post | Reels | Story tabs
            Row(
                modifier = Modifier
                    .background(Color.Black.copy(0.5f), RoundedCornerShape(24.dp))
                    .padding(4.dp),
                horizontalArrangement = Arrangement.spacedBy(2.dp)
            ) {
                val tabs = listOf(
                    "Post" to CreateMode.POST,
                    "Reels" to CreateMode.REELS,
                    "Story" to CreateMode.STORY
                )
                tabs.forEach { (label, mode) ->
                    val active = mode == currentMode
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(20.dp))
                            .background(if (active) Color.White else Color.Transparent)
                            .clickable(
                                indication = null,
                                interactionSource = remember { MutableInteractionSource() }
                            ) { onModeChange(mode) }
                            .padding(horizontal = 16.dp, vertical = 7.dp)
                    ) {
                        Text(
                            text = label,
                            color = if (active) Color.Black else Color.White.copy(0.7f),
                            fontSize = 13.sp,
                            fontWeight = if (active) FontWeight.Bold else FontWeight.Normal
                        )
                    }
                }
            }

            Spacer(Modifier.weight(1f))

            val flashTint by animateColorAsState(
                targetValue = if (flashEnabled) Color(0xFFFFE082) else Color.White,
                label = "flash"
            )
            CameraIconButton(onClick = { flashEnabled = !flashEnabled }) {
                Icon(
                    if (flashEnabled) Icons.Default.FlashOn else Icons.Default.FlashOff,
                    null,
                    tint = flashTint,
                    modifier = Modifier.size(22.dp)
                )
            }
        }

        // Bottom controls
        val captureScale by animateFloatAsState(
            targetValue = if (isCapturing) 0.88f else 1f,
            animationSpec = tween(100),
            label = "cap_scale"
        )

        Box(
            modifier = Modifier
                .fillMaxWidth()
                .align(Alignment.BottomCenter)
                .navigationBarsPadding()
                .padding(bottom = 36.dp, start = 32.dp, end = 32.dp)
        ) {
            // Gallery button — video picker for Reels, image picker for Post/Story
            Box(
                modifier = Modifier
                    .align(Alignment.CenterStart)
                    .size(58.dp)
                    .clip(RoundedCornerShape(14.dp))
                    .background(Color.White.copy(0.2f))
                    .clickable(
                        indication = null,
                        interactionSource = remember { MutableInteractionSource() }
                    ) {
                        if (currentMode == CreateMode.REELS) videoGalleryLauncher.launch("video/*")
                        else galleryLauncher.launch("image/*")
                    },
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    if (currentMode == CreateMode.REELS) Icons.Default.VideoLibrary else Icons.Default.PhotoLibrary,
                    null,
                    tint = Color.White,
                    modifier = Modifier.size(28.dp)
                )
            }

            // Shutter button. Reels mode uses gallery — show ring with video icon
            Box(modifier = Modifier.align(Alignment.Center).size(88.dp), contentAlignment = Alignment.Center) {
                val shutterRingColor = if (currentMode == CreateMode.REELS) Color(0xFFFF3B6B) else Color.White
                Box(modifier = Modifier.size(88.dp).border(3.5.dp, shutterRingColor, CircleShape))
                Box(
                    modifier = Modifier
                        .size(72.dp)
                        .scale(captureScale)
                        .background(
                            when {
                                isCapturing -> Color.LightGray
                                currentMode == CreateMode.REELS -> Color(0xFFFF3B6B)
                                else -> Color.White
                            },
                            CircleShape
                        )
                        .clickable(
                            enabled = hasPermission && !isCapturing,
                            indication = null,
                            interactionSource = remember { MutableInteractionSource() }
                        ) {
                            if (currentMode == CreateMode.REELS) {
                                // No in-camera video record yet — open gallery instead
                                videoGalleryLauncher.launch("video/*")
                            } else {
                                isCapturing = true
                                val outputFile = File(context.filesDir, "capture_${System.currentTimeMillis()}.jpg")
                                val opts = ImageCapture.OutputFileOptions.Builder(outputFile).build()
                                cameraController.takePicture(
                                    opts,
                                    ContextCompat.getMainExecutor(context),
                                    object : ImageCapture.OnImageSavedCallback {
                                        override fun onImageSaved(output: ImageCapture.OutputFileResults) {
                                            isCapturing = false
                                            onImageSelected(output.savedUri ?: Uri.fromFile(outputFile))
                                        }
                                        override fun onError(e: ImageCaptureException) { isCapturing = false }
                                    }
                                )
                            }
                        },
                    contentAlignment = Alignment.Center
                ) {
                    if (currentMode == CreateMode.REELS && !isCapturing) {
                        Icon(
                            Icons.Default.PlayArrow,
                            null,
                            tint = Color.White,
                            modifier = Modifier.size(36.dp)
                        )
                    }
                }
            }

            // Flip camera
            CameraIconButton(
                onClick = {
                    lensFacing = if (lensFacing == CameraSelector.LENS_FACING_BACK)
                        CameraSelector.LENS_FACING_FRONT else CameraSelector.LENS_FACING_BACK
                },
                modifier = Modifier.align(Alignment.CenterEnd).size(58.dp)
            ) {
                Icon(Icons.Default.Cameraswitch, null, tint = Color.White, modifier = Modifier.size(28.dp))
            }
        }
    }
}

@Composable
private fun CameraIconButton(
    onClick: () -> Unit,
    modifier: Modifier = Modifier.size(44.dp),
    content: @Composable BoxScope.() -> Unit
) {
    Box(
        modifier = modifier
            .background(Color.Black.copy(0.45f), CircleShape)
            .clickable(
                indication = null,
                interactionSource = remember { MutableInteractionSource() },
                onClick = onClick
            ),
        contentAlignment = Alignment.Center,
        content = content
    )
}

@Composable
private fun CameraNoPermission(onRequest: () -> Unit) {
    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Icon(Icons.Default.CameraAlt, null, tint = Color.White.copy(0.5f), modifier = Modifier.size(72.dp))
            Text("Kamera ruxsati kerak", color = Color.White, fontSize = 18.sp, fontWeight = FontWeight.SemiBold)
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(24.dp))
                    .background(Color.White)
                    .clickable(
                        indication = null,
                        interactionSource = remember { MutableInteractionSource() },
                        onClick = onRequest
                    )
                    .padding(horizontal = 28.dp, vertical = 12.dp)
            ) {
                Text("Ruxsat berish", color = Color.Black, fontSize = 15.sp, fontWeight = FontWeight.Bold)
            }
        }
    }
}
