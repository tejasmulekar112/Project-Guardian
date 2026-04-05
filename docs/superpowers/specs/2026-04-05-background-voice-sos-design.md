# Background Voice-Activated SOS Design

**Date:** 2026-04-05
**Status:** Approved
**Platform:** Android only (iOS does not support continuous background mic access)

## Overview

Enable the Guardian app to listen for distress wake words ("help", "help me", "bachao") even when the phone is locked or the app is in the background. On detection, immediately trigger a full SOS (API call + SMS + audio evidence) without user confirmation.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Dev workflow | Custom Dev Client (`expo-dev-client`) | Allows native modules while staying in Expo ecosystem |
| Wake word engine | Picovoice Porcupine | Purpose-built for always-on listening, ~1-2% battery, <100ms detection |
| Confirmation | Immediate trigger, no countdown | Speed matters in danger; phone may be locked |
| Actions on trigger | Full: API + SMS + audio evidence | Maximum protection |
| Auto-start | On boot, user can toggle off | Always-on protection by default |
| Architecture | Native Android Foreground Service | Only approach Android guarantees won't be killed |
| Auth sharing | SharedPreferences bridge | Native service reads tokens written by RN |
| Offline handling | Queue + retry | SOS queued locally, sent when connectivity returns |

## Architecture

```
┌─────────────────────────────────────────────────┐
│                 Android OS                       │
│                                                  │
│  ┌───────────────────────────────────────────┐   │
│  │     GuardianForegroundService (Kotlin)     │   │
│  │                                            │   │
│  │  ┌──────────────┐  ┌───────────────────┐  │   │
│  │  │  Porcupine   │  │  AudioRecorder    │  │   │
│  │  │  Wake Word   │  │  (evidence capture)│  │   │
│  │  │  Engine      │  │                    │  │   │
│  │  └──────┬───────┘  └───────────────────┘  │   │
│  │         │ keyword detected                 │   │
│  │         ▼                                  │   │
│  │  ┌──────────────┐  ┌───────────────────┐  │   │
│  │  │  SOS Trigger │──▶│  Location Manager │  │   │
│  │  │  (HTTP call) │  │  (last known GPS) │  │   │
│  │  └──────────────┘  └───────────────────┘  │   │
│  └───────────────────────────────────────────┘   │
│                                                  │
│  ┌───────────────────────────────────────────┐   │
│  │     BootReceiver (Kotlin)                  │   │
│  │     Starts service on device boot          │   │
│  └───────────────────────────────────────────┘   │
│                                                  │
│  ┌───────────────────────────────────────────┐   │
│  │     React Native App (JS/TS)               │   │
│  │                                            │   │
│  │  ┌──────────────────────────────────────┐ │   │
│  │  │  GuardianServiceModule (Expo Module) │ │   │
│  │  │  - startService() / stopService()    │ │   │
│  │  │  - isRunning()                       │ │   │
│  │  │  - onSOSTriggered event listener     │ │   │
│  │  └──────────────────────────────────────┘ │   │
│  └───────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

The native Foreground Service runs independently of React Native. It contains Porcupine, GPS, HTTP client, and audio recorder. When the wake word is detected, it triggers SOS entirely from native code — no dependency on the React Native JS bridge.

## Native Components (Kotlin)

### 1. GuardianForegroundService

- Android `Service` with `START_STICKY` (OS restarts if killed)
- Shows persistent notification: "Guardian is protecting you"
- Initializes Porcupine with keywords: `"help"`, `"help me"`, `"bachao"`
- On wake word detected:
  1. Get last known location via `FusedLocationProviderClient`
  2. Start 30s audio recording via `MediaRecorder`
  3. Fire `POST /sos/trigger` with location + trigger type `"voice_background"`
  4. Upload audio evidence to Firebase Storage
  5. Send broadcast to React Native (if app is alive) to navigate to StatusScreen

### 2. BootReceiver

- `BroadcastReceiver` listening for `BOOT_COMPLETED`
- Checks SharedPreferences for user's toggle setting
- Starts `GuardianForegroundService` if enabled

### 3. GuardianServiceModule (Expo Module Bridge)

Exposes to JavaScript:
- `startService()` — starts the foreground service
- `stopService()` — stops it
- `isRunning(): boolean` — check service state
- `setEnabled(enabled: boolean)` — persist auto-start preference
- `isEnabled(): boolean` — read preference
- Event: `onBackgroundSOSTriggered(eventId)` — emitted to JS when SOS fires

### 4. SOSTriggerHandler

- Builds and sends `POST /sos/trigger` request using OkHttp
- Reads backend URL and auth token from SharedPreferences
- On network failure: queues request to SharedPreferences, retries on connectivity change

### 5. AudioEvidenceRecorder

- Records 30s audio via `MediaRecorder`
- Saves to: `/data/com.guardian.sos/evidence/{eventId}/audio_bg.m4a`
- Uploads to Firebase Storage: `evidence/{userId}/{eventId}/audio_bg.m4a`
- Writes metadata to Firestore: `sos_events/{eventId}/evidence`

## React Native / JS Side

### useBackgroundProtection Hook

- Calls `GuardianServiceModule.startService()` on app launch
- Provides `{ isRunning, isEnabled, toggle }` state to UI
- Listens for `onBackgroundSOSTriggered` events to navigate to StatusScreen

### Settings UI

- Toggle switch: "Background Protection" (on HomeScreen or dedicated Settings screen)
- Shows service status (running/stopped)
- Info text explaining battery usage and persistent notification

## Auth Token Sharing

- On login: RN writes Firebase auth token + user ID to SharedPreferences via bridge module
- On token refresh: RN updates SharedPreferences
- Service reads from SharedPreferences directly
- On logout: RN clears SharedPreferences, service stops itself

## Background SOS Trigger Flow

```
Phone locked / App killed
        │
