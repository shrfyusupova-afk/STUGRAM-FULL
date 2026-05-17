package com.example.myapplication.ui.home

import com.example.myapplication.data.remote.AuthApi
import com.example.myapplication.data.remote.CreatePostRequest
import com.example.myapplication.data.remote.ForgotPasswordRequest
import com.example.myapplication.data.remote.FullRegisterRequest
import com.example.myapplication.data.remote.GoogleLoginRequest
import com.example.myapplication.data.remote.LoginRequest
import com.example.myapplication.data.remote.OtpRequest
import com.example.myapplication.data.remote.RefreshTokenRequest
import com.example.myapplication.data.remote.ResetPasswordRequest
import com.example.myapplication.data.remote.UpdateProfileRequest
import com.example.myapplication.data.remote.VerifyOtpRequest
import com.google.gson.JsonObject
import com.google.gson.JsonArray
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
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import retrofit2.Response

@OptIn(ExperimentalCoroutinesApi::class)
class ProfileViewModelTest {
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
    fun loadProfile_success_updatesState() = runTest {
        val api = FakeAuthApi(
            profileResponse = Response.success(
                json(
                    fullName = "Test User",
                    username = "test_user",
                    bio = "bio",
                    location = "Tashkent",
                    school = "School 1"
                )
            )
        )
        val vm = ProfileViewModel(authApi = api, ioDispatcher = dispatcher)
        advanceUntilIdle()

        val state = vm.uiState.value
        assertFalse(state.isLoading)
        assertEquals("Test User", state.fullName)
        assertEquals("test_user", state.username)
        assertEquals("bio", state.bio)
    }

    @Test
    fun updateProfile_error_setsSaveError() = runTest {
        val api = FakeAuthApi(
            profileResponse = Response.success(json(fullName = "User", username = "user")),
            updateResponse = Response.error(
                409,
                """{"success":false}""".toResponseBody("application/json".toMediaType())
            )
        )
        val vm = ProfileViewModel(authApi = api, ioDispatcher = dispatcher)
        advanceUntilIdle()

        vm.updateProfile("User", "user", "bio", "loc", "school") {}
        advanceUntilIdle()

        val state = vm.uiState.value
        assertFalse(state.isSaving)
        assertTrue(state.saveError?.contains("409") == true)
    }

    private fun json(
        fullName: String,
        username: String,
        bio: String = "",
        location: String = "",
        school: String = ""
    ): JsonObject {
        val data = JsonObject().apply {
            addProperty("fullName", fullName)
            addProperty("username", username)
            addProperty("bio", bio)
            addProperty("location", location)
            addProperty("school", school)
        }
        return JsonObject().apply { add("data", data) }
    }

    private class FakeAuthApi(
        private val profileResponse: Response<JsonObject>,
        private val updateResponse: Response<JsonObject> = Response.success(JsonObject())
    ) : AuthApi {
        override suspend fun refreshToken(request: RefreshTokenRequest): Response<JsonObject> = Response.success(JsonObject())
        override suspend fun sendOtp(request: OtpRequest): Response<JsonObject> = Response.success(JsonObject())
        override suspend fun verifyOtp(request: VerifyOtpRequest): Response<JsonObject> = Response.success(JsonObject())
        override suspend fun register(request: FullRegisterRequest): Response<JsonObject> = Response.success(JsonObject())
        override suspend fun login(request: LoginRequest): Response<JsonObject> = Response.success(JsonObject())
        override suspend fun googleLogin(request: GoogleLoginRequest): Response<JsonObject> = Response.success(JsonObject())
        override suspend fun getPostFeed(page: Int, limit: Int): Response<JsonObject> = Response.success(JsonObject())
        override suspend fun getStoryFeed(page: Int, limit: Int): Response<JsonObject> = Response.success(JsonObject())
        override suspend fun getMyProfile(): Response<JsonObject> = profileResponse
        override suspend fun updateMyProfile(request: UpdateProfileRequest): Response<JsonObject> = updateResponse
        override suspend fun getProfileByUsername(username: String): Response<JsonObject> = profileResponse
        override suspend fun searchUsers(query: String, page: Int, limit: Int): Response<JsonObject> = Response.success(JsonObject())
        override suspend fun followUser(userId: String): Response<JsonObject> = Response.success(JsonObject())
        override suspend fun unfollowUser(userId: String): Response<JsonObject> = Response.success(JsonObject())
        override suspend fun createPost(request: CreatePostRequest): Response<JsonObject> = Response.success(JsonObject())
        override suspend fun getUserPosts(username: String, page: Int, limit: Int): Response<JsonObject> =
            Response.success(JsonObject().apply { add("data", JsonArray()) })
        override suspend fun forgotPassword(request: ForgotPasswordRequest): Response<JsonObject> = Response.success(JsonObject())
        override suspend fun resetPassword(request: ResetPasswordRequest): Response<JsonObject> = Response.success(JsonObject())
    }
}
