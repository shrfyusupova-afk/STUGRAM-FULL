package com.example.myapplication.ui.home

import com.example.myapplication.data.remote.AuthApi
import com.example.myapplication.data.remote.CreatePostRequest
import com.example.myapplication.data.remote.FullRegisterRequest
import com.example.myapplication.data.remote.GoogleLoginRequest
import com.example.myapplication.data.remote.LoginRequest
import com.example.myapplication.data.remote.OtpRequest
import com.example.myapplication.data.remote.UpdateProfileRequest
import com.example.myapplication.data.remote.VerifyOtpRequest
import com.example.myapplication.data.remote.post.AddCommentRequest
import com.example.myapplication.data.remote.post.ApiEnvelope
import com.example.myapplication.data.remote.post.CommentDto
import com.example.myapplication.data.remote.post.PaginationMeta
import com.example.myapplication.data.remote.post.PostApi
import com.example.myapplication.data.remote.post.PostDto
import com.example.myapplication.data.remote.post.PostRepository
import com.example.myapplication.data.remote.post.ProfileDto
import com.example.myapplication.data.remote.post.StoryDto
import com.example.myapplication.data.remote.post.UserPreviewDto
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
import okhttp3.MultipartBody
import okhttp3.RequestBody
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
        val vm = ProfileViewModel(
            repository = PostRepository(
                api = FakePostApi(
                    profile = ProfileDto(
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
        val vm = ProfileViewModel(
            repository = PostRepository(
                api = FakePostApi(profile = ProfileDto(id = "u1", fullName = "User", username = "user"))
            ),
            authApi = FakeAuthApi(
                updateResponse = Response.error(
                    409,
                    """{"success":false}""".toResponseBody("application/json".toMediaType())
                )
            ),
            ioDispatcher = dispatcher
        )
        advanceUntilIdle()

        vm.updateProfile("User", "user", "bio", "loc", "school") {}
        advanceUntilIdle()

        val state = vm.uiState.value
        assertFalse(state.isSaving)
        assertTrue(state.saveError?.contains("409") == true)
    }

    private class FakePostApi(
        private val profile: ProfileDto,
        private val userPosts: List<PostDto> = emptyList()
    ) : PostApi {
        override suspend fun createPost(
            idempotencyKey: String,
            media: List<MultipartBody.Part>,
            caption: RequestBody?
        ): Response<JsonObject> = Response.success(JsonObject())

        override suspend fun createStory(
            idempotencyKey: String,
            media: MultipartBody.Part,
            caption: RequestBody?
        ): Response<JsonObject> = Response.success(JsonObject())

        override suspend fun getFeed(page: Int, limit: Int): Response<ApiEnvelope<List<PostDto>>> =
            Response.success(ApiEnvelope(data = emptyList(), meta = PaginationMeta(page = 1, totalPages = 1)))

        override suspend fun getUserPosts(username: String, page: Int, limit: Int): Response<ApiEnvelope<List<PostDto>>> =
            Response.success(ApiEnvelope(data = userPosts, meta = PaginationMeta(page = 1, totalPages = 1)))

        override suspend fun getStoriesFeed(page: Int, limit: Int): Response<ApiEnvelope<List<StoryDto>>> =
            Response.success(ApiEnvelope(data = emptyList()))

        override suspend fun getCreatorSuggestions(page: Int, limit: Int): Response<ApiEnvelope<List<UserPreviewDto>>> =
            Response.success(ApiEnvelope(data = emptyList()))

        override suspend fun getMyProfile(): Response<ApiEnvelope<ProfileDto>> =
            Response.success(ApiEnvelope(data = profile))

        override suspend fun getProfileByUsername(username: String): Response<ApiEnvelope<ProfileDto>> =
            Response.success(ApiEnvelope(data = profile))

        override suspend fun likePost(postId: String): Response<Unit> = Response.success(Unit)
        override suspend fun unlikePost(postId: String): Response<Unit> = Response.success(Unit)

        override suspend fun getComments(postId: String, page: Int, limit: Int): Response<ApiEnvelope<List<CommentDto>>> =
            Response.success(ApiEnvelope(data = emptyList()))

        override suspend fun addComment(postId: String, body: AddCommentRequest): Response<ApiEnvelope<CommentDto>> =
            Response.success(ApiEnvelope(data = CommentDto()))
    }

    private class FakeAuthApi(
        private val updateResponse: Response<JsonObject> = Response.success(JsonObject())
    ) : AuthApi {
        override suspend fun sendOtp(request: OtpRequest): Response<JsonObject> = Response.success(JsonObject())
        override suspend fun verifyOtp(request: VerifyOtpRequest): Response<JsonObject> = Response.success(JsonObject())
        override suspend fun register(request: FullRegisterRequest): Response<JsonObject> = Response.success(JsonObject())
        override suspend fun login(request: LoginRequest): Response<JsonObject> = Response.success(JsonObject())
        override suspend fun googleLogin(request: GoogleLoginRequest): Response<JsonObject> = Response.success(JsonObject())
        override suspend fun getPostFeed(page: Int, limit: Int): Response<JsonObject> = Response.success(JsonObject())
        override suspend fun getStoryFeed(page: Int, limit: Int): Response<JsonObject> = Response.success(JsonObject())
        override suspend fun getMyProfile(): Response<JsonObject> = Response.success(JsonObject())
        override suspend fun updateMyProfile(request: UpdateProfileRequest): Response<JsonObject> = updateResponse
        override suspend fun getProfileByUsername(username: String): Response<JsonObject> = Response.success(JsonObject())
        override suspend fun searchUsers(query: String, page: Int, limit: Int): Response<JsonObject> = Response.success(JsonObject())
        override suspend fun getCreatorSuggestions(page: Int, limit: Int): Response<JsonObject> = Response.success(JsonObject())
        override suspend fun followUser(userId: String): Response<JsonObject> = Response.success(JsonObject())
        override suspend fun unfollowUser(userId: String): Response<JsonObject> = Response.success(JsonObject())
        override suspend fun createPost(request: CreatePostRequest): Response<JsonObject> = Response.success(JsonObject())
        override suspend fun getUserPosts(username: String, page: Int, limit: Int): Response<JsonObject> = Response.success(JsonObject())
    }
}
