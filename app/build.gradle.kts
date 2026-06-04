import java.util.Properties

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    kotlin("kapt")
}

// ---------------------------------------------------------------------------
// Release signing configuration
// ---------------------------------------------------------------------------
// Values are resolved in priority order:
//   1. Environment variables (CI/CD)
//   2. local.properties (developer machine, never committed)
//   3. Absent → release build uses debug signing (APK is not distributable)
//
// Required env vars for a distributable release APK:
//   KEYSTORE_PATH      — absolute path to the .jks keystore file
//   KEYSTORE_PASSWORD  — password for the keystore
//   KEY_ALIAS          — key alias inside the keystore
//   KEY_PASSWORD       — password for the key alias
// ---------------------------------------------------------------------------
val localProps = Properties().also { props ->
    val localFile = rootProject.file("local.properties")
    if (localFile.exists()) props.load(localFile.inputStream())
}

fun resolveSigningProp(envKey: String, propKey: String = envKey.lowercase().replace('_', '.')): String? =
    System.getenv(envKey)?.takeIf { it.isNotBlank() }
        ?: localProps.getProperty(propKey)?.takeIf { it.isNotBlank() }

val keystorePath     = resolveSigningProp("KEYSTORE_PATH",     "signing.keystore.path")
val keystorePassword = resolveSigningProp("KEYSTORE_PASSWORD", "signing.keystore.password")
val resolvedKeyAlias = resolveSigningProp("KEY_ALIAS",         "signing.key.alias")
val resolvedKeyPassword = resolveSigningProp("KEY_PASSWORD",   "signing.key.password")

val hasSigningConfig = keystorePath != null && keystorePassword != null &&
                       resolvedKeyAlias != null && resolvedKeyPassword != null

// ---------------------------------------------------------------------------
// Google OAuth Web Client ID — resolved in priority order:
//   1. GOOGLE_WEB_CLIENT_ID env var (CI/CD)
//   2. google.web.client.id in local.properties (developer machine)
//   3. value in strings.xml (must not be the placeholder)
// ---------------------------------------------------------------------------
val googleWebClientIdFromEnv = resolveSigningProp("GOOGLE_WEB_CLIENT_ID", "google.web.client.id")

// Block assembleRelease if Google Web Client ID placeholder has not been replaced.
// The runtime check in LoginViewModel already guards Google Sign-In, but this
// catches the mistake at build time before the APK is distributed.
tasks.register("checkGoogleClientId") {
    doLast {
        val stringsFile = file("src/main/res/values/strings.xml")
        val hasEnvClientId = !googleWebClientIdFromEnv.isNullOrBlank()
        val stringsStillHasPlaceholder = stringsFile.exists() &&
            stringsFile.readText().contains("YOUR_GOOGLE_WEB_CLIENT_ID")

        if (!hasEnvClientId && stringsStillHasPlaceholder) {
            throw GradleException(
                "\n\n  RELEASE BLOCKED: google_web_client_id is still the placeholder value.\n" +
                "  Provide a real OAuth 2.0 Web Client ID via ONE of:\n" +
                "    a) GOOGLE_WEB_CLIENT_ID env var (CI/CD)\n" +
                "    b) google.web.client.id in local.properties\n" +
                "    c) Edit app/src/main/res/values/strings.xml directly\n"
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

    if (hasSigningConfig) {
        signingConfigs {
            create("release") {
                storeFile     = file(keystorePath!!)
                storePassword = keystorePassword!!
                keyAlias      = resolvedKeyAlias!!
                keyPassword   = resolvedKeyPassword!!
            }
        }
    }

    defaultConfig {
        applicationId = "uz.stugram.app"
        minSdk = 26
        targetSdk = 34
        versionCode = 1
        versionName = "1.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"

        // Production API endpoints — single source of truth.
        // Debug builds can override these via the debug block below (e.g. for local emulator dev).
        buildConfigField("String", "API_BASE_URL", "\"https://stugram-full.onrender.com/\"")
        buildConfigField("String", "SOCKET_URL",   "\"https://stugram-full.onrender.com\"")

        // Sentry crash reporting — resolved from env var or local.properties at build time.
        // CRASH_REPORTING_ENABLED is only true when a non-empty DSN is supplied.
        val sentryDsn = resolveSigningProp("SENTRY_DSN", "sentry.dsn") ?: ""
        buildConfigField("String",  "SENTRY_DSN",              "\"$sentryDsn\"")
        buildConfigField("Boolean", "CRASH_REPORTING_ENABLED", "${sentryDsn.isNotBlank()}")

        // If GOOGLE_WEB_CLIENT_ID is provided via env/local.properties, inject it as a
        // resource value so it overrides the strings.xml placeholder at build time.
        // This avoids the need for sed patching of strings.xml in CI.
        if (!googleWebClientIdFromEnv.isNullOrBlank()) {
            resValue("string", "google_web_client_id", googleWebClientIdFromEnv)
        }
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
            if (hasSigningConfig) {
                signingConfig = signingConfigs.getByName("release")
            } else {
                // No signing config supplied — APK will use debug signing and is
                // not distributable via Play Store. Set KEYSTORE_PATH, KEYSTORE_PASSWORD,
                // KEY_ALIAS, and KEY_PASSWORD (env vars or local.properties) to enable.
                signingConfig = signingConfigs.getByName("debug")
            }
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
    packaging {
        jniLibs {
            useLegacyPackaging = true
        }
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

    implementation(libs.sentry.android)
    implementation(libs.camerax.core)
    implementation(libs.camerax.camera2)
    implementation(libs.camerax.lifecycle)
    implementation(libs.camerax.view)
    implementation(libs.accompanist.permissions)

    testImplementation(libs.junit)
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.8.1")
    androidTestImplementation(libs.androidx.junit)
    androidTestImplementation(libs.androidx.espresso.core)
    androidTestImplementation(libs.androidx.room.testing)
    androidTestImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.8.1")
    androidTestImplementation(platform(libs.androidx.compose.bom))
    androidTestImplementation(libs.androidx.compose.ui.test.junit4)
    debugImplementation(libs.androidx.compose.ui.tooling)
    debugImplementation(libs.androidx.compose.ui.test.manifest)
}
