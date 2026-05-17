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
    val followStatus: String
)

data class SearchUiState(
    val query: String = "",
    val isLoading: Boolean = false,
    val error: String? = null,
    val users: List<SearchUserItem> = emptyList(),
    val followActionUserId: String? = null
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

    fun search() {
        val query = _uiState.value.query.trim()
        if (query.length < 2) {
            _uiState.update { it.copy(users = emptyList(), isLoading = false, error = null) }
            return
        }

        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }
            try {
                val response = withContext(ioDispatcher) { authApi.searchUsers(query = query, page = 1, limit = 20) }
                if (!response.isSuccessful) {
                    _uiState.update { it.copy(isLoading = false, error = "Search failed (${response.code()})") }
                    return@launch
                }

                val items = response.body()?.getAsJsonArray("data")
                val mapped = buildList {
                    items?.forEach { el ->
                        val obj = el.asJsonObject
                        add(
                            SearchUserItem(
                                id = obj.get("_id")?.asString.orEmpty(),
                                username = obj.get("username")?.asString.orEmpty(),
                                fullName = obj.get("fullName")?.asString.orEmpty(),
                                bio = obj.get("bio")?.asString.orEmpty(),
                                followStatus = obj.get("followStatus")?.asString ?: "not_following"
                            )
                        )
                    }
                }
                _uiState.update { it.copy(isLoading = false, users = mapped, error = null) }
            } catch (e: Exception) {
                _uiState.update { it.copy(isLoading = false, error = "Network error: ${e.message}") }
            }
        }
    }

    fun followOrUnfollow(user: SearchUserItem) {
        if (user.id.isBlank()) return
        viewModelScope.launch {
            _uiState.update { it.copy(followActionUserId = user.id, error = null) }
            try {
                val response = withContext(ioDispatcher) {
                    if (user.followStatus == "following") authApi.unfollowUser(user.id) else authApi.followUser(user.id)
                }
                if (!response.isSuccessful) {
                    _uiState.update { it.copy(followActionUserId = null, error = "Follow action failed (${response.code()})") }
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
                _uiState.update { it.copy(followActionUserId = null, error = "Network error: ${e.message}") }
            }
        }
    }
}
