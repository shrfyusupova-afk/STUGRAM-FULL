package com.example.myapplication.data.remote.chat

enum class ChatFailureType {
    RETRYABLE,
    TERMINAL
}

object ChatFailureClassifier {
    fun classify(error: ChatResult.Error): ChatFailureType {
        val code = error.code
        if (code == null) return ChatFailureType.RETRYABLE

        return when (code) {
            408, 429, 500, 502, 503, 504 -> ChatFailureType.RETRYABLE
            401, 403, 404, 410, 422 -> ChatFailureType.TERMINAL
            in 400..499 -> ChatFailureType.TERMINAL
            else -> {
                val text = error.message.lowercase()
                if (text.contains("timeout") || text.contains("network")) {
                    ChatFailureType.RETRYABLE
                } else {
                    ChatFailureType.TERMINAL
                }
            }
        }
    }
}
