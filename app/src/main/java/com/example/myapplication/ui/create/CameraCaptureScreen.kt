package com.example.myapplication.ui.create

import android.Manifest
import android.annotation.SuppressLint
import android.content.pm.PackageManager
import android.net.Uri
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.FlipCameraAndroid
import androidx.compose.material.icons.filled.PhotoLibrary
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageCapture
import androidx.camera.core.ImageCaptureException
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.video.FileOutputOptions
import androidx.camera.video.Quality
import androidx.camera.video.QualitySelector
import androidx.camera.video.Recorder
import androidx.camera.video.Recording
import androidx.camera.video.VideoCapture
import androidx.camera.video.VideoRecordEvent
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.LocalLifecycleOwner
import java.io.File
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext

private const val MAX_VIDEO_MS = 60_000L

/**
 * CameraX capture step of the create flow: full-screen preview, photo shutter,
 * video recording (60s cap with a progress arc), front/back flip, and a gallery
 * button that works even when the camera permission is denied.
 */
@Composable
fun CameraCaptureScreen(
    type: CreateType,
    onClose: () -> Unit,
    onMediaSelected: (List<Uri>, Boolean) -> Unit
) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val accentBlue = Color(0xFF00A3FF)

    var cameraGranted by remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED
        )
    }
    var audioGranted by remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED
        )
    }
    var permissionRequested by remember { mutableStateOf(false) }

    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { grants ->
        cameraGranted = grants[Manifest.permission.CAMERA] == true ||
            ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED
        audioGranted = grants[Manifest.permission.RECORD_AUDIO] == true || audioGranted
        permissionRequested = true
    }

    LaunchedEffect(Unit) {
        if (!cameraGranted) {
            permissionLauncher.launch(arrayOf(Manifest.permission.CAMERA, Manifest.permission.RECORD_AUDIO))
        }
    }

    // --- Gallery picker (works regardless of camera permission) ---
    val singleImagePicker = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        if (uri != null) onMediaSelected(listOf(uri), false)
    }
    val multiImagePicker = rememberLauncherForActivityResult(ActivityResultContracts.PickMultipleVisualMedia(10)) { uris ->
        if (uris.isNotEmpty()) onMediaSelected(uris, false)
    }
    val videoPicker = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        if (uri != null) onMediaSelected(listOf(uri), true)
    }
    val openGallery = {
        when (type) {
            CreateType.REEL -> videoPicker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.VideoOnly))
            CreateType.STORY -> singleImagePicker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly))
            CreateType.POST -> multiImagePicker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly))
        }
    }

    // --- Camera state ---
    var lensFacing by remember { mutableIntStateOf(CameraSelector.LENS_FACING_BACK) }
    var isVideoMode by remember { mutableStateOf(type == CreateType.REEL) }
    var isCapturing by remember { mutableStateOf(false) }
    var recording by remember { mutableStateOf<Recording?>(null) }
    var recordingMs by remember { mutableLongStateOf(0L) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    val previewView = remember { PreviewView(context) }
    val imageCapture = remember { ImageCapture.Builder().build() }
    val videoCapture = remember {
        VideoCapture.withOutput(
            Recorder.Builder()
                .setQualitySelector(QualitySelector.from(Quality.HD))
                .build()
        )
    }
    var cameraProvider by remember { mutableStateOf<ProcessCameraProvider?>(null) }

    LaunchedEffect(cameraGranted, lensFacing) {
        if (!cameraGranted) return@LaunchedEffect
        val provider = withContext(Dispatchers.IO) { ProcessCameraProvider.getInstance(context).get() }
        cameraProvider = provider
        val preview = Preview.Builder().build().also { it.setSurfaceProvider(previewView.surfaceProvider) }
        val selector = CameraSelector.Builder().requireLensFacing(lensFacing).build()
        runCatching {
            provider.unbindAll()
            provider.bindToLifecycle(lifecycleOwner, selector, preview, imageCapture, videoCapture)
        }.onFailure { errorMessage = "Kamera ochilmadi: ${it.message}" }
    }

    DisposableEffect(Unit) {
        onDispose {
            recording?.stop()
            cameraProvider?.unbindAll()
        }
    }

    // 60s hard cap with a visible timer.
    LaunchedEffect(recording) {
        if (recording == null) {
            recordingMs = 0L
            return@LaunchedEffect
        }
        val startedAt = System.currentTimeMillis()
        while (recording != null) {
            recordingMs = System.currentTimeMillis() - startedAt
            if (recordingMs >= MAX_VIDEO_MS) {
                recording?.stop()
                break
            }
            delay(100)
        }
    }

    val takePhoto = takePhoto@{
        if (isCapturing) return@takePhoto
        isCapturing = true
        errorMessage = null
        val file = File.createTempFile("capture_", ".jpg", context.cacheDir)
        val options = ImageCapture.OutputFileOptions.Builder(file).build()
        imageCapture.takePicture(
            options,
            ContextCompat.getMainExecutor(context),
            object : ImageCapture.OnImageSavedCallback {
                override fun onImageSaved(outputFileResults: ImageCapture.OutputFileResults) {
                    isCapturing = false
                    onMediaSelected(listOf(Uri.fromFile(file)), false)
                }

                override fun onError(exception: ImageCaptureException) {
                    isCapturing = false
                    errorMessage = "Surat olinmadi: ${exception.message}"
                }
            }
        )
    }

    @SuppressLint("MissingPermission") // audio guarded by audioGranted
    fun startRecording() {
        if (recording != null) return
        errorMessage = null
        val file = File.createTempFile("capture_", ".mp4", context.cacheDir)
        val pending = videoCapture.output
            .prepareRecording(context, FileOutputOptions.Builder(file).build())
            .let { if (audioGranted) it.withAudioEnabled() else it }
        recording = pending.start(ContextCompat.getMainExecutor(context)) { event ->
            if (event is VideoRecordEvent.Finalize) {
                recording = null
                if (event.hasError()) {
                    errorMessage = "Video yozilmadi (xato ${event.error})"
                } else {
                    onMediaSelected(listOf(Uri.fromFile(file)), true)
                }
            }
        }
    }

    BackHandler {
        if (recording != null) recording?.stop() else onClose()
    }

    Box(modifier = Modifier.fillMaxSize().background(Color.Black)) {
        if (cameraGranted) {
            AndroidView(factory = { previewView }, modifier = Modifier.fillMaxSize())
        } else {
            // Camera denied: explain, offer re-request, keep gallery available.
            Column(
                modifier = Modifier.fillMaxSize().padding(32.dp),
                verticalArrangement = Arrangement.Center,
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text(
                    "Kamera uchun ruxsat berilmagan",
                    color = Color.White,
                    fontWeight = FontWeight.Bold,
                    fontSize = 18.sp,
                    textAlign = TextAlign.Center
                )
                Spacer(Modifier.height(8.dp))
                Text(
                    "Suratga olish uchun kamera ruxsati kerak. Galereyadan tanlash esa ruxsatsiz ham ishlaydi.",
                    color = Color.White.copy(alpha = 0.75f),
                    fontSize = 13.sp,
                    textAlign = TextAlign.Center
                )
                if (permissionRequested) {
                    Spacer(Modifier.height(16.dp))
                    Button(
                        onClick = {
                            permissionLauncher.launch(arrayOf(Manifest.permission.CAMERA, Manifest.permission.RECORD_AUDIO))
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = accentBlue)
                    ) { Text("Ruxsat berish", color = Color.White) }
                }
            }
        }

        // --- Top bar ---
        Row(
            modifier = Modifier.fillMaxWidth().statusBarsPadding().padding(horizontal = 8.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            IconButton(onClick = { if (recording != null) recording?.stop() else onClose() }) {
                Icon(Icons.Default.Close, contentDescription = "Yopish", tint = Color.White, modifier = Modifier.size(28.dp))
            }
            if (recording != null) {
                Text(
                    text = "${(recordingMs / 1000)}s / 60s",
                    color = Color.White,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier
                        .clip(RoundedCornerShape(12.dp))
                        .background(Color.Red.copy(alpha = 0.75f))
                        .padding(horizontal = 10.dp, vertical = 4.dp)
                )
            }
            if (cameraGranted) {
                IconButton(
                    onClick = {
                        if (recording == null) {
                            lensFacing = if (lensFacing == CameraSelector.LENS_FACING_BACK)
                                CameraSelector.LENS_FACING_FRONT else CameraSelector.LENS_FACING_BACK
                        }
                    }
                ) {
                    Icon(Icons.Default.FlipCameraAndroid, contentDescription = "Kamerani almashtirish", tint = Color.White)
                }
            } else {
                Spacer(Modifier.size(48.dp))
            }
        }

        errorMessage?.let {
            Text(
                it,
                color = Color.White,
                fontSize = 13.sp,
                textAlign = TextAlign.Center,
                modifier = Modifier
                    .align(Alignment.Center)
                    .padding(horizontal = 24.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .background(Color(0xFFB3261E).copy(alpha = 0.85f))
                    .padding(horizontal = 14.dp, vertical = 8.dp)
            )
        }

        // --- Bottom controls ---
        Column(
            modifier = Modifier.align(Alignment.BottomCenter).navigationBarsPadding().padding(bottom = 24.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 30.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                // Gallery — always available.
                IconButton(
                    onClick = { if (recording == null) openGallery() },
                    modifier = Modifier
                        .size(48.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .background(Color.White.copy(alpha = 0.2f))
                ) {
                    Icon(Icons.Default.PhotoLibrary, contentDescription = "Galereya", tint = Color.White)
                }

                // Shutter with a recording progress arc.
                Box(contentAlignment = Alignment.Center) {
                    if (recording != null) {
                        CircularProgressIndicator(
                            progress = { (recordingMs.toFloat() / MAX_VIDEO_MS).coerceIn(0f, 1f) },
                            color = Color.Red,
                            strokeWidth = 5.dp,
                            modifier = Modifier.size(92.dp)
                        )
                    }
                    Box(
                        modifier = Modifier
                            .size(84.dp)
                            .border(5.dp, Color.White, CircleShape)
                            .padding(8.dp)
                            .clip(CircleShape)
                            .background(
                                when {
                                    recording != null -> Color.Red
                                    isVideoMode -> Color.Red.copy(alpha = 0.85f)
                                    else -> Color.White
                                }
                            )
                            .clickable(enabled = cameraGranted && !isCapturing) {
                                when {
                                    recording != null -> recording?.stop()
                                    isVideoMode -> startRecording()
                                    else -> takePhoto()
                                }
                            }
                    )
                }

                Spacer(Modifier.size(48.dp))
            }

            Spacer(Modifier.height(20.dp))

            // Photo/Video mode toggle (hidden while recording; stories/posts can
            // capture either, a captured video becomes a reel/video story).
            if (recording == null && cameraGranted) {
                Row(horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically) {
                    listOf(false to "SURAT", true to "VIDEO").forEach { (videoMode, label) ->
                        val selected = isVideoMode == videoMode
                        Text(
                            text = label,
                            color = if (selected) accentBlue else Color.White.copy(alpha = 0.6f),
                            fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal,
                            fontSize = 14.sp,
                            modifier = Modifier
                                .padding(horizontal = 14.dp)
                                .clickable { isVideoMode = videoMode }
                        )
                    }
                }
            }
        }
    }
}
