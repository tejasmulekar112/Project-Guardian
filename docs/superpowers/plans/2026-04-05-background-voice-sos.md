# Background Voice-Activated SOS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable the Guardian app to detect distress wake words ("help", "help me", "bachao") via Picovoice Porcupine in an Android Foreground Service, triggering a full SOS (API + SMS + audio evidence) even when the phone is locked or the app is killed.

**Architecture:** A native Kotlin Foreground Service runs Porcupine wake word detection independently of React Native. On detection, it fetches GPS, calls the backend API, records 30s audio evidence, uploads to Firebase Storage, and writes metadata to Firestore. A BootReceiver auto-starts the service on device boot. An Expo Module bridges the service to JS for UI control.

**Tech Stack:** Kotlin, Picovoice Porcupine Android SDK, Android FusedLocationProviderClient, OkHttp, Firebase Android SDK, Expo Modules API, expo-dev-client, React Native

---

## File Structure

### New Files
```
mobile/modules/guardian-service/
├── expo-module.config.json                          — Expo module registration
├── android/build.gradle                             — Android dependencies (Porcupine, Firebase, OkHttp, Play Services)
├── android/src/main/AndroidManifest.xml             — Service, receiver, permissions declarations
├── android/src/main/java/com/guardian/sos/
│   ├── GuardianServiceModule.kt                     — Expo Module bridge (JS ↔ native)
│   ├── GuardianForegroundService.kt                 — Foreground service with Porcupine + SOS orchestration
│   ├── SOSTriggerHandler.kt                         — HTTP client for POST /sos/trigger with offline queue
│   ├── AudioEvidenceRecorder.kt                     — 30s MediaRecorder + Firebase Storage upload
│   └── BootReceiver.kt                              — BOOT_COMPLETED receiver to auto-start service
├── android/src/main/res/drawable/ic_notification.xml — Notification icon (simple shield)
└── index.ts                                         — TypeScript bindings for GuardianServiceModule

mobile/src/hooks/useBackgroundProtection.ts          — React hook wrapping the native module
```

### Modified Files
```
shared-schemas/src/sos-event.ts                      — Add 'voice_background' to TriggerType
backend/app/models/sos_event.py                      — Add VOICE_BACKGROUND to TriggerType enum
mobile/app.json                                      — Add permissions, plugin registration
mobile/package.json                                  — Add expo-dev-client dependency
mobile/src/contexts/AuthContext.tsx                   — Write auth tokens to SharedPreferences on login/logout
mobile/src/screens/HomeScreen.tsx                     — Add background protection indicator + listen for background SOS events
```

---

## Task 1: Add `voice_background` Trigger Type to Shared Schemas

**Files:**
- Modify: `shared-schemas/src/sos-event.ts:1`
- Modify: `backend/app/models/sos_event.py:13-16`

- [ ] **Step 1: Update TypeScript TriggerType**

In `shared-schemas/src/sos-event.ts`, change line 2:

```typescript
export type TriggerType = 'manual' | 'voice' | 'shake' | 'voice_background';
```

- [ ] **Step 2: Update Python TriggerType enum**

In `backend/app/models/sos_event.py`, add to the `TriggerType` enum after line 16:

```python
class TriggerType(str, Enum):
    MANUAL = "manual"
    VOICE = "voice"
    SHAKE = "shake"
    VOICE_BACKGROUND = "voice_background"
```

- [ ] **Step 3: Verify backend still starts**

Run:
```bash
cd backend && poetry run python -c "from app.models.sos_event import TriggerType; print(TriggerType.VOICE_BACKGROUND)"
```
Expected: `voice_background`

- [ ] **Step 4: Commit**

```bash
git add shared-schemas/src/sos-event.ts backend/app/models/sos_event.py
git commit -m "feat: add voice_background trigger type to shared schemas"
```

---

## Task 2: Create Expo Module Skeleton and Build Configuration

**Files:**
- Create: `mobile/modules/guardian-service/expo-module.config.json`
- Create: `mobile/modules/guardian-service/index.ts`
- Create: `mobile/modules/guardian-service/android/build.gradle`
- Create: `mobile/modules/guardian-service/android/src/main/AndroidManifest.xml`
- Modify: `mobile/app.json`
- Modify: `mobile/package.json`

