package com.example.myapplication.ui.home

import com.example.myapplication.data.remote.AuthApi
import com.example.myapplication.data.remote.CreatePostRequest
import com.example.myapplication.data.remote.FullRegisterRequest
import com.example.myapplication.data.remote.GoogleLoginRequest
import com.example.myapplication.data.remote.LoginRequest
import com.example.myapplication.data.remote.OtpRequest
import com.example.myapplication.data.remote.RefreshTokenRequest
import com.example.myapplication.data.remote.UpdateProfileRequest
import com.example.myapplication.data.remote.VerifyOtpRequest
import com.google.gson.JsonArray
import com.google.gson.JsonObject
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
import org.junit.Assert.assertFalse
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
    fun feedEmpty_keepsRealEmptyStateWithoutFakePosts() = runTest {
        val vm = HomeViewModel(
            authApi = FakeAuthApi(
                feedResponse = Response.success(JsonObject().apply { add("data", JsonArray()) })
            ),
            ioDispatcher = dispatcher
        )
        advanceUntilIdle()
        assertTrue(vm.posts.isEmpty())
    }

    @Test
    fun createTextPost_blankCaption_setsValidationError() = runTest {
        val vm = HomeViewModel(authApi = FakeAuthApi(), ioDispatcher = dispatcher)
        vm.createTextPost("   ")
        assertEquals("Caption is required", vm.createPostError)
        assertFalse(vm.isCreatingPost)
    }

    private class FakeAuthApi(
        private val feedResponse: Response<JsonObject> = Response.success(JsonObject().apply { add("data", JsonArray()) })
    ) : AuthApi {
        override suspend fun refreshToken(request: RefreshTokenRequest): Response<JsonObject> = Response.success(JsonObject())
        override suspend fun sendOtp(request: OtpRequest): Response<JsonObject> = Response.success(JsonObject())
        override suspend fun verifyOtp(request: VerifyOtpRequest): Response<JsonObject> = Response.success(JsonObject())
        override suspend fun register(request: FullRegisterRequest): Response<JsonObject> = Response.success(JsonObject())
        override suspend fun login(request: LoginRequest): Response<JsonObject> = Response.success(JsonObject())
        override suspend fun googleLogin(request: GoogleLoginRequest): Response<JsonObject> = Response.success(JsonObject())
        override suspend fun getPostFeed(page: Int, limit: Int): Response<JsonObject> = feedResponse
        override suspend fun getStoryFeed(page: Int, limit: Int): Response<JsonObject> = Response.success(JsonObject().apply { add("data", JsonArray()) })
        override suspend fun getMyProfile(): Response<JsonObject> = Response.success(JsonObject())
        override suspend fun updateMyProfile(request: UpdateProfileRequest): Response<JsonObject> = Response.success(JsonObject())
        override suspend fun getProfileByUsername(username: String): Response<JsonObject> = Response.success(JsonObject())
        override suspend fun searchUsers(query: String, page: Int, limit: Int): Response<JsonObject> = Response.success(JsonObject())
        override suspend fun followUser(userId: String): Response<JsonObject> = Response.success(JsonObject())
        override suspend fun unfollowUser(userId: String): Response<JsonObject> = Response.success(JsonObject())
        override suspend fun createPost(request: CreatePostRequest): Response<JsonObject> = Response.success(JsonObject())
        override suspend fun getUserPosts(username: String, page: Int, limit: Int): Response<JsonObject> = Response.success(JsonObject().apply { add("data", JsonArray()) })
    }
}

