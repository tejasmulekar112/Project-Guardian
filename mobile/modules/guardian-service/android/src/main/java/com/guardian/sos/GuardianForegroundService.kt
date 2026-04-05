package com.guardian.sos

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.os.Build
import android.os.IBinder
import android.util.Log
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.android.gms.tasks.CancellationTokenSource
import org.vosk.Model
import org.vosk.Recognizer
import java.util.concurrent.Executors

class GuardianForegroundService : Service() {

    companion object {
        private const val TAG = "GuardianFgService"
        private const val CHANNEL_ID = "guardian_protection"
        private const val NOTIFICATION_ID = 1001
        private const val SOS_COOLDOWN_MS = 30_000L
        private const val SAMPLE_RATE = 16000

        private val DISTRESS_KEYWORDS = listOf(
            "help", "help me", "save me", "emergency",
            "bachao", "bacha", "madad", "sos"
        )

        @Volatile
        var isRunning = false
            private set
    }

    private var recognizer: Recognizer? = null
    private var model: Model? = null
    private var audioRecord: AudioRecord? = null
    private var isListening = false
    private lateinit var fusedLocationClient: FusedLocationProviderClient
    private lateinit var sosTriggerHandler: SOSTriggerHandler
    private lateinit var audioRecorder: AudioEvidenceRecorder
    private val executor = Executors.newSingleThreadExecutor()
    private var lastTriggerTime = 0L

    private val prefs: SharedPreferences
        get() = getSharedPreferences("guardian_service", Context.MODE_PRIVATE)

    override fun onCreate() {
        super.onCreate()
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)
        sosTriggerHandler = SOSTriggerHandler(this)
        audioRecorder = AudioEvidenceRecorder(this)
        Log.i(TAG, "Service created")
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        createNotificationChannel()
        startForeground(NOTIFICATION_ID, buildNotification())
        isRunning = true

        // Retry any queued SOS requests
        executor.execute { sosTriggerHandler.retryQueuedRequests() }

        startVosk()

