package com.example.myapplication.data.local.chat

import android.content.Context
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import java.util.concurrent.TimeUnit

object ChatOutboxScheduler {
    private const val UNIQUE_WORK_NAME = "chat-outbox-sync"

    fun schedule(context: Context, delayMillis: Long = 0L) {
        val constraints = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build()

        val request = OneTimeWorkRequestBuilder<ChatOutboxWorker>()
            .setConstraints(constraints)
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 10, TimeUnit.SECONDS)
            .setInitialDelay(delayMillis.coerceAtLeast(0L), TimeUnit.MILLISECONDS)
            .build()

        // REPLACE: each call recomputes the global earliest due time across all pending
        // messages, so a newly queued message (due sooner) correctly preempts a later
        // scheduled retry, and a worker run that finishes always reschedules itself for
        // the next due pending message instead of going silent.
        WorkManager.getInstance(context)
            .enqueueUniqueWork(UNIQUE_WORK_NAME, ExistingWorkPolicy.REPLACE, request)
    }
}
