package com.example.myapplication.data.remote.post

import okhttp3.MediaType
import okhttp3.RequestBody
import okio.BufferedSink
import java.io.File

/**
 * Streams a file as a request body while reporting how many bytes have been
 * written, so the UI can show a determinate upload progress bar. Progress is
 * reported against a shared total (all files in a multi-file post) via [onBytes].
 */
class ProgressRequestBody(
    private val file: File,
    private val contentType: MediaType?,
    private val onBytes: (bytesWritten: Long) -> Unit
) : RequestBody() {

    override fun contentType(): MediaType? = contentType

    override fun contentLength(): Long = file.length()

    override fun writeTo(sink: BufferedSink) {
        file.inputStream().use { input ->
            val buffer = ByteArray(DEFAULT_BUFFER)
            var read: Int
            while (input.read(buffer).also { read = it } != -1) {
                sink.write(buffer, 0, read)
                onBytes(read.toLong())
            }
        }
    }

    private companion object {
        const val DEFAULT_BUFFER = 8 * 1024
    }
}
