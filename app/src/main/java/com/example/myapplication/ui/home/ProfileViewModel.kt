package com.example.myapplication.ui.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.myapplication.core.ui.UiState
import com.example.myapplication.data.remote.AuthApi
import com.example.myapplication.data.remote.RetrofitClient
import com.example.myapplication.data.remote.UpdateProfileRequest
import com.example.myapplication.data.remote.post.HighlightDto
import com.example.myapplication.data.remote.post.PostDto
import com.example.myapplication.data.remote.post.PostRepository
import com.example.myapplication.data.remote.post.PostResult
import java.io.File
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

data class AlphaProfileUiState(
    val isLoading: Boolean = true,
    val isSaving: Boolean = false,
    val error: String? = null,
    val saveError: String? = null,
    val fullName: String = "",
    val username: String = "",
    val bio: String = "",
    val avatarUrl: String? = null,
    val bannerUrl: String? = null,
    val location: String = "",
    val school: String = "",
    val group: String = "",
    val followersCount: Int = 0,
    val followingCount: Int = 0,
    val postsCount: Int = 0,
    val targetUsername: String? = null,
    val userId: String? = null,
    val isSelf: Boolean = true,
    val followStatus: String = "self",
    val postsState: UiState<List<ProfilePostItem>> = UiState.Loading,
    val isLoadingMorePosts: Boolean = false,
    val highlights: List<HighlightItem> = emptyList(),
    val isUploadingAvatar: Boolean = false,
    val isUploadingBanner: Boolean = false
)

data class HighlightItem(
    val id: String,
    val title: String,
    val coverUrl: String?
)

data class ProfilePostItem(
    val id: String,
    val caption: String,
    val mediaUrl: String?,
    val isVideo: Boolean = false
)

