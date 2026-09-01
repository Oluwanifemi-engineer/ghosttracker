package com.magneetar.app

import android.content.Context
import android.media.MediaRecorder
import android.os.Build
import android.util.Log
import java.io.File

/**
 * Silent background audio recorder for duress situations.
 *
 * When duress mode is triggered, this starts recording audio from the
 * device microphone. The recording is saved locally and uploaded to the
 * server when connectivity is available.
 *
 * This provides evidence of what the attacker is saying/doing while
 * forcing the user to use the app.
 *
 * Note: Requires RECORD_AUDIO permission. If not granted, this silently
 * fails — the beacon and location tracking still work.
 */
object DuressRecorder {

    private const val TAG = "DuressRecorder"
    private const val MAX_DURATION_MS = 5 * 60 * 1000L // 5 minutes max
    private const val FILENAME = "duress_recording.m4a"

    private var recorder: MediaRecorder? = null
    private var isRecording = false

    /**
     * Start silent background recording.
     * Returns true if recording started successfully.
     */
    fun startRecording(context: Context): Boolean {
        if (isRecording) return true

        try {
            val outputFile = File(context.filesDir, FILENAME)

            recorder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                MediaRecorder(context)
            } else {
                @Suppress("DEPRECATION")
                MediaRecorder()
            }

            recorder?.apply {
                setAudioSource(MediaRecorder.AudioSource.MIC)
                setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
                setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
                setAudioSamplingRate(16000) // Low quality — saves space
                setAudioEncodingBitRate(32000)
                setMaxDuration(MAX_DURATION_MS.toInt())
                setOutputFile(outputFile.absolutePath)

                setOnInfoListener { _, what, _ ->
                    if (what == MediaRecorder.MEDIA_RECORDER_INFO_MAX_DURATION_REACHED) {
                        stopRecording()
                    }
                }

                prepare()
                start()
                isRecording = true
                Log.i(TAG, "Duress recording started: ${outputFile.absolutePath}")
                return true
            }
        } catch (e: Exception) {
            Log.w(TAG, "Failed to start recording: ${e.message}")
        }
        return false
    }

    /**
     * Stop recording and clean up.
     */
    fun stopRecording() {
        try {
            recorder?.apply {
                if (isRecording) {
                    stop()
                }
                release()
            }
        } catch (e: Exception) {
            Log.w(TAG, "Stop recording error: ${e.message}")
        }
        recorder = null
        isRecording = false
    }

    /**
     * Get the recording file for upload.
     */
    fun getRecordingFile(context: Context): File? {
        val file = File(context.filesDir, FILENAME)
        return if (file.exists() && file.length() > 0) file else null
    }

    /**
     * Delete the recording after successful upload.
     */
    fun deleteRecording(context: Context) {
        File(context.filesDir, FILENAME).delete()
    }
}