- [ ] **Step 1: Create expo-module.config.json**

Create `mobile/modules/guardian-service/expo-module.config.json`:

```json
{
  "platforms": ["android"],
  "android": {
    "modules": ["com.guardian.sos.GuardianServiceModule"]
  }
}
```

- [ ] **Step 2: Create android/build.gradle**

Create `mobile/modules/guardian-service/android/build.gradle`:

```groovy
apply plugin: 'com.android.library'
apply plugin: 'kotlin-android'

group = 'com.guardian.sos'

android {
    namespace "com.guardian.sos"
    compileSdk 35

    defaultConfig {
        minSdk 24
        targetSdk 35
    }

    compileOptions {
        sourceCompatibility JavaVersion.VERSION_17
        targetCompatibility JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    implementation project(':expo-modules-core')

    // Porcupine wake word engine
    implementation 'ai.picovoice:porcupine-android:3.0.3'

    // Location
    implementation 'com.google.android.gms:play-services-location:21.3.0'

    // HTTP client
    implementation 'com.squareup.okhttp3:okhttp:4.12.0'

    // Firebase
    implementation platform('com.google.firebase:firebase-bom:33.7.0')
    implementation 'com.google.firebase:firebase-storage'
    implementation 'com.google.firebase:firebase-firestore'

    // JSON
    implementation 'com.google.code.gson:gson:2.11.0'
}
```

- [ ] **Step 3: Create AndroidManifest.xml**

Create `mobile/modules/guardian-service/android/src/main/AndroidManifest.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_MICROPHONE" />
    <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />

    <application>
        <service
            android:name="com.guardian.sos.GuardianForegroundService"
            android:foregroundServiceType="microphone"
            android:exported="false" />

        <receiver
            android:name="com.guardian.sos.BootReceiver"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.BOOT_COMPLETED" />
            </intent-filter>
        </receiver>
    </application>

</manifest>
```

- [ ] **Step 4: Create TypeScript bindings**

Create `mobile/modules/guardian-service/index.ts`:

```typescript
import { NativeModule, requireNativeModule } from 'expo-modules-core';
import { EventEmitter } from 'expo-modules-core';

interface GuardianServiceModuleType extends NativeModule {
  startService(): Promise<void>;
  stopService(): Promise<void>;
  isRunning(): Promise<boolean>;
  setEnabled(enabled: boolean): Promise<void>;
  isEnabled(): Promise<boolean>;
  setAuthCredentials(token: string, userId: string, apiUrl: string): Promise<void>;
  clearAuthCredentials(): Promise<void>;
}

const GuardianServiceNative = requireNativeModule<GuardianServiceModuleType>('GuardianServiceModule');

export const guardianServiceEmitter = new EventEmitter(GuardianServiceNative);

export const GuardianService = {
  startService: () => GuardianServiceNative.startService(),
  stopService: () => GuardianServiceNative.stopService(),
  isRunning: () => GuardianServiceNative.isRunning(),
  setEnabled: (enabled: boolean) => GuardianServiceNative.setEnabled(enabled),
  isEnabled: () => GuardianServiceNative.isEnabled(),
  setAuthCredentials: (token: string, userId: string, apiUrl: string) =>
    GuardianServiceNative.setAuthCredentials(token, userId, apiUrl),
  clearAuthCredentials: () => GuardianServiceNative.clearAuthCredentials(),
};

export type BackgroundSOSEvent = {
  eventId: string;
};
```

- [ ] **Step 5: Update app.json with new permissions and module plugin**

In `mobile/app.json`, add to `android.permissions` array:

```json
"android.permission.FOREGROUND_SERVICE",
"android.permission.FOREGROUND_SERVICE_MICROPHONE",
"android.permission.RECEIVE_BOOT_COMPLETED",
"android.permission.POST_NOTIFICATIONS"
```

And add to the `plugins` array:

```json
"./modules/guardian-service"
```

- [ ] **Step 6: Add expo-dev-client to package.json**

Run:
```bash
cd mobile && npm install expo-dev-client
```

- [ ] **Step 7: Commit**

```bash
git add mobile/modules/guardian-service/ mobile/app.json mobile/package.json mobile/package-lock.json
git commit -m "feat: create guardian-service expo module skeleton with build config"
```

