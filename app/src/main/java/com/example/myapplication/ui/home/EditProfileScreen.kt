package com.example.myapplication.ui.home

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.filled.Event
import androidx.compose.material.icons.filled.LocationCity
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.School
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.example.myapplication.core.media.MediaUtils
import java.io.File

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EditProfileScreen(
    isDarkMode: Boolean,
    initialName: String,
    initialUsername: String,
    initialBio: String,
    initialBirthday: String,
    initialLocation: String,
    initialSchool: String,
    onBack: () -> Unit,
    onSave: (String, String, String, String, String, String) -> Unit,
    isSaving: Boolean = false,
    errorMessage: String? = null,
    avatarUrl: String? = null,
    bannerUrl: String? = null,
    isUploadingAvatar: Boolean = false,
    isUploadingBanner: Boolean = false,
    onPickAvatar: (File) -> Unit = {},
    onPickBanner: (File) -> Unit = {}
) {
    val backgroundColor = if (isDarkMode) Color(0xFF0F0F0F) else Color.White
    val contentColor = if (isDarkMode) Color.White else Color.Black
    val accentBlue = Color(0xFF00A3FF)
    val fieldColor = if (isDarkMode) Color(0xFF1A1A1A) else Color(0xFFF5F5F5)
    val context = LocalContext.current

    var name by remember { mutableStateOf(initialName) }
    var username by remember { mutableStateOf(initialUsername) }
    var bio by remember { mutableStateOf(initialBio) }
    var birthday by remember { mutableStateOf(initialBirthday) }
    var location by remember { mutableStateOf(initialLocation) }
    var school by remember { mutableStateOf(initialSchool) }

    val avatarPicker = rememberLauncherForActivityResult(
        ActivityResultContracts.PickVisualMedia()
    ) { uri: Uri? ->
        if (uri != null) runCatching { MediaUtils.compressImage(context, uri) }.onSuccess(onPickAvatar)
    }
    val bannerPicker = rememberLauncherForActivityResult(
        ActivityResultContracts.PickVisualMedia()
    ) { uri: Uri? ->
        if (uri != null) runCatching { MediaUtils.compressImage(context, uri) }.onSuccess(onPickBanner)
    }
    val imageOnlyRequest = PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)

    val configuration = LocalConfiguration.current
    val screenWidth = configuration.screenWidthDp.dp
    val bannerHeight = screenWidth * 500f / 1080f
    val avatarSize = 110.dp

    Scaffold(
        containerColor = backgroundColor,
        topBar = {
            CenterAlignedTopAppBar(
                title = { Text("Edit Profile", fontWeight = FontWeight.ExtraBold, fontSize = 20.sp) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, null)
                    }
                },
                actions = {
                    TextButton(
                        enabled = !isSaving,
                        onClick = { onSave(name, username, bio, birthday, location, school) }
                    ) {
                        Text("Done", color = accentBlue, fontWeight = FontWeight.ExtraBold, fontSize = 16.sp)
                    }
                },
                colors = TopAppBarDefaults.centerAlignedTopAppBarColors(
                    containerColor = backgroundColor,
                    titleContentColor = contentColor,
                    navigationIconContentColor = contentColor
                )
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
        ) {
            // Images Section
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(bannerHeight + (avatarSize / 2))
            ) {
                // Banner: real photo if set, otherwise a plain flat surface.
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(bannerHeight)
                        .background(fieldColor)
                        .clickable(enabled = !isUploadingBanner) { bannerPicker.launch(imageOnlyRequest) }
                ) {
                    if (!bannerUrl.isNullOrBlank()) {
                        AsyncImage(
                            model = bannerUrl,
                            contentDescription = "Banner",
                            modifier = Modifier.fillMaxSize(),
                            contentScale = ContentScale.Crop
                        )
                    }
                    // Banner Edit Overlay
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .background(Color.Black.copy(0.35f)),
                        contentAlignment = Alignment.Center
                    ) {
                        if (isUploadingBanner) {
                            CircularProgressIndicator(color = Color.White, strokeWidth = 2.dp, modifier = Modifier.size(28.dp))
                        } else {
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Icon(Icons.Default.CameraAlt, null, tint = Color.White, modifier = Modifier.size(32.dp))
                                Text("Edit Cover", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }

                // Avatar
                Box(
                    modifier = Modifier
                        .align(Alignment.BottomCenter)
                        .size(avatarSize)
                        .background(backgroundColor, CircleShape)
                        .padding(4.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .clip(CircleShape)
                            .background(fieldColor)
                            .clickable(enabled = !isUploadingAvatar) { avatarPicker.launch(imageOnlyRequest) }
                    ) {
                        if (!avatarUrl.isNullOrBlank()) {
                            AsyncImage(
                                model = avatarUrl,
                                contentDescription = "Profile Picture",
                                modifier = Modifier.fillMaxSize(),
                                contentScale = ContentScale.Crop
                            )
                        } else {
                            Icon(
                                Icons.Default.Person,
                                contentDescription = null,
                                tint = contentColor.copy(alpha = 0.4f),
                                modifier = Modifier.fillMaxSize(0.6f).align(Alignment.Center)
                            )
                        }
                        // Avatar Edit Overlay
                        Box(
                            modifier = Modifier
                                .fillMaxSize()
                                .background(Color.Black.copy(0.35f)),
                            contentAlignment = Alignment.Center
                        ) {
                            if (isUploadingAvatar) {
                                CircularProgressIndicator(color = Color.White, strokeWidth = 2.dp, modifier = Modifier.size(20.dp))
                            } else {
                                Icon(Icons.Default.CameraAlt, null, tint = Color.White, modifier = Modifier.size(24.dp))
                            }
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(30.dp))

            // Text Fields Section
            Column(modifier = Modifier.padding(horizontal = 20.dp)) {
                Text("Public Information", color = accentBlue, fontWeight = FontWeight.ExtraBold, fontSize = 14.sp)
                Spacer(modifier = Modifier.height(16.dp))
                
                EditField(label = "Name", value = name, onValueChange = { name = it }, isDarkMode = isDarkMode)
                Spacer(modifier = Modifier.height(16.dp))
                EditField(label = "Username", value = username, onValueChange = { username = it }, isDarkMode = isDarkMode)
                Spacer(modifier = Modifier.height(16.dp))
                EditField(label = "Bio", value = bio, onValueChange = { bio = it }, isDarkMode = isDarkMode, singleLine = false)
                
                Spacer(modifier = Modifier.height(32.dp))
                
                Text("Personal Details", color = accentBlue, fontWeight = FontWeight.ExtraBold, fontSize = 14.sp)
                Spacer(modifier = Modifier.height(16.dp))
                
                EditField(label = "Birthday", value = birthday, onValueChange = { birthday = it }, isDarkMode = isDarkMode, icon = Icons.Default.Event)
                Spacer(modifier = Modifier.height(16.dp))
                EditField(label = "Location", value = location, onValueChange = { location = it }, isDarkMode = isDarkMode, icon = Icons.Default.LocationCity)
                Spacer(modifier = Modifier.height(16.dp))
                EditField(label = "Education", value = school, onValueChange = { school = it }, isDarkMode = isDarkMode, icon = Icons.Default.School)
                
                Spacer(modifier = Modifier.height(40.dp))
                
                Button(
                    enabled = !isSaving,
                    onClick = { onSave(name, username, bio, birthday, location, school) },
                    modifier = Modifier.fillMaxWidth().height(56.dp),
                    shape = RoundedCornerShape(16.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = accentBlue)
                ) {
                    if (isSaving) {
                        CircularProgressIndicator(
                            color = Color.White,
                            strokeWidth = 2.dp,
                            modifier = Modifier.size(18.dp)
                        )
                    } else {
                        Text("Save Changes", fontWeight = FontWeight.ExtraBold, fontSize = 16.sp)
                    }
                }
                if (!errorMessage.isNullOrBlank()) {
                    Spacer(modifier = Modifier.height(10.dp))
                    Text(
                        text = errorMessage,
                        color = Color.Red,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Medium
                    )
                }
            }
            
            Spacer(modifier = Modifier.height(50.dp))
        }
    }
}

@Composable
fun EditField(
    label: String,
    value: String,
    onValueChange: (String) -> Unit,
    isDarkMode: Boolean,
    singleLine: Boolean = true,
    icon: ImageVector? = null
) {
    val contentColor = if (isDarkMode) Color.White else Color.Black
    val fieldColor = if (isDarkMode) Color(0xFF1A1A1A) else Color(0xFFF5F5F5)

    Column {
        Text(
            text = label,
            fontSize = 13.sp,
            color = Color.Gray,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.padding(start = 4.dp, bottom = 8.dp)
        )
        TextField(
            value = value,
            onValueChange = onValueChange,
            modifier = Modifier.fillMaxWidth(),
            leadingIcon = icon?.let { { Icon(it, null, tint = Color.Gray, modifier = Modifier.size(20.dp)) } },
            colors = TextFieldDefaults.colors(
                focusedContainerColor = fieldColor,
                unfocusedContainerColor = fieldColor,
                disabledContainerColor = fieldColor,
                focusedIndicatorColor = Color.Transparent,
                unfocusedIndicatorColor = Color.Transparent,
                cursorColor = Color(0xFF00A3FF),
                focusedTextColor = contentColor,
                unfocusedTextColor = contentColor
            ),
            shape = RoundedCornerShape(16.dp),
            singleLine = singleLine,
            minLines = if (singleLine) 1 else 3
        )
    }
}
