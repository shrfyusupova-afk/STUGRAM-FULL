package com.example.myapplication.core.ui

/**
 * One state model for every data-backed screen. Loading/Success/Error/Empty are
 * mutually exclusive, so a screen can never silently show nothing: it always
 * renders a skeleton, content, an empty message, or an error with retry.
 */
sealed class UiState<out T> {
    object Loading : UiState<Nothing>()
    data class Success<T>(val data: T) : UiState<T>()
    data class Error(val message: String) : UiState<Nothing>()
    object Empty : UiState<Nothing>()
}