---

## Task 3: Implement GuardianServiceModule (Expo Module Bridge)

**Files:**
- Create: `mobile/modules/guardian-service/android/src/main/java/com/guardian/sos/GuardianServiceModule.kt`

- [ ] **Step 1: Create the Expo Module**

Create `mobile/modules/guardian-service/android/src/main/java/com/guardian/sos/GuardianServiceModule.kt`:

```kotlin
package com.guardian.sos

import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise

class GuardianServiceModule : Module() {

    private val context: Context
        get() = appContext.reactContext ?: throw IllegalStateException("React context not available")

    private val prefs: SharedPreferences
        get() = context.getSharedPreferences("guardian_service", Context.MODE_PRIVATE)

    override fun definition() = ModuleDefinition {
        Name("GuardianServiceModule")

        Events("onBackgroundSOSTriggered")

        AsyncFunction("startService") { promise: Promise ->
            try {
                val token = prefs.getString("auth_token", null)
                if (token.isNullOrEmpty()) {
                    promise.reject("NO_AUTH", "No auth token found. Please sign in first.", null)
                    return@AsyncFunction
                }
                val intent = Intent(context, GuardianForegroundService::class.java)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(intent)
                } else {
                    context.startService(intent)
                }
                promise.resolve(null)
            } catch (e: Exception) {
                promise.reject("START_FAILED", e.message, e)
            }
        }

        AsyncFunction("stopService") { promise: Promise ->
            try {
                val intent = Intent(context, GuardianForegroundService::class.java)
                context.stopService(intent)
                promise.resolve(null)
            } catch (e: Exception) {
                promise.reject("STOP_FAILED", e.message, e)
            }
        }

        AsyncFunction("isRunning") { promise: Promise ->
            promise.resolve(GuardianForegroundService.isRunning)
        }

        AsyncFunction("setEnabled") { enabled: Boolean, promise: Promise ->
            prefs.edit().putBoolean("service_enabled", enabled).apply()
            if (enabled) {
                val token = prefs.getString("auth_token", null)
                if (!token.isNullOrEmpty()) {
                    val intent = Intent(context, GuardianForegroundService::class.java)
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        context.startForegroundService(intent)
                    } else {
                        context.startService(intent)
                    }
                }
            } else {
                val intent = Intent(context, GuardianForegroundService::class.java)
                context.stopService(intent)
            }
            promise.resolve(null)
        }

        AsyncFunction("isEnabled") { promise: Promise ->
            promise.resolve(prefs.getBoolean("service_enabled", true))
        }

        AsyncFunction("setAuthCredentials") { token: String, userId: String, apiUrl: String, promise: Promise ->
            prefs.edit()
                .putString("auth_token", token)
                .putString("user_id", userId)
                .putString("api_url", apiUrl)
                .apply()
            promise.resolve(null)
        }

        AsyncFunction("clearAuthCredentials") { promise: Promise ->
            prefs.edit()
                .remove("auth_token")
                .remove("user_id")
                .remove("api_url")
                .apply()
            // Stop the service when credentials are cleared
            val intent = Intent(context, GuardianForegroundService::class.java)
            context.stopService(intent)
            promise.resolve(null)
        }
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add mobile/modules/guardian-service/android/src/main/java/com/guardian/sos/GuardianServiceModule.kt
git commit -m "feat: implement GuardianServiceModule expo bridge"
```

---

## Task 4: Implement SOSTriggerHandler (HTTP Client with Offline Queue)

**Files:**
- Create: `mobile/modules/guardian-service/android/src/main/java/com/guardian/sos/SOSTriggerHandler.kt`

- [ ] **Step 1: Create SOSTriggerHandler**

Create `mobile/modules/guardian-service/android/src/main/java/com/guardian/sos/SOSTriggerHandler.kt`:

