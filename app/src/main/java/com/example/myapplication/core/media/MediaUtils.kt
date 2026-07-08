package com.example.myapplication.core.media

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.media.ExifInterface
import android.net.Uri
import java.io.File
import java.io.FileOutputStream

/**
 * Client-side media preparation. Images are downscaled to <= [MAX_DIMENSION]px on
 * the longest edge and re-encoded as JPEG at [JPEG_QUALITY] before upload, which
 * keeps posts small without a third-party library. All work returns a temp file
 * in cacheDir so the caller can stream it as multipart.
 */
object MediaUtils {
    private const val MAX_DIMENSION = 1080
    private const val JPEG_QUALITY = 80
    const val MAX_VIDEO_BYTES = 50L * 1024 * 1024 // 50 MB client cap

    class MediaException(message: String) : Exception(message)

    /** Compresses a picked image Uri to a JPEG temp file. Throws [MediaException] on failure. */
    fun compressImage(context: Context, uri: Uri): File {
        val resolver = context.contentResolver

        // 1) Read bounds to compute a sane sample size (avoids decoding a huge bitmap).
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        resolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, bounds) }
            ?: throw MediaException("Rasm o'qib bo'lmadi")
        if (bounds.outWidth <= 0 || bounds.outHeight <= 0) throw MediaException("Rasm buzuq")

        val decodeOptions = BitmapFactory.Options().apply {
            inSampleSize = calculateInSampleSize(bounds.outWidth, bounds.outHeight, MAX_DIMENSION)
        }
        val decoded = resolver.openInputStream(uri)?.use {
            BitmapFactory.decodeStream(it, null, decodeOptions)
        } ?: throw MediaException("Rasm dekod qilinmadi")

        // 2) Scale to the exact max edge and apply EXIF rotation.
        val scaled = scaleToMaxEdge(decoded, MAX_DIMENSION)
        if (scaled != decoded) decoded.recycle()
        val rotated = applyExifRotation(context, uri, scaled)
        if (rotated != scaled) scaled.recycle()

        val outFile = File.createTempFile("upload_", ".jpg", context.cacheDir)
        FileOutputStream(outFile).use { out ->
            rotated.compress(Bitmap.CompressFormat.JPEG, JPEG_QUALITY, out)
        }
        rotated.recycle()
        return outFile
    }

    /** Copies a picked video Uri to a temp file, enforcing the [MAX_VIDEO_BYTES] cap. */
    fun copyVideo(context: Context, uri: Uri): File {
        val size = fileSize(context, uri)
        if (size > MAX_VIDEO_BYTES) {
            throw MediaException("Video juda katta (max 50MB)")
        }
        val outFile = File.createTempFile("upload_", ".mp4", context.cacheDir)
        context.contentResolver.openInputStream(uri)?.use { input ->
            FileOutputStream(outFile).use { output -> input.copyTo(output) }
        } ?: throw MediaException("Video o'qib bo'lmadi")
        return outFile
    }

    fun fileSize(context: Context, uri: Uri): Long {
        return context.contentResolver.openAssetFileDescriptor(uri, "r")?.use { it.length }
            ?: 0L
    }

    private fun calculateInSampleSize(width: Int, height: Int, target: Int): Int {
        var sample = 1
        var w = width
        var h = height
        while (w / 2 >= target && h / 2 >= target) {
            w /= 2
            h /= 2
            sample *= 2
        }
        return sample
    }

    private fun scaleToMaxEdge(bitmap: Bitmap, maxEdge: Int): Bitmap {
        val longest = maxOf(bitmap.width, bitmap.height)
        if (longest <= maxEdge) return bitmap
        val ratio = maxEdge.toFloat() / longest
        val newWidth = (bitmap.width * ratio).toInt().coerceAtLeast(1)
        val newHeight = (bitmap.height * ratio).toInt().coerceAtLeast(1)
        return Bitmap.createScaledBitmap(bitmap, newWidth, newHeight, true)
    }

    private fun applyExifRotation(context: Context, uri: Uri, bitmap: Bitmap): Bitmap {
        val orientation = runCatching {
            context.contentResolver.openInputStream(uri)?.use { stream ->
                ExifInterface(stream).getAttributeInt(
                    ExifInterface.TAG_ORIENTATION,
                    ExifInterface.ORIENTATION_NORMAL
                )
            } ?: ExifInterface.ORIENTATION_NORMAL
        }.getOrDefault(ExifInterface.ORIENTATION_NORMAL)

        val degrees = when (orientation) {
            ExifInterface.ORIENTATION_ROTATE_90 -> 90f
            ExifInterface.ORIENTATION_ROTATE_180 -> 180f
            ExifInterface.ORIENTATION_ROTATE_270 -> 270f
            else -> return bitmap
        }
        val matrix = Matrix().apply { postRotate(degrees) }
        return Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, matrix, true)
    }
}
