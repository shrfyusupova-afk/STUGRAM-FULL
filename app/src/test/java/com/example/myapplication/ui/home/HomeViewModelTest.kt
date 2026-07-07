package com.example.myapplication.ui.home

import com.example.myapplication.core.ui.UiState
import com.example.myapplication.data.remote.post.ApiEnvelope
import com.example.myapplication.data.remote.post.PaginationMeta
import com.example.myapplication.data.remote.post.PostDto
import com.example.myapplication.data.remote.post.PostRepository
import com.example.myapplication.data.remote.post.UserPreviewDto
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
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import retrofit2.Response

@OptIn(ExperimentalCoroutinesApi::class)
class HomeViewModelTest {
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
    fun feedEmpty_showsEmptyState() = runTest {
        val vm = HomeViewModel(
            repository = PostRepository(api = FakePostApi()),
            authApi = FakeAuthApi(),
            ioDispatcher = dispatcher
        )
        advanceUntilIdle()
        assertTrue(vm.feedState is UiState.Empty)
    }

    @Test
    fun feedWithPosts_showsSuccessWithMappedData() = runTest {
        val api = object : FakePostApi() {
            override suspend fun getFeed(page: Int, limit: Int): Response<ApiEnvelope<List<PostDto>>> =
                Response.success(
                    ApiEnvelope(
                        data = listOf(PostDto(id = "1", author = UserPreviewDto(username = "ali"), caption = "salom")),
                        meta = PaginationMeta(page = 1, totalPages = 1)
                    )
                )
        }
        val vm = HomeViewModel(
            repository = PostRepository(api = api),
            authApi = FakeAuthApi(),
            ioDispatcher = dispatcher
        )
        advanceUntilIdle()
        val state = vm.feedState
        assertTrue(state is UiState.Success)
        assertEquals(1, (state as UiState.Success).data.size)
        assertEquals("salom", state.data.first().caption)
    }
}
