package com.example.myapplication

import android.app.Application
import io.sentry.SentryEvent
import io.sentry.SentryOptions
import io.sentry.android.core.SentryAndroid

class StugramApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        if (BuildConfig.CRASH_REPORTING_ENABLED && BuildConfig.SENTRY_DSN.isNotBlank()) {
            SentryAndroid.init(this) { options ->
                options.dsn = BuildConfig.SENTRY_DSN
                options.environment = if (BuildConfig.DEBUG) "debug" else "production"
                options.release = "uz.stugram.app@${BuildConfig.VERSION_NAME}+${BuildConfig.VERSION_CODE}"
                options.isEnableAutoSessionTracking = true
                options.isEnableNdk = true
                // Reduce noise in debug builds without silencing production.
                options.isDebug = false

                // Strip PII before any event reaches Sentry servers.
                // Access tokens, passwords, OTPs, and user identities must never
                // appear in crash reports.
                options.beforeSend = SentryOptions.BeforeSendCallback { event, _ ->
                    stripSensitiveData(event)
                }
            }
        }
    }

    private fun stripSensitiveData(event: SentryEvent): SentryEvent {
        // Remove user identity — we never send email/phone to Sentry.
        event.user = null

        // Scrub sensitive keys from request/extra context.
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
