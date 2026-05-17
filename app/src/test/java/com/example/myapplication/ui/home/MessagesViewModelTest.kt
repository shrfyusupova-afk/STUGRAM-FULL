package com.example.myapplication.ui.home

import com.example.myapplication.data.remote.chat.ApiEnvelope
import com.example.myapplication.data.remote.chat.ChatApi
import com.example.myapplication.data.remote.chat.ChatEventsDataDto
import com.example.myapplication.data.remote.chat.ChatUserDto
import com.example.myapplication.data.remote.chat.ConversationDto
import com.example.myapplication.data.remote.chat.CreateConversationRequest
import com.example.myapplication.data.remote.chat.MessageDto
import com.example.myapplication.data.remote.chat.SendMessageRequest
import com.example.myapplication.data.remote.requests.AddToChatData
import com.example.myapplication.data.remote.requests.RequestDto
import com.example.myapplication.data.remote.requests.RequestFromUserDto
import com.example.myapplication.data.remote.requests.RequestsApi
import com.example.myapplication.data.remote.requests.RequestsData
import com.example.myapplication.data.remote.requests.RequestsEnvelope
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
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.ResponseBody.Companion.toResponseBody
import retrofit2.Response

@OptIn(ExperimentalCoroutinesApi::class)
class MessagesViewModelTest {
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
    fun loadRequests_success_thenDelete_removesItem() = runTest {
        val chatApi = FakeChatApi(
            conversations = listOf(
                ConversationDto(
                    _id = "c1",
                    participants = listOf(),
                    otherParticipant = ChatUserDto(_id = "u1", username = "ali", fullName = "Ali"),
                    lastMessage = "hello"
                )
            )
        )
        val requestsApi = FakeRequestsApi(
            listResponse = Response.success(
                RequestsEnvelope(
                    success = true,
                    message = "ok",
                    data = RequestsData(
                        requests = listOf(
                            RequestDto(
                                id = "r1",
                                type = "follow",
                                fromUser = RequestFromUserDto(id = "u2", name = "Vali", username = "vali")
                            )
                        )
                    ),
                    meta = null,
                    error = null
                )
            )
        )

        val vm = MessagesViewModel(chatApi = chatApi, requestsApi = requestsApi, ioDispatcher = dispatcher)
        advanceUntilIdle()
        assertEquals(1, vm.uiState.value.requests.size)

        vm.removeRequest("r1")
        advanceUntilIdle()
        assertEquals(0, vm.uiState.value.requests.size)
    }

    @Test
    fun addToChat_failure_keepsRequestAndSetsError() = runTest {
        val vm = MessagesViewModel(
            chatApi = FakeChatApi(emptyList()),
            requestsApi = FakeRequestsApi(
                listResponse = Response.success(
                    RequestsEnvelope(
                        success = true,
                        message = "ok",
                        data = RequestsData(
                            requests = listOf(
                                RequestDto(
                                    id = "r2",
                                    type = "follow",
                                    fromUser = RequestFromUserDto(id = "u3", name = "Test", username = "test")
                                )
                            )
                        ),
                        meta = null,
                        error = null
                    )
                ),
                addToChatResponse = Response.error(500, "x".toResponseBody("application/json".toMediaType()))
            ),
            ioDispatcher = dispatcher
        )
        advanceUntilIdle()
        vm.addRequestToChat("r2") {}
        advanceUntilIdle()

        assertEquals(1, vm.uiState.value.requests.size)
        assertTrue(vm.uiState.value.requestsError?.contains("500") == true)
    }

    private class FakeChatApi(
        private val conversations: List<ConversationDto>
    ) : ChatApi {
        override suspend fun getConversations(page: Int, limit: Int): Response<ApiEnvelope<List<ConversationDto>>> {
            return Response.success(ApiEnvelope(success = true, data = conversations))
        }

        override suspend fun createConversation(body: CreateConversationRequest): Response<ApiEnvelope<ConversationDto>> {
            return Response.success(ApiEnvelope(success = true, data = conversations.firstOrNull()))
        }

        override suspend fun getMessages(conversationId: String, page: Int, limit: Int): Response<ApiEnvelope<List<MessageDto>>> {
            return Response.success(ApiEnvelope(success = true, data = emptyList()))
        }

        override suspend fun sendMessage(conversationId: String, body: SendMessageRequest): Response<ApiEnvelope<MessageDto>> {
            return Response.success(ApiEnvelope(success = true, data = null))
        }

        override suspend fun markSeen(messageId: String): Response<ApiEnvelope<MessageDto>> {
            return Response.success(ApiEnvelope(success = true, data = null))
        }

        override suspend fun getConversationEvents(conversationId: String, after: Long, limit: Int): Response<ApiEnvelope<ChatEventsDataDto>> {
            return Response.success(ApiEnvelope(success = true, data = ChatEventsDataDto()))
        }

        override suspend fun getGroupEvents(groupId: String, after: Long, limit: Int): Response<ApiEnvelope<ChatEventsDataDto>> {
            return Response.success(ApiEnvelope(success = true, data = ChatEventsDataDto()))
        }
    }

    private class FakeRequestsApi(
        private val listResponse: Response<RequestsEnvelope<RequestsData>>,
        private val addToChatResponse: Response<RequestsEnvelope<AddToChatData>> = Response.success(
            RequestsEnvelope(success = true, data = AddToChatData(requestId = "r1"), message = "ok", meta = null, error = null)
        )
    ) : RequestsApi {
        override suspend fun getRequests(): Response<RequestsEnvelope<RequestsData>> = listResponse

        override suspend fun addToChat(requestId: String): Response<RequestsEnvelope<AddToChatData>> = addToChatResponse

        override suspend fun blockRequestUser(requestId: String): Response<RequestsEnvelope<Map<String, Any?>>> {
            return Response.success(RequestsEnvelope(success = true, data = emptyMap(), message = "ok", meta = null, error = null))
        }

        override suspend fun deleteRequest(requestId: String): Response<RequestsEnvelope<Map<String, Any?>>> {
            return Response.success(RequestsEnvelope(success = true, data = emptyMap(), message = "ok", meta = null, error = null))
        }
    }
}
