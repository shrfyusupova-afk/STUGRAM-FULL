package com.example.myapplication.ui.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.myapplication.data.remote.AuthApi
import com.example.myapplication.data.remote.RetrofitClient
import com.example.myapplication.data.remote.UpdateProfileRequest
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
    val location: String = "",
    val school: String = "",
    val followersCount: Int = 0,
    val followingCount: Int = 0,
    val postsCount: Int = 0,
    val targetUsername: String? = null,
    val isSelf: Boolean = true,
    val followStatus: String = "self",
    val posts: List<ProfilePostItem> = emptyList()
)

data class ProfilePostItem(
    val id: String,
    val caption: String,
    val mediaUrl: String?
)

class ProfileViewModel(
    private val authApi: AuthApi = RetrofitClient.instance,
    private val ioDispatcher: CoroutineDispatcher = Dispatchers.IO
) : ViewModel() {
    private val _uiState = MutableStateFlow(AlphaProfileUiState())
    val uiState: StateFlow<AlphaProfileUiState> = _uiState.asStateFlow()

    init {
        refresh()
    }

    fun setProfileTarget(username: String?) {
        _uiState.update {
            it.copy(targetUsername = username?.trim()?.ifBlank { null })
        }
        refresh()
    }

    fun refresh() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }
            try {
                val target = _uiState.value.targetUsername
                val response = withContext(ioDispatcher) {
                    if (target.isNullOrBlank()) authApi.getMyProfile() else authApi.getProfileByUsername(target)
                }
                if (!response.isSuccessful) {
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            error = "Profile yuklanmadi (${response.code()})"
                        )
                    }
                    return@launch
                }

                val data = response.body()?.getAsJsonObject("data")
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        fullName = data?.get("fullName")?.asString.orEmpty(),
                        username = data?.get("username")?.asString.orEmpty(),
                        bio = data?.get("bio")?.asString.orEmpty(),
                        location = data?.get("location")?.asString.orEmpty(),
                        school = data?.get("school")?.asString.orEmpty(),
                        followersCount = data?.get("followersCount")?.asInt ?: 0,
                        followingCount = data?.get("followingCount")?.asInt ?: 0,
                        postsCount = data?.get("postsCount")?.asInt ?: 0,
                        isSelf = data?.get("followStatus")?.asString == "self",
                        followStatus = data?.get("followStatus")?.asString ?: if (target.isNullOrBlank()) "self" else "not_following",
                        error = null,
                        saveError = null,
                        posts = emptyList()
                    )
                }
                loadProfilePosts()
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        error = "Tarmoq xatosi: ${e.message}"
                    )
                }
            }
        }
    }

    private suspend fun fetchPostsFor(username: String): List<ProfilePostItem> {
        val response = withContext(ioDispatcher) { authApi.getUserPosts(username = username, page = 1, limit = 20) }
        if (!response.isSuccessful) return emptyList()
        val array = response.body()?.getAsJsonArray("data") ?: return emptyList()
        return array.mapNotNull { element ->
            runCatching {
                val obj = element.asJsonObject
                val mediaArray = if (obj.has("media") && obj.get("media").isJsonArray) obj.getAsJsonArray("media") else null
                val mediaUrl = mediaArray?.firstOrNull()?.asJsonObject?.get("url")?.asString
                ProfilePostItem(
                    id = obj.get("_id")?.asString ?: return@runCatching null,
                    caption = obj.get("caption")?.asString.orEmpty(),
                    mediaUrl = mediaUrl
                )
            }.getOrNull()
        }
    }

    private fun loadProfilePosts() {
        val username = _uiState.value.username
        if (username.isBlank()) return
        viewModelScope.launch {
            val items = fetchPostsFor(username)
            _uiState.update { it.copy(posts = items) }
        }
    }

    fun followOrUnfollow() {
        val state = _uiState.value
        val target = state.targetUsername ?: return
        if (state.isSelf) return

        viewModelScope.launch {
            _uiState.update { it.copy(isSaving = true, saveError = null) }
            try {
                val profileResponse = withContext(ioDispatcher) { authApi.getProfileByUsername(target) }
                if (!profileResponse.isSuccessful) {
                    _uiState.update { it.copy(isSaving = false, saveError = "Follow holati aniqlanmadi (${profileResponse.code()})") }
                    return@launch
                }
                val userId = profileResponse.body()?.getAsJsonObject("data")?.get("_id")?.asString
                if (userId.isNullOrBlank()) {
                    _uiState.update { it.copy(isSaving = false, saveError = "User ID topilmadi") }
                    return@launch
                }

                val response = withContext(ioDispatcher) {
                    if (state.followStatus == "following") authApi.unfollowUser(userId) else authApi.followUser(userId)
                }
                if (!response.isSuccessful) {
                    _uiState.update { it.copy(isSaving = false, saveError = "Follow amal bajarilmadi (${response.code()})") }
                    return@launch
                }
                _uiState.update { it.copy(isSaving = false) }
                refresh()
            } catch (e: Exception) {
                _uiState.update { it.copy(isSaving = false, saveError = "Tarmoq xatosi: ${e.message}") }
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
            try {
                val request = UpdateProfileRequest(
                    fullName = fullName.trim().ifBlank { null },
                    username = username.trim().removePrefix("@").ifBlank { null },
                    bio = bio.trim(),
                    location = location.trim(),
                    school = school.trim()
                )
                val response = withContext(ioDispatcher) { authApi.updateMyProfile(request) }
                if (!response.isSuccessful) {
                    _uiState.update {
                        it.copy(isSaving = false, saveError = "Profile saqlanmadi (${response.code()})")
                    }
                    return@launch
                }

                val data = response.body()?.getAsJsonObject("data")
                _uiState.update {
                    it.copy(
                        isSaving = false,
                        saveError = null,
                        fullName = data?.get("fullName")?.asString.orEmpty(),
                        username = data?.get("username")?.asString.orEmpty(),
                        bio = data?.get("bio")?.asString.orEmpty(),
                        location = data?.get("location")?.asString.orEmpty(),
                        school = data?.get("school")?.asString.orEmpty()
                    )
                }
                onSuccess()
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(isSaving = false, saveError = "Tarmoq xatosi: ${e.message}")
                }
            }
        }
    }
}
