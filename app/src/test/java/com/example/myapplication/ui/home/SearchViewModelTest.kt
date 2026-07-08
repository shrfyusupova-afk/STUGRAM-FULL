package com.example.myapplication.ui.home

import com.example.myapplication.core.ui.UiState
import com.example.myapplication.data.remote.post.ApiEnvelope
import com.example.myapplication.data.remote.post.PostRepository
import com.example.myapplication.data.remote.post.SearchUserDto
import com.example.myapplication.testutil.FakeAuthApi
import com.example.myapplication.testutil.FakePostApi
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.TestDispatcher
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import retrofit2.Response

@OptIn(ExperimentalCoroutinesApi::class)
class SearchViewModelTest {
    private lateinit var dispatcher: TestDispatcher

    @Before
    fun setUp() {
        dispatcher = UnconfinedTestDispatcher()
        Dispatchers.setMain(dispatcher)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun searchSuccess_returnsRealUsers() = runTest {
        val api = object : FakePostApi() {
            override suspend fun searchUsers(
                query: String,
                page: Int,
                limit: Int
            ): Response<ApiEnvelope<List<SearchUserDto>>> = Response.success(
                ApiEnvelope(
                    data = listOf(
                        SearchUserDto(id = "u1", username = "ali", fullName = "Ali", bio = "bio", followStatus = "not_following")
                    )
                )
            )
        }
        val vm = SearchViewModel(
            repository = PostRepository(api = api),
            authApi = FakeAuthApi(),
            ioDispatcher = dispatcher
        )

        vm.onQueryChange("ali")
        vm.search()
        advanceUntilIdle()

        val state = vm.uiState.value.searchState
        assertTrue(state is UiState.Success)
        assertEquals("ali", (state as UiState.Success).data.first().username)
    }

    @Test
    fun searchError_setsErrorState() = runTest {
        val api = object : FakePostApi() {
            override suspend fun searchUsers(
                query: String,
                page: Int,
                limit: Int
            ): Response<ApiEnvelope<List<SearchUserDto>>> =
                Response.error(500, "{}".toResponseBody("application/json".toMediaType()))
        }
        val vm = SearchViewModel(
            repository = PostRepository(api = api),
            authApi = FakeAuthApi(),
            ioDispatcher = dispatcher
        )

        vm.onQueryChange("ali")
        vm.search()
        advanceUntilIdle()

        assertTrue(vm.uiState.value.searchState is UiState.Error)
    }
}
