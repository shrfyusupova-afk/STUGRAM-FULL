# ─── Stack traces ────────────────────────────────────────────────────────────
# Keep source file names and line numbers so crash reports (Crashlytics, etc.)
# are human-readable without a local mapping file.
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# ─── Retrofit / OkHttp ───────────────────────────────────────────────────────
-keepattributes Signature, InnerClasses, EnclosingMethod
-keepattributes RuntimeVisibleAnnotations, RuntimeVisibleParameterAnnotations
-keepclassmembers,allowshrinking,allowobfuscation interface * {
    @retrofit2.http.* <methods>;
}
-dontwarn org.codehaus.mojo.animal_sniffer.IgnoreJRERequirement
-dontwarn javax.annotation.**
-dontwarn kotlin.Unit
-dontwarn retrofit2.KotlinExtensions
-dontwarn retrofit2.KotlinExtensions$*
-if interface * { @retrofit2.http.* <methods>; }
-keep,allowobfuscation interface <1>

# OkHttp
-dontwarn okhttp3.**
-dontwarn okio.**
-dontwarn javax.annotation.**
-keepnames class okhttp3.internal.publicsuffix.PublicSuffixDatabase

# ─── Gson / JSON serialization ───────────────────────────────────────────────
-keepattributes *Annotation*
-dontwarn sun.misc.**
-keep class com.google.gson.** { *; }
-keep class * implements com.google.gson.TypeAdapterFactory
-keep class * implements com.google.gson.JsonSerializer
-keep class * implements com.google.gson.JsonDeserializer

# ─── Data models used by Retrofit (request/response DTOs) ───────────────────
-keep class com.example.myapplication.data.remote.** { *; }
-keepclassmembers class com.example.myapplication.data.remote.** { *; }

# ─── Room database entities & DAOs ───────────────────────────────────────────
-keep class com.example.myapplication.data.local.** { *; }
-keepclassmembers class com.example.myapplication.data.local.** { *; }

# ─── Socket.IO client ────────────────────────────────────────────────────────
-keep class io.socket.** { *; }
-keep class io.socket.client.** { *; }
-dontwarn io.socket.**

# ─── Kotlin coroutines ───────────────────────────────────────────────────────
-keepnames class kotlinx.coroutines.internal.MainDispatcherFactory {}
-keepnames class kotlinx.coroutines.CoroutineExceptionHandler {}
-keepclassmembers class kotlinx.coroutines.** {
    volatile <fields>;
}

# ─── Jetpack Compose ─────────────────────────────────────────────────────────
-keep class androidx.compose.** { *; }
-dontwarn androidx.compose.**

# ─── Google Credential Manager / Identity ────────────────────────────────────
-keep class com.google.android.libraries.identity.** { *; }
-dontwarn com.google.android.libraries.identity.**
-keep class androidx.credentials.** { *; }

# ─── WorkManager ─────────────────────────────────────────────────────────────
-keep class * extends androidx.work.Worker
-keep class * extends androidx.work.ListenableWorker {
    public <init>(android.content.Context, androidx.work.WorkerParameters);
}

# ─── Coil image loading ───────────────────────────────────────────────────────
-dontwarn coil.**

# ─── EncryptedSharedPreferences / Security Crypto ───────────────────────────
-keep class androidx.security.crypto.** { *; }
-keep class com.google.crypto.tink.** { *; }
-dontwarn androidx.security.crypto.**
-dontwarn com.google.crypto.tink.**

# ─── DataStore preferences ───────────────────────────────────────────────────
-keep class androidx.datastore.** { *; }
-keepclassmembers class * extends androidx.datastore.preferences.protobuf.GeneratedMessageLite {
    <fields>;
}
-dontwarn androidx.datastore.**

# ─── CameraX ─────────────────────────────────────────────────────────────────
-keep class androidx.camera.** { *; }
-dontwarn androidx.camera.**

# ─── Kotlin Serialization ────────────────────────────────────────────────────
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.AnnotationsKt

# ─── UI data classes (Gson deserialization) ──────────────────────────────────
-keep class com.example.myapplication.ui.home.PostData { *; }
-keep class com.example.myapplication.ui.home.StoryProfile { *; }
-keep class com.example.myapplication.ui.home.** { *; }
-keepclassmembers class com.example.myapplication.ui.home.** { *; }

# ─── Application & Activity ──────────────────────────────────────────────────
-keep class com.example.myapplication.StugramApplication { *; }
-keep class com.example.myapplication.MainActivity { *; }

# ─── Sentry ──────────────────────────────────────────────────────────────────
-dontwarn io.sentry.**
-keep class io.sentry.** { *; }