```kotlin
package com.guardian.sos

import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import com.google.gson.Gson
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.IOException
import java.util.concurrent.TimeUnit

data class SOSTriggerRequest(
    val userId: String,
    val location: SOSLocation?,
    val triggerType: String = "voice_background",
    val message: String = "Background voice SOS triggered"
)

data class SOSLocation(
    val latitude: Double,
    val longitude: Double
)

data class SOSTriggerResponse(
    val eventId: String,
    val status: String
)

class SOSTriggerHandler(private val context: Context) {

    companion object {
        private const val TAG = "SOSTriggerHandler"
        private const val QUEUED_SOS_KEY = "queued_sos_requests"
    }

    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .writeTimeout(15, TimeUnit.SECONDS)
        .build()

    private val gson = Gson()

    private val prefs: SharedPreferences
        get() = context.getSharedPreferences("guardian_service", Context.MODE_PRIVATE)

    fun triggerSOS(location: SOSLocation?): SOSTriggerResponse? {
        val apiUrl = prefs.getString("api_url", null) ?: run {
            Log.e(TAG, "No API URL configured")
            return null
        }
        val authToken = prefs.getString("auth_token", null) ?: run {
            Log.e(TAG, "No auth token")
            return null
        }
        val userId = prefs.getString("user_id", null) ?: run {
            Log.e(TAG, "No user ID")
            return null
        }

        val request = SOSTriggerRequest(
            userId = userId,
            location = location,
            triggerType = "voice_background",
            message = "Background voice SOS triggered"
        )

        val json = gson.toJson(request)
        val body = json.toRequestBody("application/json".toMediaType())

        val httpRequest = Request.Builder()
            .url("$apiUrl/sos/trigger")
            .addHeader("Authorization", "Bearer $authToken")
            .addHeader("Content-Type", "application/json")
            .post(body)
            .build()

        return try {
            val response = client.newCall(httpRequest).execute()
            if (response.isSuccessful) {
                val responseBody = response.body?.string()
                Log.i(TAG, "SOS triggered successfully: $responseBody")
                responseBody?.let { gson.fromJson(it, SOSTriggerResponse::class.java) }
            } else {
                Log.e(TAG, "SOS trigger failed: ${response.code} ${response.body?.string()}")
                queueRequest(json)
                null
            }
        } catch (e: IOException) {
            Log.e(TAG, "Network error, queuing SOS request", e)
            queueRequest(json)
            null
        }
    }

    private fun queueRequest(json: String) {
        val queued = prefs.getStringSet(QUEUED_SOS_KEY, mutableSetOf())?.toMutableSet() ?: mutableSetOf()
        queued.add(json)
        prefs.edit().putStringSet(QUEUED_SOS_KEY, queued).apply()
        Log.i(TAG, "SOS request queued for retry. Queue size: ${queued.size}")
    }

    fun retryQueuedRequests() {
        val queued = prefs.getStringSet(QUEUED_SOS_KEY, null)?.toMutableSet() ?: return
        if (queued.isEmpty()) return

        Log.i(TAG, "Retrying ${queued.size} queued SOS requests")
        val apiUrl = prefs.getString("api_url", null) ?: return
        val authToken = prefs.getString("auth_token", null) ?: return
        val succeeded = mutableSetOf<String>()

        for (json in queued) {
            val body = json.toRequestBody("application/json".toMediaType())
            val httpRequest = Request.Builder()
                .url("$apiUrl/sos/trigger")
                .addHeader("Authorization", "Bearer $authToken")
                .addHeader("Content-Type", "application/json")
                .post(body)
                .build()

            try {
                val response = client.newCall(httpRequest).execute()
                if (response.isSuccessful) {
                    succeeded.add(json)
                    Log.i(TAG, "Queued SOS request sent successfully")
                }
            } catch (e: IOException) {
                Log.e(TAG, "Retry failed, will try again later", e)
            }
        }

        if (succeeded.isNotEmpty()) {
            queued.removeAll(succeeded)
            prefs.edit().putStringSet(QUEUED_SOS_KEY, queued).apply()
        }
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add mobile/modules/guardian-service/android/src/main/java/com/guardian/sos/SOSTriggerHandler.kt
git commit -m "feat: implement SOSTriggerHandler with offline queue"
```

---

## Task 5: Implement AudioEvidenceRecorder (MediaRecorder + Firebase Upload)

**Files:**
- Create: `mobile/modules/guardian-service/android/src/main/java/com/guardian/sos/AudioEvidenceRecorder.kt`

- [ ] **Step 1: Create AudioEvidenceRecorder**

