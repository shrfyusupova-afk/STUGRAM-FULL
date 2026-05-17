plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    kotlin("kapt")
}

// Block assembleRelease if Google Web Client ID placeholder has not been replaced.
// The runtime check in LoginViewModel already guards Google Sign-In, but this
// catches the mistake at build time before the APK is distributed.
tasks.register("checkGoogleClientId") {
    doLast {
        val stringsFile = file("src/main/res/values/strings.xml")
        if (stringsFile.exists() && stringsFile.readText().contains("YOUR_GOOGLE_WEB_CLIENT_ID")) {
            throw GradleException(
                "\n\n  RELEASE BLOCKED: google_web_client_id is still the placeholder value.\n" +
                "  Set a real OAuth 2.0 Web Client ID in app/src/main/res/values/strings.xml\n" +
                "  before building a release APK.\n"
            )
        }
    }
}

// Wire the check as a dependency of release assembly tasks. afterEvaluate is
// required because Android tasks are created lazily during project evaluation.
afterEvaluate {
    listOf("assembleRelease", "bundleRelease").forEach { taskName ->
        tasks.findByName(taskName)?.dependsOn("checkGoogleClientId")
    }
}

android {
    namespace = "com.example.myapplication"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.example.myapplication"
        minSdk = 26
        targetSdk = 34
        versionCode = 1
        versionName = "1.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"

        // Production API endpoints — single source of truth.
        // Debug builds can override these via the debug block below (e.g. for local emulator dev).
        buildConfigField("String", "API_BASE_URL", "\"https://stugram-beckend.onrender.com/\"")
        buildConfigField("String", "SOCKET_URL",   "\"https://stugram-beckend.onrender.com\"")
    }

    buildTypes {
        debug {
            // Keep production URLs by default so debug builds always work against
            // the real server. Override locally:
            //   buildConfigField("String", "API_BASE_URL", "\"http://10.0.2.2:5001/\"")
            //   buildConfigField("String", "SOCKET_URL",   "\"http://10.0.2.2:5001\"")
        }
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    buildFeatures {
        compose = true
        buildConfig = true
    }
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.activity.compose)
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.graphics)
    implementation(libs.androidx.compose.ui.tooling.preview)
    implementation(libs.androidx.compose.material3)
    implementation(libs.androidx.compose.material.icons.extended)
    implementation(libs.androidx.navigation.compose)
    implementation(libs.androidx.datastore.preferences)
    implementation(libs.androidx.security.crypto)
    implementation(libs.androidx.credentials)
    implementation(libs.androidx.credentials.play.services.auth)
    implementation(libs.googleid)
    implementation(libs.retrofit)
    implementation(libs.retrofit.converter.gson)
    implementation(libs.okhttp)
    implementation(libs.okhttp.logging)
    implementation(libs.coil.compose)
    implementation(libs.androidx.room.runtime)
    implementation(libs.androidx.room.ktx)
    kapt(libs.androidx.room.compiler)
    implementation(libs.androidx.work.runtime.ktx)
    implementation(libs.socket.io.client) {
        exclude(group = "org.json", module = "json")
    }

    testImplementation(libs.junit)
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.8.1")
    androidTestImplementation(libs.androidx.junit)
    androidTestImplementation(libs.androidx.espresso.core)
    androidTestImplementation(platform(libs.androidx.compose.bom))
    androidTestImplementation(libs.androidx.compose.ui.test.junit4)
    debugImplementation(libs.androidx.compose.ui.tooling)
    debugImplementation(libs.androidx.compose.ui.test.manifest)
}
