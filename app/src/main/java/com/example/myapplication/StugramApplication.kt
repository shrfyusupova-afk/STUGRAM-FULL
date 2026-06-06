package com.example.myapplication

import android.app.Application
import android.util.Log
import androidx.work.Configuration
import androidx.work.WorkManager
import io.sentry.SentryEvent
import io.sentry.SentryOptions
import io.sentry.android.core.SentryAndroid
import java.io.File
import java.io.PrintWriter
import java.io.StringWriter

class StugramApplication : Application(), Configuration.Provider {

    override val workManagerConfiguration: Configuration
        get() = Configuration.Builder()
            .setMinimumLoggingLevel(Log.ERROR)
            .build()

    override fun onCreate() {
        super.onCreate()
        installCrashLogger()
        try {
            WorkManager.initialize(this, workManagerConfiguration)
        } catch (_: Throwable) {}
        if (BuildConfig.CRASH_REPORTING_ENABLED && BuildConfig.SENTRY_DSN.isNotBlank()) {
            SentryAndroid.init(this) { options ->
                options.dsn = BuildConfig.SENTRY_DSN
                options.environment = if (BuildConfig.DEBUG) "debug" else "production"
                options.release = "uz.stugram.app@${BuildConfig.VERSION_NAME}+${BuildConfig.VERSION_CODE}"
                options.isEnableAutoSessionTracking = true
                options.isEnableNdk = true
                options.isDebug = false
                options.beforeSend = SentryOptions.BeforeSendCallback { event, _ ->
                    stripSensitiveData(event)
                }
            }
        }
    }

    private fun installCrashLogger() {
        val previous = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { thread, throwable ->
            try {
                val sw = StringWriter()
                throwable.printStackTrace(PrintWriter(sw))
                val crashDir = File(getExternalFilesDir(null) ?: filesDir, "crashes").apply { mkdirs() }
                val crashFile = File(crashDir, "crash-${System.currentTimeMillis()}.txt")
                crashFile.writeText(
                    "Thread: ${thread.name}\n" +
                    "Time: ${System.currentTimeMillis()}\n" +
                    "Version: ${BuildConfig.VERSION_NAME}+${BuildConfig.VERSION_CODE}\n\n" +
                    sw.toString()
                )
                Log.e("StugramCrash", "Crash written to ${crashFile.absolutePath}", throwable)
            } catch (_: Throwable) {}
            previous?.uncaughtException(thread, throwable)
        }
    }

    private fun stripSensitiveData(event: SentryEvent): SentryEvent {
        event.user = null
        val sensitivePattern = Regex(
            "(token|password|otp|secret|authorization|refresh|access|identity|email|phone)",
            RegexOption.IGNORE_CASE
        )
        event.extras?.keys
            ?.filter { sensitivePattern.containsMatchIn(it) }
            ?.forEach { event.extras?.remove(it) }
        return event
    }
}
