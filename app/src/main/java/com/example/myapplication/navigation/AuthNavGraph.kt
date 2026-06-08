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
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.example.myapplication.config.AlphaFeatureFlags
import com.example.myapplication.data.remote.AuthSession
import com.example.myapplication.ui.auth.AuthScreen
import com.example.myapplication.ui.home.*
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally

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
    object CreatePost : Screen("create_post")
    object Notifications : Screen("notifications")
    object SavedPosts : Screen("saved_posts")
    object Followers : Screen("followers/{username}/{mode}") {
        fun createRoute(username: String, mode: String) = "followers/$username/$mode"
    }
    object Hashtag : Screen("hashtag/{tag}") {
        fun createRoute(tag: String) = "hashtag/$tag"
    }
}

@Composable
fun AuthNavGraph(
    navController: NavHostController = rememberNavController(),
    isDarkMode: Boolean,
    onThemeChange: (Boolean) -> Unit
) {
    // Observe session state so that a forced logout (e.g. expired refresh token)
    // navigates the user back to the auth screen from anywhere in the app.
    val sessionState by AuthSession.sessionState.collectAsState()
    val currentBackStack by navController.currentBackStackEntryAsState()

    LaunchedEffect(sessionState) {
        if (sessionState == AuthSession.State.LOGGED_OUT) {
            val currentRoute = currentBackStack?.destination?.route
            if (currentRoute != null && currentRoute != Screen.Auth.route) {
                navController.navigate(Screen.Auth.route) {
                    popUpTo(0) { inclusive = true }
                }
            }
        }
    }

    NavHost(
        navController = navController,
        startDestination = Screen.Auth.route
    ) {
        composable(route = Screen.Auth.route) {
            AuthScreen(
                onNavigateToHome = {
                    navController.navigate(Screen.Home.route) {
                        popUpTo(Screen.Auth.route) { inclusive = true }
                    }
                },
                isDarkMode = isDarkMode,
                onThemeChange = onThemeChange
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
                },
                onNavigateToCreatePost = {
                    navController.navigate(Screen.CreatePost.route)
                },
                onNavigateToNotifications = {
                    navController.navigate(Screen.Notifications.route)
                },
                onNavigateToSaved = {
                    navController.navigate(Screen.SavedPosts.route)
                },
                onNavigateToHashtag = { tag ->
                    navController.navigate(Screen.Hashtag.createRoute(tag))
                },
                onNavigateToFollowList = { username, mode ->
                    navController.navigate(Screen.Followers.createRoute(username, mode))
                }
            )
        }

        composable(
            route = Screen.Notifications.route,
            enterTransition = { slideInHorizontally(tween(280)) { it } + fadeIn(tween(280)) },
            popExitTransition = { slideOutHorizontally(tween(280)) { it } + fadeOut(tween(220)) }
        ) {
            NotificationsScreen(
                isDarkMode = isDarkMode,
                onBack = { navController.popBackStack() },
                onOpenProfile = { username ->
                    navController.navigate(Screen.UserProfile.createRoute(username))
                }
            )
        }

        composable(
            route = Screen.SavedPosts.route,
            enterTransition = { slideInHorizontally(tween(280)) { it } + fadeIn(tween(280)) },
            popExitTransition = { slideOutHorizontally(tween(280)) { it } + fadeOut(tween(220)) }
        ) {
            SavedPostsScreen(
                isDarkMode = isDarkMode,
                onBack = { navController.popBackStack() }
            )
        }

        composable(
            route = Screen.Followers.route,
            arguments = listOf(
                navArgument("username") { type = NavType.StringType },
                navArgument("mode") { type = NavType.StringType }
            ),
            enterTransition = { slideInHorizontally(tween(280)) { it } + fadeIn(tween(280)) },
            popExitTransition = { slideOutHorizontally(tween(280)) { it } + fadeOut(tween(220)) }
        ) { backStackEntry ->
            val username = backStackEntry.arguments?.getString("username").orEmpty()
            val mode = if (backStackEntry.arguments?.getString("mode") == "following")
                FollowListMode.FOLLOWING else FollowListMode.FOLLOWERS
            FollowListScreen(
                isDarkMode = isDarkMode,
                username = username,
                mode = mode,
                onBack = { navController.popBackStack() },
                onOpenProfile = { name -> navController.navigate(Screen.UserProfile.createRoute(name)) }
            )
        }

        composable(
            route = Screen.Hashtag.route,
            arguments = listOf(navArgument("tag") { type = NavType.StringType }),
            enterTransition = { slideInHorizontally(tween(280)) { it } + fadeIn(tween(280)) },
            popExitTransition = { slideOutHorizontally(tween(280)) { it } + fadeOut(tween(220)) }
        ) { backStackEntry ->
            val tag = backStackEntry.arguments?.getString("tag").orEmpty()
            HashtagDiscoveryScreen(
                isDarkMode = isDarkMode,
                hashtag = tag,
                onBack = { navController.popBackStack() }
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
                onBack = { navController.popBackStack() },
                onOpenFollowList = { name, mode ->
                    navController.navigate(Screen.Followers.createRoute(name, mode))
                }
            )
        }

        composable(
            route = Screen.CreatePost.route,
            enterTransition = {
                slideInHorizontally(tween(340)) { it } + fadeIn(tween(340))
            },
            exitTransition = { fadeOut(tween(200)) },
            popEnterTransition = { fadeIn(tween(200)) },
            popExitTransition = {
                slideOutHorizontally(tween(340)) { it } + fadeOut(tween(280))
            }
        ) {
            CreatePostHost(
                onClose = { navController.popBackStack() }
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
