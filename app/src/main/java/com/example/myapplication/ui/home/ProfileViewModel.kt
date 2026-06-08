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
    val userId: String = "",
    val fullName: String = "",
    val username: String = "",
    val bio: String = "",
    val avatar: String? = null,
    val banner: String? = null,
    val location: String = "",
    val school: String = "",
    val region: String = "",
    val district: String = "",
    val grade: String = "",
    val group: String = "",
    val birthday: String? = null,
    val type: String = "student",
    val isPrivateAccount: Boolean = false,
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
    val mediaUrl: String?,
    val type: String = "post"  // "post" or "reel"
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
                        it.copy(isLoading = false, error = "Profile yuklanmadi (${response.code()})")
                    }
                    return@launch
                }

                val data = response.body()?.getAsJsonObject("data")
                val followStatus = data?.get("followStatus")?.asString
                    ?: if (target.isNullOrBlank()) "self" else "not_following"

                _uiState.update {
                    it.copy(
                        isLoading = false,
                        userId = data?.get("_id")?.asString.orEmpty(),
                        fullName = data?.get("fullName")?.asString.orEmpty(),
                        username = data?.get("username")?.asString.orEmpty(),
                        bio = data?.get("bio")?.asString.orEmpty(),
                        avatar = data?.get("avatar")?.let { el -> if (el.isJsonNull) null else el.asString },
                        banner = data?.get("banner")?.let { el -> if (el.isJsonNull) null else el.asString },
                        location = data?.get("location")?.asString.orEmpty(),
                        school = data?.get("school")?.asString.orEmpty(),
                        region = data?.get("region")?.asString.orEmpty(),
                        district = data?.get("district")?.asString.orEmpty(),
                        grade = data?.get("grade")?.asString.orEmpty(),
                        group = data?.get("group")?.asString.orEmpty(),
                        birthday = data?.get("birthday")?.let { el -> if (el.isJsonNull) null else el.asString },
                        type = data?.get("type")?.asString.orEmpty(),
                        isPrivateAccount = data?.get("isPrivateAccount")?.asBoolean ?: false,
                        followersCount = data?.get("followersCount")?.asInt ?: 0,
                        followingCount = data?.get("followingCount")?.asInt ?: 0,
                        postsCount = data?.get("postsCount")?.asInt ?: 0,
                        isSelf = followStatus == "self",
                        followStatus = followStatus,
                        error = null,
                        saveError = null,
                        posts = emptyList()
                    )
                }
                loadProfilePosts()
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(isLoading = false, error = "Tarmoq xatosi: ${e.message}")
                }
            }
        }
    }

    private suspend fun fetchPostsFor(username: String): List<ProfilePostItem> {
        val response = withContext(ioDispatcher) {
            authApi.getUserPosts(username = username, page = 1, limit = 50)
        }
        if (!response.isSuccessful) return emptyList()
        val array = response.body()?.getAsJsonArray("data") ?: return emptyList()
        return array.mapNotNull { element ->
            runCatching {
                val obj = element.asJsonObject
                val mediaArray = if (obj.has("media") && obj.get("media").isJsonArray)
                    obj.getAsJsonArray("media") else null
                val firstMedia = mediaArray?.firstOrNull()?.asJsonObject
                val mediaUrl = firstMedia?.get("url")?.asString
                val mediaType = firstMedia?.get("type")?.asString ?: "image"
                ProfilePostItem(
                    id = obj.get("_id")?.asString ?: return@runCatching null,
                    caption = obj.get("caption")?.asString.orEmpty(),
                    mediaUrl = mediaUrl,
                    type = if (mediaType == "video") "reel" else "post"
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
        if (state.isSelf) return
        val userId = state.userId.ifBlank { return }

        // Optimistic UI update first, then call API
        val nowFollowing = state.followStatus != "following"
        _uiState.update {
            it.copy(
                isSaving = true,
                saveError = null,
                followStatus = if (nowFollowing) "following" else "not_following",
                followersCount = if (nowFollowing) it.followersCount + 1 else (it.followersCount - 1).coerceAtLeast(0)
            )
        }

        viewModelScope.launch {
            try {
                val response = withContext(ioDispatcher) {
                    if (nowFollowing) authApi.followUser(userId)
                    else authApi.unfollowUser(userId)
                }
                if (!response.isSuccessful) {
                    // Revert optimistic update on failure
                    _uiState.update {
                        it.copy(
                            isSaving = false,
                            saveError = "Amal bajarilmadi (${response.code()})",
                            followStatus = if (nowFollowing) "not_following" else "following",
                            followersCount = if (nowFollowing) it.followersCount - 1 else it.followersCount + 1
                        )
                    }
                    return@launch
                }
                _uiState.update { it.copy(isSaving = false) }
            } catch (e: Exception) {
                // Revert on network error
                _uiState.update {
                    it.copy(
                        isSaving = false,
                        saveError = "Tarmoq xatosi: ${e.message}",
                        followStatus = if (nowFollowing) "not_following" else "following",
                        followersCount = if (nowFollowing) it.followersCount - 1 else it.followersCount + 1
                    )
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
