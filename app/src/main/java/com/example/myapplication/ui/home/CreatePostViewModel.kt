package com.example.myapplication.ui.home

import android.content.Context
import android.net.Uri
import androidx.compose.ui.graphics.Color
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.myapplication.data.remote.RetrofitClient
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.UUID

enum class CreatePostStep { CAMERA, EDIT, PUBLISH, STORY_EDIT, REELS_PUBLISH }
enum class CreateMode { POST, REELS, STORY }

enum class PostFilter(val label: String) {
    NORMAL("Normal"),
    VIVID("Vivid"),
    COOL("Cool"),
    WARM("Warm"),
    MONO("Mono"),
    FADE("Fade")
}

data class TextOverlay(
    val id: String = UUID.randomUUID().toString(),
    val text: String,
    val x: Float = 0f,
    val y: Float = 0f,
    val scale: Float = 1f,
    val color: Color = Color.White
)

data class AudioTrack(
    val id: String,
    val title: String,
    val artist: String,
    val duration: String = "3:24"
)

data class CreatePostState(
    val step: CreatePostStep = CreatePostStep.CAMERA,
    val mode: CreateMode = CreateMode.POST,
    val imageUri: Uri? = null,
    val isVideo: Boolean = false,
    val caption: String = "",
    val location: String = "",
    val taggedUsers: List<String> = emptyList(),
    val audience: String = "everyone",
    val selectedAudio: AudioTrack? = null,
    val textOverlays: List<TextOverlay> = emptyList(),
    val selectedFilter: PostFilter = PostFilter.NORMAL,
    val brightness: Float = 0f,
    val contrast: Float = 1f,
    val saturation: Float = 1f,
    val isLoading: Boolean = false,
    val error: String? = null,
    val isSuccess: Boolean = false
)

val suggestedAudioTracks = listOf(
    AudioTrack("1", "Blinding Lights", "The Weeknd", "3:20"),
    AudioTrack("2", "As It Was", "Harry Styles", "2:37"),
    AudioTrack("3", "Stay", "The Kid LAROI", "2:21"),
    AudioTrack("4", "Heat Waves", "Glass Animals", "3:59"),
    AudioTrack("5", "Levitating", "Dua Lipa", "3:23"),
    AudioTrack("6", "Bad Habits", "Ed Sheeran", "3:50"),
    AudioTrack("7", "Dynamite", "BTS", "3:19"),
    AudioTrack("8", "Peaches", "Justin Bieber", "3:18")
)

class CreatePostViewModel : ViewModel() {
    private val _state = MutableStateFlow(CreatePostState())
    val state = _state.asStateFlow()

    fun setImageUri(uri: Uri, isVideo: Boolean = false) {
        val mode = _state.value.mode
        val nextStep = when (mode) {
            CreateMode.POST -> CreatePostStep.EDIT
            CreateMode.STORY -> CreatePostStep.STORY_EDIT
            CreateMode.REELS -> CreatePostStep.REELS_PUBLISH
        }
        _state.update { it.copy(imageUri = uri, isVideo = isVideo, step = nextStep, error = null) }
    }

    fun setMode(mode: CreateMode) {
        _state.update { it.copy(mode = mode, error = null) }
    }

    fun goToCamera() {
        _state.update { it.copy(step = CreatePostStep.CAMERA, imageUri = null, error = null) }
    }

    fun goToPublish() {
        _state.update { it.copy(step = CreatePostStep.PUBLISH) }
    }

    fun goBackFromPublish() {
        _state.update { it.copy(step = CreatePostStep.EDIT) }
    }

    fun onCaptionChange(text: String) {
        _state.update { it.copy(caption = text, error = null) }
    }

    fun onLocationChange(text: String) {
        _state.update { it.copy(location = text) }
    }

    fun onAudienceChange(audience: String) {
        _state.update { it.copy(audience = audience) }
    }

    fun onAudioSelected(track: AudioTrack?) {
        _state.update { it.copy(selectedAudio = track) }
    }

    fun onFilterSelected(filter: PostFilter) {
        _state.update { it.copy(selectedFilter = filter) }
    }

    fun onBrightnessChange(value: Float) {
        _state.update { it.copy(brightness = value) }
    }

    fun onContrastChange(value: Float) {
        _state.update { it.copy(contrast = value) }
    }

    fun onSaturationChange(value: Float) {
        _state.update { it.copy(saturation = value) }
    }

    fun addTextOverlay(text: String, color: Color = Color.White) {
        if (text.isBlank()) return
        _state.update { it.copy(textOverlays = it.textOverlays + TextOverlay(text = text, color = color)) }
    }

    fun removeTextOverlay(id: String) {
        _state.update { it.copy(textOverlays = it.textOverlays.filter { o -> o.id != id }) }
    }

    fun moveTextOverlay(id: String, x: Float, y: Float) {
        _state.update {
            it.copy(textOverlays = it.textOverlays.map { o ->
                if (o.id == id) o.copy(x = x, y = y) else o
            })
        }
    }

