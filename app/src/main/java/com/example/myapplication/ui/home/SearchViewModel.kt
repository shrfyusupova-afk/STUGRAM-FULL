package com.example.myapplication.ui.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.myapplication.core.ui.UiState
import com.example.myapplication.data.remote.AuthApi
import com.example.myapplication.data.remote.RetrofitClient
import com.example.myapplication.data.remote.post.PostRepository
import com.example.myapplication.data.remote.post.PostResult
import com.example.myapplication.data.remote.post.SearchUserDto
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
    val avatar: String,
    val bio: String,
    val followStatus: String
)

data class SearchUiState(
    val query: String = "",
    // Empty query -> discovery (explore/creators); >=2 chars -> server search.
    val searchState: UiState<List<SearchUserItem>> = UiState.Empty,
    val discoverState: UiState<List<SearchUserItem>> = UiState.Loading,
    val followActionUserId: String? = null,
    val followError: String? = null
)

class SearchViewModel(
    private val repository: PostRepository = PostRepository(),
    private val authApi: AuthApi = RetrofitClient.instance,
    private val ioDispatcher: CoroutineDispatcher = Dispatchers.IO
) : ViewModel() {
    private val _uiState = MutableStateFlow(SearchUiState())
    val uiState: StateFlow<SearchUiState> = _uiState.asStateFlow()

    init {
        loadDiscover()
    }

    fun onQueryChange(value: String) {
        _uiState.update { it.copy(query = value, followError = null) }
        if (value.trim().length < 2) {
            _uiState.update { it.copy(searchState = UiState.Empty) }
        }
    }

    fun loadDiscover() {
        viewModelScope.launch {
            _uiState.update { it.copy(discoverState = UiState.Loading) }
            val result = withContext(ioDispatcher) { repository.getCreatorSuggestions(page = 1, limit = 20) }
            when (result) {
                is PostResult.Success -> {
                    val items = result.value.mapNotNull { user ->
                        val username = user.username ?: return@mapNotNull null
                        SearchUserItem(
                            id = user.id.orEmpty(),
                            username = username,
                            fullName = user.fullName.orEmpty(),
                            avatar = user.avatar.orEmpty(),
                            bio = "",
                            followStatus = "not_following"
                        )
                    }
                    _uiState.update {
                        it.copy(discoverState = if (items.isEmpty()) UiState.Empty else UiState.Success(items))
                    }
                }
                is PostResult.Error -> _uiState.update { it.copy(discoverState = UiState.Error(result.message)) }
            }
        }
    }

    fun search() {
        val query = _uiState.value.query.trim()
        if (query.length < 2) return

        viewModelScope.launch {
            _uiState.update { it.copy(searchState = UiState.Loading) }
            val result = withContext(ioDispatcher) { repository.searchUsers(query = query, page = 1, limit = 20) }
            when (result) {
                is PostResult.Success -> {
                    val items = result.value.mapNotNull { it.toItemOrNull() }
                    _uiState.update {
                        it.copy(searchState = if (items.isEmpty()) UiState.Empty else UiState.Success(items))
                    }
                }
                is PostResult.Error -> _uiState.update { it.copy(searchState = UiState.Error(result.message)) }
            }
        }
    }

    private fun SearchUserDto.toItemOrNull(): SearchUserItem? {
        val name = username ?: return null
        return SearchUserItem(
            id = id.orEmpty(),
            username = name,
            fullName = fullName.orEmpty(),
            avatar = avatar.orEmpty(),
            bio = bio.orEmpty(),
            followStatus = followStatus ?: "not_following"
        )
    }

    fun followOrUnfollow(user: SearchUserItem) {
        if (user.id.isBlank()) return
        viewModelScope.launch {
            _uiState.update { it.copy(followActionUserId = user.id, followError = null) }
            val response = withContext(ioDispatcher) {
                runCatching {
                    if (user.followStatus == "following") authApi.unfollowUser(user.id) else authApi.followUser(user.id)
                }
            }
            response.onFailure { e ->
                _uiState.update { it.copy(followActionUserId = null, followError = "Tarmoq xatosi: ${e.message}") }
                return@launch
            }
            response.onSuccess { resp ->
                if (!resp.isSuccessful) {
                    _uiState.update { it.copy(followActionUserId = null, followError = "Follow amal bajarilmadi (${resp.code()})") }
                    return@launch
                }
                val toggle = { item: SearchUserItem ->
                    if (item.id != user.id) item
                    else item.copy(followStatus = if (item.followStatus == "following") "not_following" else "following")
                }
                _uiState.update { state ->
                    state.copy(
                        followActionUserId = null,
                        searchState = state.searchState.mapItems(toggle),
                        discoverState = state.discoverState.mapItems(toggle)
                    )
                }
            }
        }
    }

    private fun UiState<List<SearchUserItem>>.mapItems(
        transform: (SearchUserItem) -> SearchUserItem
    ): UiState<List<SearchUserItem>> =
        if (this is UiState.Success) UiState.Success(data.map(transform)) else this
}
