package com.example.myapplication.ui.home

import androidx.compose.runtime.*
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

class HomeViewModel : ViewModel() {
    // --- UI STATES ---
    var currentTab by mutableIntStateOf(0)
    var showCreatePostModal by mutableStateOf(false)
    var showCommentsSheet by mutableStateOf(false)
    var activeStoryProfileIndex by mutableStateOf<Int?>(null)
    var showCameraView by mutableStateOf(false)

    // --- REFRESH STATES ---
    var isHomeRefreshing by mutableStateOf(false)
    var isSearchRefreshing by mutableStateOf(false)
    var isProfileRefreshing by mutableStateOf(false)

    // --- DATA ---
    var posts by mutableStateOf(
        listOf(
            PostData(1, "Alana maesya", "https://picsum.photos/seed/p1/800/800", isVideo = false),
            PostData(2, "Alana maesya", "https://picsum.photos/seed/p2/800/1200", isVideo = true),
            PostData(3, "Alana maesya", "https://picsum.photos/seed/p3/800/800", isVideo = false)
        ) + (4..10).map { PostData(it, "Alana maesya", "https://picsum.photos/seed/${it + 100}/800/800") }
    )

    val storyProfiles = listOf(
        StoryProfile(
            id = 1, name = "Your Story", avatar = "https://picsum.photos/seed/a1/100/100",
            stories = listOf(
                StoryMedia(101, "https://picsum.photos/seed/s1_1/900/1600"),
                StoryMedia(102, "https://picsum.photos/seed/s1_2/900/1600")
            ), isLive = true, isMine = true
        ),
        StoryProfile(
            id = 2, name = "Amanda", avatar = "https://picsum.photos/seed/a2/100/100",
            stories = listOf(StoryMedia(201, "https://picsum.photos/seed/s2_1/900/1600")), isSeen = true
        ),
        StoryProfile(
            id = 3, name = "Luiz", avatar = "https://picsum.photos/seed/a3/100/100",
            stories = listOf(StoryMedia(301, "https://picsum.photos/seed/s3_1/900/1600"))
        )
    )

    val myStoryActivities = Triple(
        listOf(StoryActivityUser("Aziza", "https://picsum.photos/seed/v1/100/100", "2m oldin")),
        listOf(StoryActivityUser("Malika", "https://picsum.photos/seed/l1/100/100", "❤️")),
        listOf(StoryActivityUser("Shoxrux", "https://picsum.photos/seed/c1/100/100", "🔥"))
    )

    val recommendedProfiles = (1..7).map { 
        RecommendedProfile(it, "User $it", "https://picsum.photos/seed/rp$it/800/800", "user_$it") 
    }

    // --- ACTIONS ---
    fun onTabSelected(index: Int) {
        currentTab = index
    }

    fun toggleCamera(show: Boolean) {
        showCameraView = show
    }

    fun openStory(index: Int) {
        activeStoryProfileIndex = index
    }

    fun closeStory() {
        activeStoryProfileIndex = null
    }

    fun toggleComments(show: Boolean) {
        showCommentsSheet = show
    }

    // --- REFRESH LOGIC ---
    fun refreshHome() {
        viewModelScope.launch {
            isHomeRefreshing = true
            delay(1500)
            isHomeRefreshing = false
        }
    }

    fun refreshSearch() {
        viewModelScope.launch {
            isSearchRefreshing = true
            delay(1500)
            isSearchRefreshing = false
        }
    }

    fun refreshProfile() {
        viewModelScope.launch {
            isProfileRefreshing = true
            delay(1500)
            isProfileRefreshing = false
        }
    }
}
