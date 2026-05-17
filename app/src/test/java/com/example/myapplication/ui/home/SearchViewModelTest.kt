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
        val api = FakeAuthApi(searchResponse = Response.success(usersPayload("u1", "ali", "Ali")))
        val vm = SearchViewModel(authApi = api, ioDispatcher = dispatcher)

        vm.onQueryChange("ali")
        vm.search()
        advanceUntilIdle()

        assertEquals(1, vm.uiState.value.users.size)
        assertEquals("ali", vm.uiState.value.users.first().username)
    }

    @Test
    fun searchError_setsErrorState() = runTest {
        val api = FakeAuthApi(
            searchResponse = Response.error(500, "{}".toResponseBody("application/json".toMediaType()))
        )
        val vm = SearchViewModel(authApi = api, ioDispatcher = dispatcher)

        vm.onQueryChange("ali")
        vm.search()
        advanceUntilIdle()

        assertTrue(vm.uiState.value.error?.contains("500") == true)
    }

    private fun usersPayload(id: String, username: String, fullName: String): JsonObject {
        val user = JsonObject().apply {
            addProperty("_id", id)
            addProperty("username", username)
            addProperty("fullName", fullName)
            addProperty("bio", "bio")
            addProperty("followStatus", "not_following")
        }
        val data = JsonArray().apply { add(user) }
        return JsonObject().apply { add("data", data) }
    }

    private class FakeAuthApi(
        private val searchResponse: Response<JsonObject>
    ) : AuthApi {
        override suspend fun refreshToken(request: RefreshTokenRequest): Response<JsonObject> = Response.success(JsonObject())
        override suspend fun sendOtp(request: OtpRequest): Response<JsonObject> = Response.success(JsonObject())
        override suspend fun verifyOtp(request: VerifyOtpRequest): Response<JsonObject> = Response.success(JsonObject())
        override suspend fun register(request: FullRegisterRequest): Response<JsonObject> = Response.success(JsonObject())
        override suspend fun login(request: LoginRequest): Response<JsonObject> = Response.success(JsonObject())
        override suspend fun googleLogin(request: GoogleLoginRequest): Response<JsonObject> = Response.success(JsonObject())
        override suspend fun getPostFeed(page: Int, limit: Int): Response<JsonObject> = Response.success(JsonObject())
        override suspend fun getStoryFeed(page: Int, limit: Int): Response<JsonObject> = Response.success(JsonObject())
        override suspend fun getMyProfile(): Response<JsonObject> = Response.success(JsonObject())
        override suspend fun updateMyProfile(request: UpdateProfileRequest): Response<JsonObject> = Response.success(JsonObject())
        override suspend fun getProfileByUsername(username: String): Response<JsonObject> = Response.success(JsonObject())
        override suspend fun searchUsers(query: String, page: Int, limit: Int): Response<JsonObject> = searchResponse
        override suspend fun followUser(userId: String): Response<JsonObject> = Response.success(JsonObject())
        override suspend fun unfollowUser(userId: String): Response<JsonObject> = Response.success(JsonObject())
        override suspend fun createPost(request: CreatePostRequest): Response<JsonObject> = Response.success(JsonObject())
        override suspend fun getUserPosts(username: String, page: Int, limit: Int): Response<JsonObject> =
            Response.success(JsonObject().apply { add("data", JsonArray()) })
        override suspend fun forgotPassword(request: ForgotPasswordRequest): Response<JsonObject> = Response.success(JsonObject())
        override suspend fun resetPassword(request: ResetPasswordRequest): Response<JsonObject> = Response.success(JsonObject())
    }
}
