package com.guardian.sos

import android.content.Context
import android.media.MediaRecorder
import android.os.Build
import android.util.Log
import com.google.firebase.FirebaseApp
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.storage.FirebaseStorage
import java.io.File
import java.util.UUID

class AudioEvidenceRecorder(private val context: Context) {

    companion object {
        private const val TAG = "AudioEvidenceRecorder"
        private const val RECORDING_DURATION_MS = 30_000L
    }

    private var recorder: MediaRecorder? = null
    private var outputFile: File? = null
    var isRecording = false
        private set

    fun startRecording(eventId: String, userId: String, onComplete: (File?) -> Unit) {
        if (isRecording) {
            Log.w(TAG, "Already recording")
            return
        }

        val evidenceDir = File(context.filesDir, "evidence/$eventId")
        evidenceDir.mkdirs()
        val file = File(evidenceDir, "audio_bg_${UUID.randomUUID()}.m4a")
        outputFile = file

        try {
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
                setAudioSamplingRate(16000)
                setAudioEncodingBitRate(64000)
                setAudioChannels(1)
                setOutputFile(file.absolutePath)
                setMaxDuration(RECORDING_DURATION_MS.toInt())
                setOnInfoListener { _, what, _ ->
                    if (what == MediaRecorder.MEDIA_RECORDER_INFO_MAX_DURATION_REACHED) {
                        stopRecording()
                        onComplete(file)
                    }
                }
                prepare()
                start()
                isRecording = true
                Log.i(TAG, "Recording started: ${file.absolutePath}")
            }

            // Fallback timer in case OnInfoListener doesn't fire
            android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
                if (isRecording) {
                    stopRecording()
                    onComplete(file)
                }
            }, RECORDING_DURATION_MS + 1000)

        } catch (e: Exception) {
            Log.e(TAG, "Failed to start recording", e)
            isRecording = false
            onComplete(null)
        }
    }

    fun stopRecording() {
        if (!isRecording) return
        try {
            recorder?.stop()
        } catch (e: Exception) {
            Log.e(TAG, "Error stopping recorder", e)
        }
        try {
            recorder?.release()
        } catch (e: Exception) {
            Log.e(TAG, "Error releasing recorder", e)
        }
        recorder = null
        isRecording = false
        Log.i(TAG, "Recording stopped")
    }

    fun uploadToFirebase(file: File, userId: String, eventId: String) {
        try {
            if (FirebaseApp.getApps(context).isEmpty()) {
                Log.e(TAG, "Firebase not initialized")
                return
            }

            val storagePath = "evidence/$userId/$eventId/${file.name}"
            val storageRef = FirebaseStorage.getInstance().reference.child(storagePath)

            val uri = android.net.Uri.fromFile(file)
            storageRef.putFile(uri)
                .addOnSuccessListener {
                    storageRef.downloadUrl.addOnSuccessListener { downloadUri ->
                        Log.i(TAG, "Upload complete: $downloadUri")
                        writeEvidenceMetadata(eventId, file.name, downloadUri.toString())
                    }
                }
                .addOnFailureListener { e ->
                    Log.e(TAG, "Upload failed, file saved locally: ${file.absolutePath}", e)
                }
        } catch (e: Exception) {
            Log.e(TAG, "Firebase upload error", e)
        }
    }

    private fun writeEvidenceMetadata(eventId: String, filename: String, downloadUrl: String) {
        try {
            val db = FirebaseFirestore.getInstance()
            val eventRef = db.collection("sos_events").document(eventId)

            val evidenceEntry = hashMapOf(
                "type" to "audio",
                "url" to downloadUrl,
                "filename" to filename,
                "createdAt" to System.currentTimeMillis(),
                "source" to "background"
            )

            eventRef.update("evidence", FieldValue.arrayUnion(evidenceEntry))
                .addOnSuccessListener { Log.i(TAG, "Evidence metadata written to Firestore") }
                .addOnFailureListener { e -> Log.e(TAG, "Failed to write evidence metadata", e) }
        } catch (e: Exception) {
            Log.e(TAG, "Firestore error", e)
        }
    }
}