    fun scaleTextOverlay(id: String, scale: Float) {
        _state.update {
            it.copy(textOverlays = it.textOverlays.map { o ->
                if (o.id == id) o.copy(scale = scale.coerceIn(0.4f, 5f)) else o
            })
        }
    }

    fun toggleTagUser(username: String) {
        _state.update {
            val list = it.taggedUsers.toMutableList()
            if (list.contains(username)) list.remove(username) else list.add(username)
            it.copy(taggedUsers = list)
        }
    }

    fun publishStory(context: Context) {
        val s = _state.value
        val uri = s.imageUri ?: run {
            _state.update { it.copy(error = "Media tanlanmagan") }
            return
        }
        viewModelScope.launch {
            _state.update { it.copy(isLoading = true, error = null) }
            try {
                val bytes = withContext(Dispatchers.IO) {
                    context.contentResolver.openInputStream(uri)?.readBytes()
                        ?: throw Exception("Media o'qib bo'lmadi")
                }
                val mimeType = if (s.isVideo) "video/mp4" else "image/jpeg"
                val fileName = if (s.isVideo) "story_${System.currentTimeMillis()}.mp4" else "story_${System.currentTimeMillis()}.jpg"
                val mediaBody = bytes.toRequestBody(mimeType.toMediaType())
                val mediaPart = MultipartBody.Part.createFormData("media", fileName, mediaBody)
                val captionPart = s.caption.trim().toRequestBody("text/plain".toMediaType())

                val response = withContext(Dispatchers.IO) {
                    RetrofitClient.instance.createStoryWithMedia(
                        media = mediaPart,
                        caption = captionPart
                    )
                }
                if (response.isSuccessful) {
                    _state.update { it.copy(isLoading = false, isSuccess = true) }
                } else {
                    val body = response.errorBody()?.string()?.take(250)
                    _state.update {
                        it.copy(isLoading = false, error = "Story xatosi (${response.code()}): ${body ?: ""}")
                    }
                }
            } catch (e: Exception) {
                _state.update { it.copy(isLoading = false, error = "Xato: ${e.message}") }
            }
        }
    }

    fun publishReel(context: Context) {
        // Reels go through the posts endpoint with video media
        val s = _state.value
        val uri = s.imageUri ?: run {
            _state.update { it.copy(error = "Video tanlanmagan") }
            return
        }
        viewModelScope.launch {
            _state.update { it.copy(isLoading = true, error = null) }
            try {
                val bytes = withContext(Dispatchers.IO) {
                    context.contentResolver.openInputStream(uri)?.readBytes()
                        ?: throw Exception("Video o'qib bo'lmadi")
                }
                val mediaBody = bytes.toRequestBody("video/mp4".toMediaType())
                val mediaPart = MultipartBody.Part.createFormData("media", "reel_${System.currentTimeMillis()}.mp4", mediaBody)
                val captionPart = s.caption.trim().toRequestBody("text/plain".toMediaType())
                val locationPart = s.location.trim().toRequestBody("text/plain".toMediaType())

                val response = withContext(Dispatchers.IO) {
                    RetrofitClient.instance.createPostWithMedia(
                        media = mediaPart,
                        caption = captionPart,
                        location = locationPart
                    )
                }
                if (response.isSuccessful) {
                    _state.update { it.copy(isLoading = false, isSuccess = true) }
                } else {
                    val body = response.errorBody()?.string()?.take(250)
                    _state.update {
                        it.copy(isLoading = false, error = "Reel xatosi (${response.code()}): ${body ?: ""}")
                    }
                }
            } catch (e: Exception) {
                _state.update { it.copy(isLoading = false, error = "Xato: ${e.message}") }
            }
        }
    }

    fun publishPost(context: Context) {
        val s = _state.value
        val imageUri = s.imageUri ?: run {
            _state.update { it.copy(error = "Rasm tanlanmagan") }
            return
        }

        viewModelScope.launch {
            _state.update { it.copy(isLoading = true, error = null) }
            try {
                val bytes = withContext(Dispatchers.IO) {
                    context.contentResolver.openInputStream(imageUri)
                        ?.readBytes()
                        ?: throw Exception("Rasm o'qib bo'lmadi")
                }
                val requestFile = bytes.toRequestBody("image/jpeg".toMediaType())
                val mediaPart = MultipartBody.Part.createFormData("media", "post_photo.jpg", requestFile)
                val captionPart = s.caption.trim().toRequestBody("text/plain".toMediaType())
                val locationPart = s.location.trim().toRequestBody("text/plain".toMediaType())

                val response = withContext(Dispatchers.IO) {
                    RetrofitClient.instance.createPostWithMedia(
                        media = mediaPart,
                        caption = captionPart,
                        location = locationPart
                    )
                }

                if (response.isSuccessful) {
                    _state.update { it.copy(isLoading = false, isSuccess = true) }
                } else {
                    val body = response.errorBody()?.string()?.take(250)
                    _state.update {
                        it.copy(
                            isLoading = false,
                            error = "Post qo'yish xatosi (${response.code()}): ${body ?: ""}"
                        )
                    }
                }
            } catch (e: Exception) {
                _state.update { it.copy(isLoading = false, error = "Xato: ${e.message}") }
            }
        }
    }
}
