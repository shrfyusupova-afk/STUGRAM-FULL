package com.example.myapplication.ui.home

import com.example.myapplication.data.remote.UpdateProfileRequest
import com.example.myapplication.data.remote.post.ApiEnvelope
import com.example.myapplication.data.remote.post.PostRepository
import com.example.myapplication.data.remote.post.ProfileDto
import com.example.myapplication.testutil.FakeAuthApi
import com.example.myapplication.testutil.FakePostApi
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

    private fun profileApi(profile: ProfileDto) = object : FakePostApi() {
        override suspend fun getMyProfile(): Response<ApiEnvelope<ProfileDto>> =
            Response.success(ApiEnvelope(data = profile))

        override suspend fun getProfileByUsername(username: String): Response<ApiEnvelope<ProfileDto>> =
            Response.success(ApiEnvelope(data = profile))
    }

    @Test
    fun loadProfile_success_updatesState() = runTest {
        val vm = ProfileViewModel(
            repository = PostRepository(
                api = profileApi(
                    ProfileDto(
                        id = "u1",
                        fullName = "Test User",
                        username = "test_user",
                        bio = "bio",
                        location = "Tashkent",
                        school = "School 1",
                        postsCount = 0
                    )
                )
            ),
            authApi = FakeAuthApi(),
            ioDispatcher = dispatcher
        )
        advanceUntilIdle()

        val state = vm.uiState.value
        assertFalse(state.isLoading)
        assertEquals("Test User", state.fullName)
        assertEquals("test_user", state.username)
        assertEquals("bio", state.bio)
    }

    @Test
    fun updateProfile_error_setsSaveError() = runTest {
        val failingAuthApi = object : FakeAuthApi() {
            override suspend fun updateMyProfile(request: UpdateProfileRequest): Response<JsonObject> =
                Response.error(409, """{"success":false}""".toResponseBody("application/json".toMediaType()))
        }
        val vm = ProfileViewModel(
            repository = PostRepository(api = profileApi(ProfileDto(id = "u1", fullName = "User", username = "user"))),
            authApi = failingAuthApi,
            ioDispatcher = dispatcher
        )
        advanceUntilIdle()

        vm.updateProfile("User", "user", "bio", "loc", "school") {}
        advanceUntilIdle()

        val state = vm.uiState.value
        assertFalse(state.isSaving)
        assertTrue(state.saveError?.contains("409") == true)
    }
}
