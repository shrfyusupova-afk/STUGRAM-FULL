package com.example.myapplication

import android.app.Application
import io.sentry.android.core.SentryAndroid

class StugramApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        if (BuildConfig.CRASH_REPORTING_ENABLED && BuildConfig.SENTRY_DSN.isNotBlank()) {
            SentryAndroid.init(this) { options ->
                options.dsn = BuildConfig.SENTRY_DSN
                options.isEnableAutoSessionTracking = true
                options.isEnableNdk = true
                options.isDebug = BuildConfig.DEBUG
            }
        }
    }
}