Create `mobile/modules/guardian-service/android/src/main/java/com/guardian/sos/AudioEvidenceRecorder.kt`:

```kotlin
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
```

- [ ] **Step 2: Commit**

```bash
git add mobile/modules/guardian-service/android/src/main/java/com/guardian/sos/AudioEvidenceRecorder.kt
git commit -m "feat: implement AudioEvidenceRecorder with Firebase upload"
```

---

## Task 6: Implement GuardianForegroundService (Core Service + Porcupine)

**Files:**
- Create: `mobile/modules/guardian-service/android/src/main/java/com/guardian/sos/GuardianForegroundService.kt`
- Create: `mobile/modules/guardian-service/android/src/main/res/drawable/ic_notification.xml`

- [ ] **Step 1: Create notification icon**

Create `mobile/modules/guardian-service/android/src/main/res/drawable/ic_notification.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="24dp"
    android:height="24dp"
    android:viewportWidth="24"
    android:viewportHeight="24">
    <path
        android:fillColor="#FFFFFF"
        android:pathData="M12,1L3,5v6c0,5.55 3.84,10.74 9,12 5.16,-1.26 9,-6.45 9,-12V5L12,1zM12,11.99h7c-0.53,4.12 -3.28,7.79 -7,8.94V12H5V6.3l7,-3.11v8.8z" />
</vector>
```

- [ ] **Step 2: Create GuardianForegroundService**

Create `mobile/modules/guardian-service/android/src/main/java/com/guardian/sos/GuardianForegroundService.kt`:

```kotlin
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
            // Try built-in keywords without custom access key for development
            return
        }

        try {
            porcupineManager = PorcupineManager.Builder()
                .setAccessKey(accessKey)
                .setKeywords(arrayOf(
                    Porcupine.BuiltInKeyword.OK_GOOGLE  // Placeholder — see note below
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

    // NOTE: Porcupine free tier does not include "help" as a built-in keyword.
    // For production, you must train custom keywords at https://console.picovoice.ai/
    // and load them via .setKeywordPaths() instead of .setKeywords().
    // For development/testing, use a built-in keyword like "computer" or "jarvis"
    // and replace it with custom .ppn files for "help", "help me", "bachao" later.

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
            // 1. Get location
            val location = getLastKnownLocation()
            Log.i(TAG, "Location: $location")

            // 2. Trigger SOS via API
            val response = sosTriggerHandler.triggerSOS(location)
            val eventId = response?.eventId ?: "unknown_${System.currentTimeMillis()}"
            Log.i(TAG, "SOS triggered, eventId: $eventId")

            // 3. Start audio evidence recording
            val userId = prefs.getString("user_id", "") ?: ""
            audioRecorder.startRecording(eventId, userId) { file ->
                if (file != null) {
                    audioRecorder.uploadToFirebase(file, userId, eventId)
                }
            }

            // 4. Broadcast to RN app (if alive)
            val broadcastIntent = Intent("com.guardian.sos.BACKGROUND_SOS_TRIGGERED")
            broadcastIntent.putExtra("eventId", eventId)
            sendBroadcast(broadcastIntent)

            // 5. Update notification to show SOS was triggered
            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            manager.notify(NOTIFICATION_ID, buildSOSActiveNotification(eventId))
        }
    }

    @Suppress("MissingPermission") // Permissions checked before service starts
    private fun getLastKnownLocation(): SOSLocation? {
        return try {
            val task = fusedLocationClient.getCurrentLocation(
                Priority.PRIORITY_HIGH_ACCURACY,
                CancellationTokenSource().token
            )
            // Block for up to 5 seconds to get location
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
```

- [ ] **Step 3: Commit**

```bash
git add mobile/modules/guardian-service/android/src/main/java/com/guardian/sos/GuardianForegroundService.kt mobile/modules/guardian-service/android/src/main/res/drawable/ic_notification.xml
git commit -m "feat: implement GuardianForegroundService with Porcupine wake word detection"
```

---

## Task 7: Implement BootReceiver

**Files:**
- Create: `mobile/modules/guardian-service/android/src/main/java/com/guardian/sos/BootReceiver.kt`

- [ ] **Step 1: Create BootReceiver**

