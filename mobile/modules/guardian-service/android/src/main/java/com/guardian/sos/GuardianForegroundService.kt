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
import android.os.CountDownTimer
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.util.Log
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.android.gms.tasks.CancellationTokenSource
import org.json.JSONArray
import org.vosk.Model
import org.vosk.Recognizer
import java.util.concurrent.Executors

class GuardianForegroundService : Service() {

    companion object {
        private const val TAG = "GuardianFgService"
        private const val CHANNEL_ID = "guardian_protection"
        private const val SOS_ALERT_CHANNEL_ID = "guardian_sos_alert"
        private const val NOTIFICATION_ID = 1001
        private const val COUNTDOWN_NOTIFICATION_ID = 1002
        private const val SOS_COOLDOWN_MS = 30_000L
        private const val DEFAULT_COUNTDOWN_SECONDS = 10
        private const val COUNTDOWN_INTERVAL_MS = 1_000L
        private const val SAMPLE_RATE = 16000

        private val DEFAULT_KEYWORDS = listOf(
            "help", "help me", "save me", "emergency",
            "bachao", "bacha", "madad", "sos"
        )

        @Volatile
        var isRunning = false
            private set

        @Volatile
        private var countdownTimer: CountDownTimer? = null

        @Volatile
        private var serviceInstance: GuardianForegroundService? = null

        fun cancelCountdown() {
            countdownTimer?.cancel()
            countdownTimer = null
            serviceInstance?.onCountdownCancelled()
        }
    }

    private var recognizer: Recognizer? = null
    private var model: Model? = null
    private var audioRecord: AudioRecord? = null
    private var isListening = false
    private lateinit var fusedLocationClient: FusedLocationProviderClient
    private lateinit var sosTriggerHandler: SOSTriggerHandler
    private lateinit var audioRecorder: AudioEvidenceRecorder
    private val executor = Executors.newSingleThreadExecutor()
    private val mainHandler = Handler(Looper.getMainLooper())
    private var lastTriggerTime = 0L

    private val prefs: SharedPreferences
        get() = getSharedPreferences("guardian_service", Context.MODE_PRIVATE)

    private fun getDistressKeywords(): List<String> {
        val json = prefs.getString("distress_keywords", null) ?: return DEFAULT_KEYWORDS
        return try {
            val arr = JSONArray(json)
            (0 until arr.length()).map { arr.getString(it) }
        } catch (e: Exception) {
            DEFAULT_KEYWORDS
        }
    }

    private fun getCountdownDurationMs(): Long {
        val seconds = prefs.getInt("countdown_duration_seconds", DEFAULT_COUNTDOWN_SECONDS)
        return seconds * 1000L
    }

    override fun onCreate() {
        super.onCreate()
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)
        sosTriggerHandler = SOSTriggerHandler(this)
        audioRecorder = AudioEvidenceRecorder(this)
        serviceInstance = this
        Log.i(TAG, "Service created")
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        createNotificationChannel()
        createSOSAlertChannel()
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
        countdownTimer?.cancel()
        countdownTimer = null
        serviceInstance = null
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
        for (keyword in getDistressKeywords()) {
            if (lower.contains("\"$keyword\"") || lower.contains(" $keyword ") || lower.contains(" $keyword\"")) {
                Log.i(TAG, "Distress keyword detected: '$keyword' in: $jsonResult")
                startSOSCountdown()
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

    private fun startSOSCountdown() {
        // Don't start another countdown if one is already running
        if (countdownTimer != null) {
            Log.i(TAG, "Countdown already running, ignoring duplicate detection")
            return
        }

        val now = System.currentTimeMillis()
        if (now - lastTriggerTime < SOS_COOLDOWN_MS) {
            Log.i(TAG, "SOS cooldown active, ignoring trigger")
            return
        }

        val countdownDurationMs = getCountdownDurationMs()
        Log.i(TAG, "Starting SOS countdown (${countdownDurationMs / 1000}s)")

        // CountDownTimer must run on main thread
        mainHandler.post {
            startVibrationPattern()

            countdownTimer = object : CountDownTimer(countdownDurationMs, COUNTDOWN_INTERVAL_MS) {
                override fun onTick(millisUntilFinished: Long) {
                    val secondsLeft = (millisUntilFinished / 1000).toInt() + 1
                    val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
                    manager.notify(COUNTDOWN_NOTIFICATION_ID, buildCountdownNotification(secondsLeft))
                }

                override fun onFinish() {
                    countdownTimer = null
                    stopVibration()
                    val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
                    manager.cancel(COUNTDOWN_NOTIFICATION_ID)
                    Log.i(TAG, "Countdown finished — triggering SOS")
                    onWakeWordDetected()
                }
            }.start()
        }
    }

    private fun onCountdownCancelled() {
        stopVibration()
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.cancel(COUNTDOWN_NOTIFICATION_ID)
        Log.i(TAG, "SOS countdown cancelled by user — resuming listening")
    }

    private fun startVibrationPattern() {
        val vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val manager = getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
            manager.defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
        }

        // Repeating pattern: vibrate 500ms, pause 500ms
        val pattern = longArrayOf(0, 500, 500)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            vibrator.vibrate(VibrationEffect.createWaveform(pattern, 0))
        } else {
            @Suppress("DEPRECATION")
            vibrator.vibrate(pattern, 0)
        }
    }

    private fun stopVibration() {
        val vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val manager = getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
            manager.defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
        }
        vibrator.cancel()
    }

    private fun onWakeWordDetected() {
        lastTriggerTime = System.currentTimeMillis()

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

    private fun buildCountdownNotification(secondsLeft: Int): Notification {
        val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
        val launchPendingIntent = PendingIntent.getActivity(
            this, 0, launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val cancelIntent = Intent(SOSCancelReceiver.ACTION_CANCEL_SOS).apply {
            setPackage(packageName)
        }
        val cancelPendingIntent = PendingIntent.getBroadcast(
            this, 0, cancelIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(this, SOS_ALERT_CHANNEL_ID)
                .setContentTitle("SOS Detected — Triggering in ${secondsLeft}s")
                .setContentText("Tap Cancel to stop")
                .setSmallIcon(R.drawable.ic_notification)
                .setContentIntent(launchPendingIntent)
                .setOngoing(true)
                .addAction(
                    Notification.Action.Builder(null, "Cancel", cancelPendingIntent).build()
                )
                .build()
        } else {
            @Suppress("DEPRECATION")
            Notification.Builder(this)
                .setContentTitle("SOS Detected — Triggering in ${secondsLeft}s")
                .setContentText("Tap Cancel to stop")
                .setSmallIcon(R.drawable.ic_notification)
                .setContentIntent(launchPendingIntent)
                .setOngoing(true)
                .addAction(0, "Cancel", cancelPendingIntent)
                .build()
        }
    }

    private fun createSOSAlertChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                SOS_ALERT_CHANNEL_ID,
                "SOS Alerts",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "High-priority alerts when distress is detected"
                enableVibration(false) // We handle vibration ourselves
                setShowBadge(true)
            }
            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            manager.createNotificationChannel(channel)
        }
    }
}
