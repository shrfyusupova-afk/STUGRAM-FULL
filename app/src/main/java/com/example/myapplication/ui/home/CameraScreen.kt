package com.example.myapplication.ui.home

import android.Manifest
import android.content.pm.PackageManager
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageCapture
import androidx.camera.core.ImageCaptureException
import androidx.camera.video.FileOutputOptions
import androidx.camera.video.Recording
import androidx.camera.video.VideoRecordEvent
import androidx.camera.view.LifecycleCameraController
import androidx.camera.view.PreviewView
import androidx.camera.view.video.AudioConfig
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
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
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import kotlinx.coroutines.delay
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
    var hasAudioPermission by remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) ==
                PackageManager.PERMISSION_GRANTED
        )
    }

    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { results ->
        hasPermission = results[Manifest.permission.CAMERA] == true
        hasAudioPermission = results[Manifest.permission.RECORD_AUDIO] == true
    }

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

    // Video recording state
    var isRecording by remember { mutableStateOf(false) }
    var recordingSeconds by remember { mutableIntStateOf(0) }
    var activeRecording by remember { mutableStateOf<Recording?>(null) }

    // Recording timer
    LaunchedEffect(isRecording) {
        if (isRecording) {
            recordingSeconds = 0
            while (isRecording) {
                delay(1000)
                recordingSeconds++
                if (recordingSeconds >= 60) {
                    activeRecording?.stop()
                }
            }
        } else {
            recordingSeconds = 0
        }
    }

    LaunchedEffect(Unit) {
        val permsToRequest = buildList {
            if (!hasPermission) add(Manifest.permission.CAMERA)
            if (!hasAudioPermission) add(Manifest.permission.RECORD_AUDIO)
        }
        if (permsToRequest.isNotEmpty()) {
            permissionLauncher.launch(permsToRequest.toTypedArray())
        }
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

    // Switch use cases when mode changes; stop any active recording
    LaunchedEffect(currentMode) {
        if (isRecording) {
            activeRecording?.stop()
            isRecording = false
            activeRecording = null
        }
        cameraController.setEnabledUseCases(
            if (currentMode == CreateMode.REELS)
                LifecycleCameraController.VIDEO_CAPTURE
            else
                LifecycleCameraController.IMAGE_CAPTURE
        )
    }

    // Helper: start video recording
    fun startRecording() {
        val outputFile = File(context.filesDir, "reel_${System.currentTimeMillis()}.mp4")
        val outputOptions = FileOutputOptions.Builder(outputFile).build()
        val audioConfig = if (hasAudioPermission) AudioConfig.create(true) else AudioConfig.AUDIO_DISABLED
        try {
            val recording = cameraController.startRecording(
                outputOptions,
                audioConfig,
                ContextCompat.getMainExecutor(context)
            ) { event ->
                if (event is VideoRecordEvent.Finalize) {
                    isRecording = false
                    activeRecording = null
                    if (!event.hasError()) {
                        onVideoSelected(event.outputResults.outputUri)
                    }
                }
            }
            activeRecording = recording
            isRecording = true
        } catch (_: Exception) {
            isRecording = false
        }
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
            CameraNoPermission(onRequest = {
                permissionLauncher.launch(
                    arrayOf(Manifest.permission.CAMERA, Manifest.permission.RECORD_AUDIO)
                )
            })
        }

        // Top bar
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .statusBarsPadding()
                .padding(horizontal = 12.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            CameraIconButton(onClick = {
                if (isRecording) { activeRecording?.stop(); isRecording = false }
                onClose()
            }) {
                Icon(Icons.Default.Close, null, tint = Color.White, modifier = Modifier.size(22.dp))
            }

            Spacer(Modifier.weight(1f))

            // Recording timer (shown only when recording)
            if (isRecording) {
                val mins = recordingSeconds / 60
                val secs = recordingSeconds % 60
                Box(
                    modifier = Modifier
                        .background(Color.Red, RoundedCornerShape(20.dp))
                        .padding(horizontal = 14.dp, vertical = 6.dp)
                ) {
                    Text(
                        text = "%02d:%02d".format(mins, secs),
                        color = Color.White,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            } else {
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
                        val bgColor by animateColorAsState(
                            targetValue = if (active) Color.White else Color.Transparent,
                            animationSpec = tween(160, easing = FastOutSlowInEasing),
                            label = "tab_bg"
                        )
                        val textColor by animateColorAsState(
                            targetValue = if (active) Color.Black else Color.White.copy(0.7f),
                            animationSpec = tween(160, easing = FastOutSlowInEasing),
                            label = "tab_text"
                        )
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(20.dp))
                                .background(bgColor)
                                .clickable(
                                    indication = null,
                                    interactionSource = remember { MutableInteractionSource() }
                                ) { onModeChange(mode) }
                                .padding(horizontal = 16.dp, vertical = 7.dp)
                        ) {
                            Text(
                                text = label,
                                color = textColor,
                                fontSize = 13.sp,
                                fontWeight = if (active) FontWeight.Bold else FontWeight.Normal
                            )
                        }
                    }
                }
            }

            Spacer(Modifier.weight(1f))

            val flashTint by animateColorAsState(
                targetValue = if (flashEnabled) Color(0xFFFFE082) else Color.White,
                animationSpec = tween(140, easing = FastOutSlowInEasing),
                label = "flash"
            )
            CameraIconButton(
                onClick = { if (!isRecording) flashEnabled = !flashEnabled }
            ) {
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
            targetValue = if (isCapturing || isRecording) 0.88f else 1f,
            animationSpec = spring(dampingRatio = 0.7f, stiffness = 700f),
            label = "cap_scale"
        )

        Box(
            modifier = Modifier
                .fillMaxWidth()
                .align(Alignment.BottomCenter)
                .navigationBarsPadding()
                .padding(bottom = 36.dp, start = 32.dp, end = 32.dp)
        ) {
            // Gallery button
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
                        if (!isRecording) {
                            if (currentMode == CreateMode.REELS) videoGalleryLauncher.launch("video/*")
                            else galleryLauncher.launch("image/*")
                        }
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

            // Shutter / Record button
            Box(modifier = Modifier.align(Alignment.Center).size(108.dp), contentAlignment = Alignment.Center) {
                val ringColor by animateColorAsState(
                    targetValue = if (currentMode == CreateMode.REELS) {
                        if (isRecording) Color.Red else Color(0xFFFF3B6B)
                    } else Color.White,
                    animationSpec = tween(200),
                    label = "ring_color"
                )
                // Outer ring — grows when holding to record (Instagram-style)
                val ringSize by animateDpAsState(
                    targetValue = if (isRecording) 108.dp else 88.dp,
                    animationSpec = tween(220, easing = FastOutSlowInEasing),
                    label = "ring_size"
                )
                Box(modifier = Modifier.size(ringSize).border(4.dp, ringColor, CircleShape))

                // Inner shutter button — shrinks to a red square while recording
                val innerSize by animateDpAsState(
                    targetValue = if (isRecording) 36.dp else 72.dp,
                    animationSpec = tween(220, easing = FastOutSlowInEasing),
                    label = "inner_size"
                )
                Box(
                    modifier = Modifier
                        .size(innerSize)
                        .scale(captureScale)
                        .background(
                            when {
                                isCapturing -> Color.LightGray
                                isRecording -> Color.Red
                                currentMode == CreateMode.REELS -> Color(0xFFFF3B6B)
                                else -> Color.White
                            },
                            if (isRecording) RoundedCornerShape(8.dp) else CircleShape
                        )
                        .pointerInput(currentMode, hasPermission, isCapturing) {
                            if (!hasPermission || isCapturing) return@pointerInput
                            detectTapGestures(
                                onPress = {
                                    if (currentMode == CreateMode.REELS) {
                                        // Instagram-style: hold-to-record
                                        startRecording()
                                        tryAwaitRelease()
                                        // Finger lifted (or gesture cancelled) — stop recording
                                        activeRecording?.stop()
                                    }
                                },
                                onTap = {
                                    if (currentMode != CreateMode.REELS) {
                                        isCapturing = true
                                        val outputFile = File(
                                            context.filesDir,
                                            "capture_${System.currentTimeMillis()}.jpg"
                                        )
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
                                }
                            )
                        },
                    contentAlignment = Alignment.Center
                ) {
                    if (currentMode == CreateMode.REELS && !isRecording) {
                        Icon(Icons.Default.Videocam, null, tint = Color.White, modifier = Modifier.size(32.dp))
                    }
                }
            }

            // Flip camera button (hidden while recording)
            if (!isRecording) {
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