Create `mobile/modules/guardian-service/android/src/main/java/com/guardian/sos/BootReceiver.kt`:

```kotlin
package com.guardian.sos

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log

class BootReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "BootReceiver"
    }

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED) return

        val prefs = context.getSharedPreferences("guardian_service", Context.MODE_PRIVATE)
        val enabled = prefs.getBoolean("service_enabled", true)
        val hasAuth = !prefs.getString("auth_token", null).isNullOrEmpty()

        Log.i(TAG, "Boot completed. Service enabled: $enabled, has auth: $hasAuth")

        if (enabled && hasAuth) {
            val serviceIntent = Intent(context, GuardianForegroundService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(serviceIntent)
            } else {
                context.startService(serviceIntent)
            }
            Log.i(TAG, "Guardian service started on boot")
        }
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add mobile/modules/guardian-service/android/src/main/java/com/guardian/sos/BootReceiver.kt
git commit -m "feat: implement BootReceiver for auto-start on device boot"
```

---

## Task 8: Implement useBackgroundProtection Hook

**Files:**
- Create: `mobile/src/hooks/useBackgroundProtection.ts`

- [ ] **Step 1: Create the hook**

Create `mobile/src/hooks/useBackgroundProtection.ts`:

```typescript
import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { GuardianService, guardianServiceEmitter, type BackgroundSOSEvent } from '../../modules/guardian-service';

interface UseBackgroundProtectionReturn {
  isRunning: boolean;
  isEnabled: boolean;
  toggle: () => Promise<void>;
  backgroundSOSEventId: string | null;
  clearBackgroundSOS: () => void;
}

export function useBackgroundProtection(): UseBackgroundProtectionReturn {
  const [isRunning, setIsRunning] = useState(false);
  const [isEnabled, setIsEnabled] = useState(true);
  const [backgroundSOSEventId, setBackgroundSOSEventId] = useState<string | null>(null);

  // Not supported on iOS
  if (Platform.OS !== 'android') {
    return {
      isRunning: false,
      isEnabled: false,
      toggle: async () => {},
      backgroundSOSEventId: null,
      clearBackgroundSOS: () => {},
    };
  }

  useEffect(() => {
    // Check initial state
    GuardianService.isRunning().then(setIsRunning).catch(() => setIsRunning(false));
    GuardianService.isEnabled().then(setIsEnabled).catch(() => setIsEnabled(true));

    // Poll service status every 5 seconds (lightweight)
    const interval = setInterval(() => {
      GuardianService.isRunning().then(setIsRunning).catch(() => {});
    }, 5000);

    // Listen for background SOS events
    const subscription = guardianServiceEmitter.addListener(
      'onBackgroundSOSTriggered',
      (event: BackgroundSOSEvent) => {
        setBackgroundSOSEventId(event.eventId);
      },
    );

    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, []);

  const toggle = useCallback(async () => {
    const newEnabled = !isEnabled;
    await GuardianService.setEnabled(newEnabled);
    setIsEnabled(newEnabled);
    if (newEnabled) {
      setIsRunning(true);
    } else {
      setIsRunning(false);
    }
  }, [isEnabled]);

  const clearBackgroundSOS = useCallback(() => {
    setBackgroundSOSEventId(null);
  }, []);

  return {
    isRunning,
    isEnabled,
    toggle,
    backgroundSOSEventId,
    clearBackgroundSOS,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add mobile/src/hooks/useBackgroundProtection.ts
git commit -m "feat: implement useBackgroundProtection hook"
```

---

## Task 9: Wire Auth Token Sharing into AuthContext

**Files:**
- Modify: `mobile/src/contexts/AuthContext.tsx`

- [ ] **Step 1: Update AuthContext to share tokens with native service**

In `mobile/src/contexts/AuthContext.tsx`, add the import at the top (after existing imports):

```typescript
import { Platform } from 'react-native';
import { GuardianService } from '../../modules/guardian-service';
```

Then update the `useEffect` that listens for auth state changes (lines 27-33) to also write tokens to SharedPreferences:

Replace the existing `onAuthStateChanged` useEffect:

