package com.example.myapplication.ui.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.myapplication.data.remote.AuthApi
import com.example.myapplication.data.remote.RetrofitClient
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

data class SearchUserItem(
    val id: String,
    val username: String,
    val fullName: String,
    val bio: String,
    val region: String,
    val district: String,
    val school: String,
    val followStatus: String
)

data class SearchUiState(
    val query: String = "",
    val isLoading: Boolean = false,
    val error: String? = null,
    val users: List<SearchUserItem> = emptyList(),
    val followActionUserId: String? = null,
    // filter panel
    val showFilterPanel: Boolean = false,
    val selectedRegion: String? = null,
    val selectedDistrict: String? = null,
    val schoolInput: String = "",
    val isFilterActive: Boolean = false
)

class SearchViewModel(
    private val authApi: AuthApi = RetrofitClient.instance,
    private val ioDispatcher: CoroutineDispatcher = Dispatchers.IO
) : ViewModel() {

    private val _uiState = MutableStateFlow(SearchUiState())
    val uiState: StateFlow<SearchUiState> = _uiState.asStateFlow()

    fun onQueryChange(value: String) {
        _uiState.update { it.copy(query = value, error = null) }
    }

    fun toggleFilterPanel() {
        _uiState.update { it.copy(showFilterPanel = !it.showFilterPanel) }
    }

    fun onRegionChange(region: String?) {
        _uiState.update { it.copy(selectedRegion = region, selectedDistrict = null, schoolInput = "") }
    }

    fun onDistrictChange(district: String?) {
        _uiState.update { it.copy(selectedDistrict = district, schoolInput = "") }
    }

    fun onSchoolInputChange(school: String) {
        _uiState.update { it.copy(schoolInput = school) }
    }

    fun applyFilter() {
        val state = _uiState.value
        val hasFilter = state.selectedRegion != null ||
                state.selectedDistrict != null ||
                state.schoolInput.trim().isNotBlank()
        _uiState.update { it.copy(showFilterPanel = false, isFilterActive = hasFilter) }
        if (hasFilter || state.query.trim().length >= 2) {
            searchAdvanced()
        }
    }

    fun clearFilter() {
        _uiState.update {
            it.copy(
                selectedRegion = null,
                selectedDistrict = null,
                schoolInput = "",
                isFilterActive = false,
                users = emptyList(),
                error = null
            )
        }
    }

    fun search() {
        val state = _uiState.value
        if (state.isFilterActive) {
            searchAdvanced()
            return
        }
        val query = state.query.trim()
        if (query.length < 2) {
            _uiState.update { it.copy(users = emptyList(), isLoading = false, error = null) }
            return
        }
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }
            try {
                val response = withContext(ioDispatcher) {
                    authApi.searchUsers(query = query, page = 1, limit = 20)
                }
                if (!response.isSuccessful) {
                    _uiState.update { it.copy(isLoading = false, error = "Qidiruv amalga oshmadi (${response.code()})") }
                    return@launch
                }
                _uiState.update { it.copy(isLoading = false, users = parseUsers(response.body()), error = null) }
            } catch (e: Exception) {
                _uiState.update { it.copy(isLoading = false, error = "Tarmoq xatosi: ${e.message}") }
            }
        }
    }

    fun searchAdvanced() {
        val state = _uiState.value
        val query = state.query.trim().ifBlank { null }
        val region = state.selectedRegion
        val district = state.selectedDistrict
        val school = state.schoolInput.trim().ifBlank { null }

        if (query == null && region == null && district == null && school == null) {
            _uiState.update { it.copy(users = emptyList(), isLoading = false, error = null) }
            return
        }

        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }
            try {
                val response = withContext(ioDispatcher) {
                    authApi.searchUsersAdvanced(
                        query = query,
                        region = region,
                        district = district,
                        school = school,
                        page = 1,
                        limit = 30
                    )
                }
                if (!response.isSuccessful) {
                    _uiState.update { it.copy(isLoading = false, error = "Qidiruv amalga oshmadi (${response.code()})") }
                    return@launch
                }
                _uiState.update { it.copy(isLoading = false, users = parseUsers(response.body()), error = null) }
            } catch (e: Exception) {
                _uiState.update { it.copy(isLoading = false, error = "Tarmoq xatosi: ${e.message}") }
            }
        }
    }

    private fun parseUsers(body: com.google.gson.JsonObject?): List<SearchUserItem> {
        val items = body?.getAsJsonArray("data") ?: return emptyList()
        return buildList {
            items.forEach { el ->
                val obj = el.asJsonObject
                add(
                    SearchUserItem(
                        id = obj.get("_id")?.asString.orEmpty(),
                        username = obj.get("username")?.asString.orEmpty(),
                        fullName = obj.get("fullName")?.asString.orEmpty(),
                        bio = obj.get("bio")?.asString.orEmpty(),
                        region = obj.get("region")?.asString.orEmpty(),
                        district = obj.get("district")?.asString.orEmpty(),
                        school = obj.get("school")?.asString.orEmpty(),
                        followStatus = obj.get("followStatus")?.asString ?: "not_following"
                    )
                )
            }
        }
    }

    fun followOrUnfollow(user: SearchUserItem) {
        if (user.id.isBlank()) return
        viewModelScope.launch {
            _uiState.update { it.copy(followActionUserId = user.id, error = null) }
            try {
                val response = withContext(ioDispatcher) {
                    if (user.followStatus == "following") authApi.unfollowUser(user.id)
                    else authApi.followUser(user.id)
                }
                if (!response.isSuccessful) {
                    _uiState.update { it.copy(followActionUserId = null, error = "Amal amalga oshmadi (${response.code()})") }
                    return@launch
                }
                _uiState.update { state ->
                    state.copy(
                        followActionUserId = null,
                        users = state.users.map {
                            if (it.id != user.id) it
                            else it.copy(followStatus = if (it.followStatus == "following") "not_following" else "following")
                        }
                    )
                }
            } catch (e: Exception) {
                _uiState.update { it.copy(followActionUserId = null, error = "Tarmoq xatosi: ${e.message}") }
            }
        }
    }
}