class ProfileViewModel(
    private val repository: PostRepository = PostRepository(),
    private val authApi: AuthApi = RetrofitClient.instance,
    private val ioDispatcher: CoroutineDispatcher = Dispatchers.IO
) : ViewModel() {
    private val _uiState = MutableStateFlow(AlphaProfileUiState())
    val uiState: StateFlow<AlphaProfileUiState> = _uiState.asStateFlow()

    private val loadedPosts = mutableListOf<ProfilePostItem>()
    private var postsPage = 1
    private var postsTotalPages = 1

    init {
        refresh()
    }

    fun setProfileTarget(username: String?) {
        _uiState.update { it.copy(targetUsername = username?.trim()?.ifBlank { null }) }
        refresh()
    }

    fun refresh() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }
            val target = _uiState.value.targetUsername
            val result = withContext(ioDispatcher) {
                if (target.isNullOrBlank()) repository.getMyProfile() else repository.getProfileByUsername(target)
            }
            when (result) {
                is PostResult.Error -> _uiState.update { it.copy(isLoading = false, error = result.message) }
                is PostResult.Success -> {
                    val dto = result.value
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            error = null,
                            saveError = null,
                            fullName = dto.fullName.orEmpty(),
                            username = dto.username.orEmpty(),
                            bio = dto.bio.orEmpty(),
                            avatarUrl = dto.avatar,
                            bannerUrl = dto.banner,
                            location = dto.location.orEmpty(),
                            school = dto.school.orEmpty(),
                            group = dto.group.orEmpty(),
                            followersCount = dto.followersCount ?: 0,
                            followingCount = dto.followingCount ?: 0,
                            postsCount = dto.postsCount ?: 0,
                            userId = dto.id,
                            isSelf = target.isNullOrBlank() || dto.followStatus == "self",
                            followStatus = dto.followStatus ?: if (target.isNullOrBlank()) "self" else "not_following"
                        )
                    }
                    loadPosts(reset = true)
                    loadHighlights(target)
                }
            }
        }
    }

    private fun loadHighlights(target: String?) {
        viewModelScope.launch {
            val result = withContext(ioDispatcher) {
                if (target.isNullOrBlank()) repository.getMyHighlights() else repository.getHighlightsByUsername(target)
            }
            if (result is PostResult.Success) {
                _uiState.update {
                    it.copy(
                        highlights = result.value.mapNotNull { dto ->
                            val id = dto.id ?: return@mapNotNull null
                            HighlightItem(id = id, title = dto.title.orEmpty(), coverUrl = dto.coverImageUrl)
                        }
                    )
                }
            }
            // Highlights are a supplementary section; a fetch failure just
            // leaves the row empty rather than surfacing a profile-wide error.
        }
    }

    fun uploadAvatar(file: File) {
        viewModelScope.launch {
            _uiState.update { it.copy(isUploadingAvatar = true, saveError = null) }
            val result = withContext(ioDispatcher) { repository.uploadAvatar(file) }
            when (result) {
                is PostResult.Success -> _uiState.update { it.copy(isUploadingAvatar = false, avatarUrl = result.value.avatar) }
                is PostResult.Error -> _uiState.update { it.copy(isUploadingAvatar = false, saveError = result.message) }
            }
        }
    }

    fun uploadBanner(file: File) {
        viewModelScope.launch {
            _uiState.update { it.copy(isUploadingBanner = true, saveError = null) }
            val result = withContext(ioDispatcher) { repository.uploadBanner(file) }
            when (result) {
                is PostResult.Success -> _uiState.update { it.copy(isUploadingBanner = false, bannerUrl = result.value.banner) }
                is PostResult.Error -> _uiState.update { it.copy(isUploadingBanner = false, saveError = result.message) }
            }
        }
    }

    private fun PostDto.toProfilePostItem(): ProfilePostItem? {
        val postId = id ?: return null
        val first = media?.firstOrNull()
        val isVideo = first?.type == "video"
        val url = if (isVideo) (first?.thumbnailUrl ?: first?.url) else first?.url
        return ProfilePostItem(id = postId, caption = caption.orEmpty(), mediaUrl = url, isVideo = isVideo)
    }

    private fun loadPosts(reset: Boolean) {
        val username = _uiState.value.username
        if (username.isBlank()) {
            _uiState.update { it.copy(postsState = UiState.Empty) }
            return
        }
        viewModelScope.launch {
            if (reset) {
                postsPage = 1
                postsTotalPages = 1
                loadedPosts.clear()
                _uiState.update { it.copy(postsState = UiState.Loading) }
            }
            val result = withContext(ioDispatcher) { repository.getUserPosts(username, postsPage, PAGE_SIZE) }
            when (result) {
                is PostResult.Success -> {
                    loadedPosts += result.value.items.mapNotNull { it.toProfilePostItem() }
                    postsTotalPages = result.value.totalPages
                    _uiState.update {
                        it.copy(
                            postsState = if (loadedPosts.isEmpty()) UiState.Empty else UiState.Success(loadedPosts.toList()),
                            isLoadingMorePosts = false
                        )
                    }
                }
                is PostResult.Error -> _uiState.update {
                    it.copy(
                        postsState = if (loadedPosts.isEmpty()) UiState.Error(result.message) else it.postsState,
                        isLoadingMorePosts = false
                    )
                }
            }
        }
    }

    fun loadMorePosts() {
        if (_uiState.value.isLoadingMorePosts || postsPage >= postsTotalPages) return
        if (_uiState.value.postsState !is UiState.Success) return
        postsPage += 1
        _uiState.update { it.copy(isLoadingMorePosts = true) }
        loadPosts(reset = false)
    }

    fun followOrUnfollow() {
        val state = _uiState.value
        if (state.isSelf) return
        val userId = state.userId
        if (userId.isNullOrBlank()) {
            _uiState.update { it.copy(saveError = "User ID topilmadi") }
            return
        }
        viewModelScope.launch {
            _uiState.update { it.copy(isSaving = true, saveError = null) }
            val response = withContext(ioDispatcher) {
                runCatching {
                    if (state.followStatus == "following") authApi.unfollowUser(userId)
                    else authApi.followUser(userId)
                }
            }
            _uiState.update { it.copy(isSaving = false) }
            response.onFailure { e ->
                _uiState.update { it.copy(saveError = "Tarmoq xatosi: ${e.message}") }
                return@launch
            }
            response.onSuccess { resp ->
                if (!resp.isSuccessful) {
                    _uiState.update { it.copy(saveError = "Follow amal bajarilmadi (${resp.code()})") }
                } else {
                    refresh()
                }
            }
        }
    }

    fun updateProfile(
        fullName: String,
        username: String,
        bio: String,
        location: String,
        school: String,
        onSuccess: () -> Unit
    ) {
        viewModelScope.launch {
            _uiState.update { it.copy(isSaving = true, saveError = null) }
            val request = UpdateProfileRequest(
                fullName = fullName.trim().ifBlank { null },
                username = username.trim().removePrefix("@").ifBlank { null },
                bio = bio.trim(),
                location = location.trim(),
                school = school.trim()
            )
            val response = withContext(ioDispatcher) { runCatching { authApi.updateMyProfile(request) } }
            _uiState.update { it.copy(isSaving = false) }
            response.onFailure { e -> _uiState.update { it.copy(saveError = "Tarmoq xatosi: ${e.message}") } }
            response.onSuccess { resp ->
                if (!resp.isSuccessful) {
                    _uiState.update { it.copy(saveError = "Profile saqlanmadi (${resp.code()})") }
                } else {
                    onSuccess()
                    refresh() // re-fetch typed profile instead of parsing the response
                }
            }
        }
    }

    private companion object {
        const val PAGE_SIZE = 18
    }
}