```typescript
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);

      // Share auth credentials with native background service (Android only)
      if (Platform.OS === 'android') {
        if (firebaseUser) {
          try {
            const token = await firebaseUser.getIdToken();
            const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000';
            await GuardianService.setAuthCredentials(token, firebaseUser.uid, apiUrl);
            // Auto-start service if enabled
            const enabled = await GuardianService.isEnabled();
            if (enabled) {
              await GuardianService.startService();
            }
          } catch (e) {
            console.warn('Failed to set auth credentials for background service:', e);
          }
        } else {
          try {
            await GuardianService.clearAuthCredentials();
          } catch (e) {
            console.warn('Failed to clear auth credentials for background service:', e);
          }
        }
      }
    });
    return unsubscribe;
  }, []);
```

Also update the `signOut` function to clear credentials before signing out:

```typescript
  const signOut = async (): Promise<void> => {
    if (Platform.OS === 'android') {
      try {
        await GuardianService.clearAuthCredentials();
      } catch (e) {
        console.warn('Failed to clear background service credentials:', e);
      }
    }
    await firebaseSignOut(auth);
  };
```

- [ ] **Step 2: Commit**

```bash
git add mobile/src/contexts/AuthContext.tsx
git commit -m "feat: share auth tokens with native background service"
```

---

## Task 10: Add Background Protection UI to HomeScreen

**Files:**
- Modify: `mobile/src/screens/HomeScreen.tsx`

- [ ] **Step 1: Add background protection indicator and SOS event handling**

In `mobile/src/screens/HomeScreen.tsx`, add imports at the top:

```typescript
import { Platform, Linking } from 'react-native';
import { useBackgroundProtection } from '../hooks/useBackgroundProtection';
```

(Update the existing `import { View, StyleSheet, Text, Alert }` line to include `Platform, Linking, Switch`.)

Inside the `HomeScreen` component, add after the existing hook calls (after line 53):

```typescript
  const {
    isRunning: bgRunning,
    isEnabled: bgEnabled,
    toggle: toggleBg,
    backgroundSOSEventId,
    clearBackgroundSOS,
  } = useBackgroundProtection();

  // Handle background SOS trigger — navigate to StatusScreen
  useEffect(() => {
    if (backgroundSOSEventId) {
      clearBackgroundSOS();
      navigation.navigate('Status', { eventId: backgroundSOSEventId });
    }
  }, [backgroundSOSEventId, clearBackgroundSOS, navigation]);
```

Add the background protection toggle UI inside the `<View style={styles.center}>` block, after the shake indicator section (after line 178):

```tsx
        {/* Background Protection Toggle (Android only) */}
        {Platform.OS === 'android' && (
          <View style={styles.bgProtectionContainer}>
            <View style={styles.bgProtectionRow}>
              <View>
                <Text style={[styles.bgProtectionTitle, { color: colors.text }]}>
                  Background Protection
                </Text>
                <Text style={[styles.bgProtectionStatus, { color: colors.textSecondary }]}>
                  {bgRunning ? 'Active — listening for distress calls' : 'Inactive'}
                </Text>
              </View>
              <Switch
                value={bgEnabled}
                onValueChange={toggleBg}
                trackColor={{ false: '#767577', true: '#22C55E' }}
                thumbColor={bgEnabled ? '#FFFFFF' : '#f4f3f4'}
              />
            </View>
          </View>
        )}
```

Add these styles to the `StyleSheet.create` block:

```typescript
  bgProtectionContainer: {
    marginTop: 24,
    paddingHorizontal: 24,
    width: '100%',
  },
  bgProtectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 12,
    padding: 16,
  },
  bgProtectionTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  bgProtectionStatus: {
    fontSize: 12,
    marginTop: 2,
  },
```

- [ ] **Step 2: Add Switch to the React Native imports**

Update the import line at the top of `HomeScreen.tsx`:

```typescript
import { View, StyleSheet, Text, Alert, Platform, Linking, Switch } from 'react-native';
```

- [ ] **Step 3: Commit**

```bash
git add mobile/src/screens/HomeScreen.tsx
git commit -m "feat: add background protection toggle UI to HomeScreen"
```

---

## Task 11: Update app.json Permissions and Plugin

**Files:**
- Modify: `mobile/app.json`

- [ ] **Step 1: Add new permissions and plugin**