        Log.i(TAG, "Service started")
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        super.onDestroy()
        isRunning = false
        stopVosk()
        audioRecorder.stopRecording()
        executor.shutdown()
        Log.i(TAG, "Service destroyed")
    }

    private fun startVosk() {
        executor.execute {
            try {
                val modelDir = copyModelToInternalStorage()
                model = Model(modelDir)
                recognizer = Recognizer(model, SAMPLE_RATE.toFloat())

                val bufferSize = AudioRecord.getMinBufferSize(
                    SAMPLE_RATE,
                    AudioFormat.CHANNEL_IN_MONO,
                    AudioFormat.ENCODING_PCM_16BIT
                )

                audioRecord = AudioRecord(
                    MediaRecorder.AudioSource.MIC,
                    SAMPLE_RATE,
                    AudioFormat.CHANNEL_IN_MONO,
                    AudioFormat.ENCODING_PCM_16BIT,
                    bufferSize
                )

                audioRecord?.startRecording()
                isListening = true
                Log.i(TAG, "Vosk started listening")

                val buffer = ShortArray(bufferSize / 2)
                while (isListening) {
                    val read = audioRecord?.read(buffer, 0, buffer.size) ?: -1
                    if (read > 0) {
                        val accepted = recognizer?.acceptWaveForm(buffer, read) ?: false
                        val text = if (accepted) {
                            recognizer?.result ?: ""
                        } else {
                            recognizer?.partialResult ?: ""
                        }
                        checkForDistressKeywords(text)
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Failed to start Vosk", e)
            }
        }
    }

    private fun copyModelToInternalStorage(): String {
        val modelDir = java.io.File(filesDir, "vosk-model")
        if (modelDir.exists() && modelDir.list()?.isNotEmpty() == true) {
            return modelDir.absolutePath
        }
        modelDir.mkdirs()

        // Copy model from assets
        val assetManager = assets
        copyAssetFolder(assetManager, "vosk-model", modelDir.absolutePath)
        Log.i(TAG, "Vosk model copied to ${modelDir.absolutePath}")
        return modelDir.absolutePath
    }

    private fun copyAssetFolder(assetManager: android.content.res.AssetManager, srcPath: String, dstPath: String) {
        val files = assetManager.list(srcPath) ?: return
        if (files.isEmpty()) {
            // It's a file, copy it
            assetManager.open(srcPath).use { input ->
                java.io.File(dstPath).outputStream().use { output ->
                    input.copyTo(output)
                }
            }
        } else {
            // It's a directory
            java.io.File(dstPath).mkdirs()
            for (file in files) {
                copyAssetFolder(assetManager, "$srcPath/$file", "$dstPath/$file")
            }
        }
    }

    private fun checkForDistressKeywords(jsonResult: String) {
        // Vosk returns JSON like {"text": "help me"} or {"partial": "help"}
        val lower = jsonResult.lowercase()
        for (keyword in DISTRESS_KEYWORDS) {
            if (lower.contains("\"$keyword\"") || lower.contains(" $keyword ") || lower.contains(" $keyword\"")) {
                Log.i(TAG, "Distress keyword detected: '$keyword' in: $jsonResult")
                onWakeWordDetected()
                return
            }
        }
    }

    private fun stopVosk() {
        try {
            isListening = false
            audioRecord?.stop()
            audioRecord?.release()
            audioRecord = null
            recognizer?.close()
            recognizer = null
            model?.close()
            model = null
            Log.i(TAG, "Vosk stopped")
        } catch (e: Exception) {
            Log.e(TAG, "Error stopping Vosk", e)
        }
    }

    private fun onWakeWordDetected() {
        val now = System.currentTimeMillis()
        if (now - lastTriggerTime < SOS_COOLDOWN_MS) {
            Log.i(TAG, "SOS cooldown active, ignoring trigger")
            return
        }
        lastTriggerTime = now

        executor.execute {
            val location = getLastKnownLocation()
            Log.i(TAG, "Location: $location")

            val response = sosTriggerHandler.triggerSOS(location)
            val eventId = response?.eventId ?: "unknown_${System.currentTimeMillis()}"
            Log.i(TAG, "SOS triggered, eventId: $eventId")

            val userId = prefs.getString("user_id", "") ?: ""
            audioRecorder.startRecording(eventId, userId) { file ->
                if (file != null) {
                    audioRecorder.uploadToFirebase(file, userId, eventId)
                }
            }

            val broadcastIntent = Intent("com.guardian.sos.BACKGROUND_SOS_TRIGGERED")
            broadcastIntent.putExtra("eventId", eventId)
            sendBroadcast(broadcastIntent)

            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            manager.notify(NOTIFICATION_ID, buildSOSActiveNotification(eventId))
        }
    }

    @Suppress("MissingPermission")
    private fun getLastKnownLocation(): SOSLocation? {
        return try {
            val task = fusedLocationClient.getCurrentLocation(
                Priority.PRIORITY_HIGH_ACCURACY,
                CancellationTokenSource().token
            )
            val location = com.google.android.gms.tasks.Tasks.await(
                task,
                5,
                java.util.concurrent.TimeUnit.SECONDS
            )
            location?.let { SOSLocation(it.latitude, it.longitude) }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to get location", e)
            null
        }
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Guardian Protection",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Keeps Guardian listening for distress calls"
                setShowBadge(false)
            }
            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            manager.createNotificationChannel(channel)
        }
    }

    private fun buildNotification(): Notification {
        val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
        val pendingIntent = PendingIntent.getActivity(
            this, 0, launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(this, CHANNEL_ID)
                .setContentTitle("Guardian is protecting you")
                .setContentText("Listening for distress calls")
                .setSmallIcon(R.drawable.ic_notification)
                .setContentIntent(pendingIntent)
                .setOngoing(true)
                .build()
        } else {
            @Suppress("DEPRECATION")
            Notification.Builder(this)
                .setContentTitle("Guardian is protecting you")
                .setContentText("Listening for distress calls")
                .setSmallIcon(R.drawable.ic_notification)
                .setContentIntent(pendingIntent)
                .setOngoing(true)
                .build()
        }
    }

    private fun buildSOSActiveNotification(eventId: String): Notification {
        val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
        val pendingIntent = PendingIntent.getActivity(
            this, 0, launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(this, CHANNEL_ID)
                .setContentTitle("SOS TRIGGERED")
                .setContentText("Emergency contacts are being notified")
                .setSmallIcon(R.drawable.ic_notification)
                .setContentIntent(pendingIntent)
                .setOngoing(true)
                .build()
        } else {
            @Suppress("DEPRECATION")
            Notification.Builder(this)
                .setContentTitle("SOS TRIGGERED")
                .setContentText("Emergency contacts are being notified")
                .setSmallIcon(R.drawable.ic_notification)
                .setContentIntent(pendingIntent)
                .setOngoing(true)
                .build()
        }
    }
}
