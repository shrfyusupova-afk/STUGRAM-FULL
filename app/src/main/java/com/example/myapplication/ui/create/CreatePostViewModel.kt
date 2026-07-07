package com.example.myapplication.ui.create

import android.content.Context
import android.net.Uri
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.myapplication.core.media.MediaUtils
import com.example.myapplication.data.remote.post.PostRepository
import com.example.myapplication.data.remote.post.PostResult
import java.io.File
import java.util.UUID
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

enum class CreateType { POST, STORY }

sealed class UploadUiState {
    object Idle : UploadUiState()
    object Preparing : UploadUiState()
    data class Uploading(val progress: Float) : UploadUiState()
    object Success : UploadUiState()
    data class Error(val message: String) : UploadUiState()
}

class CreatePostViewModel(
    private val repository: PostRepository = PostRepository(),
    private val ioDispatcher: CoroutineDispatcher = Dispatchers.IO
) : ViewModel() {

    var type by mutableStateOf(CreateType.POST)
        private set
    var mediaUris by mutableStateOf<List<Uri>>(emptyList())
        private set
    var isVideo by mutableStateOf(false)
        private set
    var caption by mutableStateOf("")
        private set
    var uploadState by mutableStateOf<UploadUiState>(UploadUiState.Idle)
        private set

    // Generated once per screen; reused across retries so a retried upload after a
    // network blip does not create a duplicate post server-side.
    private var idempotencyKey: String = UUID.randomUUID().toString()

    fun init(createType: CreateType) {
        type = createType
    }

    fun setMedia(uris: List<Uri>, isVideo: Boolean) {
        mediaUris = if (type == CreateType.STORY) uris.take(1) else uris.take(10)
        this.isVideo = isVideo
    }

    fun onCaptionChange(value: String) {
        caption = value
    }

    fun share(context: Context, onSuccess: () -> Unit) {
        if (mediaUris.isEmpty()) {
            uploadState = UploadUiState.Error("Avval media tanlang")
            return
        }
        viewModelScope.launch {
            uploadState = UploadUiState.Preparing
            var prepared: List<File> = emptyList()
            try {
                prepared = withContext(ioDispatcher) {
                    if (isVideo) mediaUris.map { MediaUtils.copyVideo(context, it) }
                    else mediaUris.map { MediaUtils.compressImage(context, it) }
                }
                uploadState = UploadUiState.Uploading(0f)
                val result = withContext(ioDispatcher) {
                    if (type == CreateType.STORY) {
                        repository.createStory(prepared.first(), isVideo, caption, idempotencyKey) { p ->
                            uploadState = UploadUiState.Uploading(p)
                        }
                    } else {
                        repository.createPost(prepared, isVideo, caption, idempotencyKey) { p ->
                            uploadState = UploadUiState.Uploading(p)
                        }
                    }
                }
                when (result) {
                    is PostResult.Success -> {
                        uploadState = UploadUiState.Success
                        onSuccess()
                    }
                    is PostResult.Error -> uploadState = UploadUiState.Error(result.message)
                }
            } catch (e: MediaUtils.MediaException) {
                uploadState = UploadUiState.Error(e.message ?: "Media xatosi")
            } catch (e: Exception) {
                uploadState = UploadUiState.Error("Xatolik: ${e.message}")
            } finally {
                withContext(ioDispatcher) { prepared.forEach { runCatching { it.delete() } } }
            }
        }
    }

    fun retry(context: Context, onSuccess: () -> Unit) = share(context, onSuccess)
}
