package com.example.myapplication.ui.home

import androidx.activity.compose.BackHandler
import androidx.compose.animation.*
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.lifecycle.viewmodel.compose.viewModel

@Composable
fun CreatePostHost(
    onClose: () -> Unit,
    viewModel: CreatePostViewModel = viewModel()
) {
    val state by viewModel.state.collectAsState()

    BackHandler {
        when (state.step) {
            CreatePostStep.CAMERA -> onClose()
            CreatePostStep.EDIT -> viewModel.goToCamera()
            CreatePostStep.PUBLISH -> viewModel.goBackFromPublish()
        }
    }

    Box(modifier = Modifier.fillMaxSize().background(Color.Black)) {
        AnimatedContent(
            targetState = state.step,
            transitionSpec = {
                if (targetState.ordinal > initialState.ordinal) {
                    (slideInHorizontally(tween(320)) { it } + fadeIn(tween(320)))
                        .togetherWith(slideOutHorizontally(tween(320)) { -it } + fadeOut(tween(280)))
                } else {
                    (slideInHorizontally(tween(320)) { -it } + fadeIn(tween(320)))
                        .togetherWith(slideOutHorizontally(tween(320)) { it } + fadeOut(tween(280)))
                }.using(SizeTransform(clip = false))
            },
            label = "create_step"
        ) { step ->
            when (step) {
                CreatePostStep.CAMERA -> CameraScreen(
                    onImageSelected = { uri -> viewModel.setImageUri(uri) },
                    onClose = onClose
                )
                CreatePostStep.EDIT -> state.imageUri?.let { uri ->
                    PostEditScreen(
                        imageUri = uri,
                        state = state,
                        viewModel = viewModel,
                        onNext = viewModel::goToPublish,
                        onBack = viewModel::goToCamera
                    )
                }
                CreatePostStep.PUBLISH -> state.imageUri?.let { uri ->
                    PostPublishScreen(
                        imageUri = uri,
                        state = state,
                        viewModel = viewModel,
                        onBack = viewModel::goBackFromPublish,
                        onSuccess = onClose
                    )
                }
            }
        }
    }
}