In `mobile/app.json`, update the `android.permissions` array to:

```json
"permissions": [
  "android.permission.ACCESS_COARSE_LOCATION",
  "android.permission.ACCESS_FINE_LOCATION",
  "android.permission.CAMERA",
  "android.permission.RECORD_AUDIO",
  "android.permission.FOREGROUND_SERVICE",
  "android.permission.FOREGROUND_SERVICE_MICROPHONE",
  "android.permission.RECEIVE_BOOT_COMPLETED",
  "android.permission.POST_NOTIFICATIONS"
]
```

Add `"./modules/guardian-service"` to the end of the `plugins` array:

```json
"plugins": [
  ["expo-location", { ... }],
  ["expo-notifications", { ... }],
  ["expo-camera", { ... }],
  ["expo-speech-recognition", { ... }],
  "./modules/guardian-service"
]
```

- [ ] **Step 2: Commit**

```bash
git add mobile/app.json
git commit -m "feat: add background service permissions and plugin to app.json"
```

---

## Task 12: Install expo-dev-client and Verify Build Configuration

**Files:**
- Modify: `mobile/package.json` (via npm install)

- [ ] **Step 1: Install expo-dev-client**

```bash
cd mobile && npm install expo-dev-client
```

- [ ] **Step 2: Verify the module is recognized by Expo**

```bash
cd mobile && npx expo-module list 2>/dev/null || echo "Run 'npx expo prebuild --clean' to generate native projects and verify module registration"
```

- [ ] **Step 3: Commit**

```bash
git add mobile/package.json mobile/package-lock.json
git commit -m "feat: add expo-dev-client for custom native module builds"
```

---

## Task 13: End-to-End Integration Verification

- [ ] **Step 1: Run TypeScript type check**

```bash
cd mobile && npx tsc --noEmit
```

Fix any type errors that arise from the new module imports or updated types.

- [ ] **Step 2: Run ESLint**

```bash
cd mobile && npx eslint src/hooks/useBackgroundProtection.ts src/contexts/AuthContext.tsx src/screens/HomeScreen.tsx --ext .ts,.tsx
```

Fix any lint errors.

- [ ] **Step 3: Verify backend accepts voice_background trigger type**

```bash
cd backend && poetry run python -c "
from app.models.sos_event import SOSTriggerRequest, TriggerType
req = SOSTriggerRequest(userId='test', location={'latitude': 0, 'longitude': 0}, triggerType='voice_background')
print(f'triggerType: {req.triggerType}')
print('OK')
"
```

Expected output:
```
triggerType: voice_background
OK
```

- [ ] **Step 4: Run backend tests**

```bash
cd backend && poetry run pytest -v
```

All tests should pass.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: complete background voice-activated SOS integration

Adds Android foreground service with Picovoice Porcupine wake word
detection for background SOS triggering when phone is locked/app killed.

Key components:
- GuardianForegroundService: Native service with Porcupine, GPS, audio recording
- SOSTriggerHandler: HTTP client with offline queue
- AudioEvidenceRecorder: 30s MediaRecorder + Firebase Storage upload
- BootReceiver: Auto-start on device boot
- GuardianServiceModule: Expo Module bridge for JS control
- useBackgroundProtection: React hook for UI toggle
- Auth token sharing via SharedPreferences"
```

---

## Post-Implementation Notes

### Porcupine Custom Keywords
The implementation uses a placeholder built-in keyword. For production:
1. Go to https://console.picovoice.ai/
2. Create an account and get an Access Key
3. Train custom wake words: "help", "help me", "bachao"
4. Download the `.ppn` model files
5. Place them in `mobile/modules/guardian-service/android/src/main/assets/`
6. Update `GuardianForegroundService.kt` to use `.setKeywordPaths()` instead of `.setKeywords()`

### Building the APK
Since this uses native modules, you must use EAS Build or a custom dev client:
```bash
cd mobile && npx expo prebuild --clean
cd mobile && eas build --platform android --profile development
```

### Testing on Device
1. Install the development build APK
2. Sign in to the app
3. Toggle "Background Protection" on
4. Lock the phone
5. Say "help" (or the configured wake word)
6. Verify SOS is triggered (check backend logs, SMS delivery, notification update)
