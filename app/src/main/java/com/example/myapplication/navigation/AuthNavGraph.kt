package com.example.myapplication.navigation

import androidx.activity.compose.BackHandler
import androidx.compose.animation.*
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.example.myapplication.config.AlphaFeatureFlags
import com.example.myapplication.ui.auth.AuthScreen
import com.example.myapplication.ui.home.*

/** Target parsed from a notification tap: type is the backend push "type". */
data class DeepLinkTarget(val type: String, val param: String)

sealed class Screen(val route: String) {
    object Auth : Screen("auth")
    object Home : Screen("home")
    object Messages : Screen("messages")
    object ChatDetail : Screen("chat_detail/{userName}/{isRequest}") {
        fun createRoute(userName: String, isRequest: Boolean = false) = "chat_detail/$userName/$isRequest"
    }
    object GroupChatDetail : Screen("group_chat_detail/{groupName}") {
        fun createRoute(groupName: String) = "group_chat_detail/$groupName"
    }
    object UserProfile : Screen("profile/{username}") {
        fun createRoute(username: String) = "profile/$username"
    }
}

@Composable
fun AuthNavGraph(
    navController: NavHostController = rememberNavController(),
    startDestination: String = Screen.Auth.route,
    isDarkMode: Boolean,
    onThemeChange: (Boolean) -> Unit,
    pendingDeepLink: DeepLinkTarget? = null,
    onDeepLinkConsumed: () -> Unit = {},
    pendingTelegramCode: String? = null,
    onTelegramCodeConsumed: () -> Unit = {}
) {
    // Forced logout (refresh failure) or explicit logout: clear the whole back
    // stack and return to Auth. A fresh Auth entry gives fresh Login/Register
    // ViewModels, so their isSuccess flags reset automatically.
    LaunchedEffect(Unit) {
        com.example.myapplication.data.remote.SessionManager.forceLogout.collect {
            navController.navigate(Screen.Auth.route) {
                popUpTo(navController.graph.id) { inclusive = true }
                launchSingleTop = true
            }
        }
    }

    // Notification deep link. Chat pushes carry senderName, which is exactly
    // what the chat route needs; other types (like/comment/follow) have no
    // matching detail route yet, so they simply open the app on Home.
    LaunchedEffect(pendingDeepLink) {
        val target = pendingDeepLink ?: return@LaunchedEffect
        if (startDestination != Screen.Home.route) {
            onDeepLinkConsumed()
            return@LaunchedEffect
        }
        when (target.type) {
            "chat" -> if (target.param.isNotBlank() && AlphaFeatureFlags.DIRECT_MESSAGES_ENABLED) {
                navController.navigate(Screen.ChatDetail.createRoute(target.param, false))
            }
            "group_chat" -> if (target.param.isNotBlank() && AlphaFeatureFlags.GROUP_CHAT_ENABLED) {
                navController.navigate(Screen.GroupChatDetail.createRoute(target.param))
            }
            else -> Unit // like/comment/follow: land on Home
        }
        onDeepLinkConsumed()
    }

    NavHost(
        navController = navController,
        startDestination = startDestination
    ) {
        composable(route = Screen.Auth.route) {
            AuthScreen(
                isDarkMode = isDarkMode,
                onNavigateToHome = {
                    navController.navigate(Screen.Home.route) {
                        popUpTo(Screen.Auth.route) { inclusive = true }
                    }
                },
                pendingTelegramCode = pendingTelegramCode,
                onTelegramCodeConsumed = onTelegramCodeConsumed
            )
        }

        composable(
            route = Screen.Home.route,
            enterTransition = { fadeIn(animationSpec = tween(500)) },
            exitTransition = { fadeOut(animationSpec = tween(500)) },
            popEnterTransition = { fadeIn(animationSpec = tween(500)) }
        ) {
            HomeScreen(
                isDarkMode = isDarkMode,
                onThemeChange = onThemeChange,
                onNavigateToChat = { userName, isRequest ->
                    navController.navigate(Screen.ChatDetail.createRoute(userName, isRequest))
                },
                onNavigateToGroupChat = { groupName ->
                    navController.navigate(Screen.GroupChatDetail.createRoute(groupName))
                },
                onNavigateToProfile = { username ->
                    navController.navigate(Screen.UserProfile.createRoute(username))
                }
            )
        }

        composable(
            route = Screen.ChatDetail.route,
            arguments = listOf(
                navArgument("userName") { type = NavType.StringType },
                navArgument("isRequest") { type = NavType.BoolType }
            )
        ) { backStackEntry ->
            if (!AlphaFeatureFlags.DIRECT_MESSAGES_ENABLED) {
                AlphaDisabledRouteScreen(
                    message = "Direct messages are disabled for this alpha.",
                    onBack = { navController.popBackStack() }
                )
                return@composable
            }
            val userName = backStackEntry.arguments?.getString("userName") ?: ""
            val isRequest = backStackEntry.arguments?.getBoolean("isRequest") ?: false
            
            // Back handler: ChatDetail -> Messages (Xabarlar) bo'limi
            BackHandler {
                navController.popBackStack()
            }

            ChatDetailScreen(
                userName = userName, 
                isRequest = isRequest, 
                onBack = { navController.popBackStack() }, 
                isDarkMode = isDarkMode
            )
        }

        composable(
            route = Screen.GroupChatDetail.route,
            arguments = listOf(navArgument("groupName") { type = NavType.StringType })
        ) { backStackEntry ->
            if (!AlphaFeatureFlags.GROUP_CHAT_ENABLED) {
                AlphaDisabledRouteScreen(
                    message = "Group chat is disabled for this alpha.",
                    onBack = { navController.popBackStack() }
                )
                return@composable
            }
            val groupName = backStackEntry.arguments?.getString("groupName") ?: ""
            
            BackHandler {
                navController.popBackStack()
            }

            GroupChatDetailScreen(
                groupName = groupName, 
                onBack = { navController.popBackStack() }, 
                isDarkMode = isDarkMode
            )
        }

        composable(
            route = Screen.UserProfile.route,
            arguments = listOf(navArgument("username") { type = NavType.StringType })
        ) { backStackEntry ->
            val username = backStackEntry.arguments?.getString("username").orEmpty()
            ProfileScreen(
                isDarkMode = isDarkMode,
                isRefreshing = false,
                onRefresh = {},
                isMyProfile = false,
                targetUsername = username,
                onBack = { navController.popBackStack() }
            )
        }
    }
}

@Composable
private fun AlphaDisabledRouteScreen(
    message: String,
    onBack: () -> Unit
) {
    BackHandler { onBack() }
    Box(
        modifier = Modifier.fillMaxSize().background(Color(0xFF0F0F0F)),
        contentAlignment = Alignment.Center
    ) {
        Column(
            modifier = Modifier.padding(horizontal = 24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Text(
                text = message,
                color = Color.White,
                fontWeight = FontWeight.Bold,
                fontSize = 18.sp,
                textAlign = TextAlign.Center
            )
            Spacer(Modifier.height(12.dp))
            Button(onClick = onBack) {
                Text("Back")
            }
        }
    }
}