Porcupine detects "help"
        │
        ▼
GuardianForegroundService
        │
        ├─► Get last known GPS location
        │   (FusedLocationProviderClient)
        │
        ├─► POST /sos/trigger
        │   {
        │     triggerType: "voice_background",
        │     location: { lat, lng },
        │     message: "Background voice SOS triggered"
        │   }
        │
        ├─► Start 30s audio recording
        │   Save to: /data/com.guardian.sos/evidence/{eventId}/
        │
        ├─► Upload audio to Firebase Storage
        │   Path: evidence/{userId}/{eventId}/audio_bg.m4a
        │
        ├─► Write metadata to Firestore
        │   sos_events/{eventId}/evidence
        │
        └─► Send broadcast to RN app (if alive)
            → Navigate to StatusScreen
```

## Edge Cases

| Scenario | Handling |
|----------|----------|
| No internet | Queue SOS in SharedPreferences, retry on connectivity. Audio saved locally, uploaded later. |
| No GPS fix | Send SOS with `location: null`, backend handles gracefully |
| User not logged in | Service reads auth token from SharedPreferences. If no token, service doesn't start. |
| Service killed by OS | `START_STICKY` makes OS restart it. Boot receiver also restarts on reboot. |
| Battery saver mode | Request user to whitelist app from battery optimization during onboarding |
| Multiple triggers | 30-second cooldown after each trigger to prevent spam |
| Porcupine API key missing | Service logs error, falls back to disabled, notifies user via notification |
| Firebase token expired | Service refreshes token using stored refresh credentials |

## Android Permissions Required

```xml
android.permission.FOREGROUND_SERVICE
android.permission.FOREGROUND_SERVICE_MICROPHONE
android.permission.RECEIVE_BOOT_COMPLETED
android.permission.POST_NOTIFICATIONS          <!-- Android 13+ -->
```

Existing permissions already declared:
- `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`
- `RECORD_AUDIO`, `CAMERA`

## New Dependencies

| Package | Purpose |
|---------|---------|
| Porcupine Android SDK (native, in service) | Wake word engine |
| `@picovoice/porcupine-react-native` | JS bindings for settings/status |
| `expo-dev-client` | Custom dev builds with native modules |
| OkHttp (Android native) | HTTP client in service |
| Firebase Android SDK (native) | Storage upload + Firestore from service |

## File Structure

```
mobile/
├── modules/
│   └── guardian-service/
│       ├── android/
│       │   └── src/main/java/com/guardian/sos/
│       │       ├── GuardianForegroundService.kt
│       │       ├── BootReceiver.kt
│       │       ├── GuardianServiceModule.kt
│       │       ├── SOSTriggerHandler.kt
│       │       └── AudioEvidenceRecorder.kt
│       ├── expo-module.config.json
│       └── index.ts
├── src/
│   └── hooks/
│       └── useBackgroundProtection.ts
```

## Battery & Performance

| Component | Drain | Notes |
|-----------|-------|-------|
| Porcupine wake word engine | ~1-2%/day | Uses DSP/low-power core when available |
| Foreground service (idle) | <1%/day | Just keeps process alive |
| Audio recording (30s on trigger) | Negligible | Only during SOS |
| GPS fetch (on trigger) | Negligible | Single request |
| **Total estimated** | **~2-3%/day** | Acceptable for safety app |

### Battery Optimization Onboarding

On first enable, show prompt:
> "Background Protection uses ~2-3% battery per day to keep you safe. For reliable protection, please disable battery optimization for Guardian."
>
> [Open Battery Settings] [Skip]

Opens Android battery optimization whitelist screen for the app.
