package com.example.myapplication.navigation

import androidx.activity.compose.BackHandler
import androidx.compose.animation.*
import androidx.compose.animation.core.tween
import androidx.compose.runtime.*
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.example.myapplication.ui.auth.AuthScreen
import com.example.myapplication.ui.home.*

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
}

@Composable
fun AuthNavGraph(
    navController: NavHostController = rememberNavController(),
    isDarkMode: Boolean,
    onThemeChange: (Boolean) -> Unit
) {
    NavHost(
        navController = navController,
        startDestination = Screen.Home.route
    ) {
        composable(route = Screen.Auth.route) {
            AuthScreen(onNavigateToHome = {
                navController.navigate(Screen.Home.route) {
                    popUpTo(Screen.Auth.route) { inclusive = true }
                }
            })
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
    }
}
