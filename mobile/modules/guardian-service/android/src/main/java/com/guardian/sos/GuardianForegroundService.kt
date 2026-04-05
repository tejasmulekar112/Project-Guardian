package com.guardian.sos

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.os.Build
import android.os.IBinder
import android.util.Log
import ai.picovoice.porcupine.Porcupine
import ai.picovoice.porcupine.PorcupineManager
import ai.picovoice.porcupine.PorcupineManagerCallback
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.android.gms.tasks.CancellationTokenSource
import java.util.concurrent.Executors

class GuardianForegroundService : Service() {

    companion object {
        private const val TAG = "GuardianFgService"
        private const val CHANNEL_ID = "guardian_protection"
        private const val NOTIFICATION_ID = 1001
        private const val SOS_COOLDOWN_MS = 30_000L

        @Volatile
        var isRunning = false
            private set
    }

    private var porcupineManager: PorcupineManager? = null
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

        startPorcupine()

        Log.i(TAG, "Service started")
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        super.onDestroy()
        isRunning = false
        stopPorcupine()
        audioRecorder.stopRecording()
        executor.shutdown()
        Log.i(TAG, "Service destroyed")
    }

    private fun startPorcupine() {
        val accessKey = prefs.getString("porcupine_access_key", null)
        if (accessKey.isNullOrEmpty()) {
            Log.e(TAG, "Porcupine access key not set. Set it via GuardianService.setAuthCredentials.")
            return
        }

        try {
            porcupineManager = PorcupineManager.Builder()
                .setAccessKey(accessKey)
                .setKeywords(arrayOf(
                    Porcupine.BuiltInKeyword.OK_GOOGLE
                ))
                .setSensitivities(floatArrayOf(0.7f))
                .build(this, PorcupineManagerCallback { keywordIndex ->
                    Log.i(TAG, "Wake word detected! Index: $keywordIndex")
                    onWakeWordDetected()
                })

            porcupineManager?.start()
            Log.i(TAG, "Porcupine started listening")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start Porcupine", e)
        }
    }

    private fun stopPorcupine() {
        try {
            porcupineManager?.stop()
            porcupineManager?.delete()
            porcupineManager = null
            Log.i(TAG, "Porcupine stopped")
        } catch (e: Exception) {
            Log.e(TAG, "Error stopping Porcupine", e)
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
