# Lock Screen Voice Trigger — Design Spec

**Date:** 2026-04-08
**Phase:** 5
**Platform:** Android only
**Approach:** Vosk offline speech recognition

## Overview

Enable SOS triggering via voice ("help", "emergency", "save me") when the phone is locked, using an always-on Android foreground service with offline speech recognition. No internet required.

## Architecture

```
┌─────────────────────────────────────────────┐
│            Android Foreground Service        │
│  ┌───────────┐    ┌──────────────────────┐  │
│  │ Microphone │───>│  Vosk Speech Engine  │  │
│  │(AudioRecord)   │  (Small EN model)    │  │
│  └───────────┘    └──────────┬───────────┘  │
│                              │               │
│                   ┌──────────▼───────────┐  │
│                   │  Keyword Detector    │  │
│                   │  "help"/"emergency"  │  │
│                   └──────────┬───────────┘  │
│                              │ match found   │
│                   ┌──────────▼───────────┐  │
│                   │  Trigger SOS via     │  │
│                   │  React Native Bridge │  │
│                   └──────────────────────┘  │
└─────────────────────────────────────────────┘
                       │
          ┌────────────▼────────────┐
          │   Existing SOS Flow     │
          │  (API call, SMS, FCM)   │
          └─────────────────────────┘
```

## Components

### Native Side (Kotlin)

#### VoskListenerService.kt — Foreground Service
- Runs as an Android foreground service with `FOREGROUND_SERVICE_MICROPHONE` type
- Captures audio via `AudioRecord` (16kHz, mono, 16-bit PCM)
- Feeds audio buffer to Vosk `Recognizer` in a loop
- Checks partial and final results against trigger keywords
- On keyword match: vibrates, sends broadcast to React Native
- Shows persistent notification: "Guardian Active — Voice protection is on" with "Stop" action

#### VoskModule.kt — React Native Bridge
- `startListening()` — starts the foreground service
- `stopListening()` — stops the foreground service
- `isListening()` — returns service status
- `setKeywords(keywords: string[])` — configure trigger words
- Emits `onVoskTrigger` event to JS when keyword detected

#### VoskPackage.kt — Module Registration
- Registers `VoskModule` with React Native

#### BootReceiver.kt — Auto-start on Boot
- Listens for `BOOT_COMPLETED` broadcast
- Checks AsyncStorage for `lockScreenVoiceEnabled` setting
- Starts `VoskListenerService` if enabled

### Expo Config Plugin
- `withVoskPlugin.ts` — Expo config plugin that modifies `AndroidManifest.xml`:
  - Adds permissions: `RECORD_AUDIO`, `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_MICROPHONE`, `RECEIVE_BOOT_COMPLETED`
  - Registers `VoskListenerService` as a foreground service
  - Registers `BootReceiver` for `BOOT_COMPLETED`

### React Native Side

#### useVoskBackground.ts — Hook
- Wraps `VoskModule` native calls
- `startVoskListening()` / `stopVoskListening()`
- Listens for `onVoskTrigger` events
- On trigger received:
  - If app is in foreground: show `CountdownOverlay` (reuse existing)
  - If app is in background/locked: trigger SOS directly via existing `api.triggerSOS()`

#### SettingsScreen.tsx — New Toggle
- "Lock Screen Voice Detection" toggle (default: off)
- Saves `lockScreenVoiceEnabled` to AsyncStorage
- Starting toggle requests `RECORD_AUDIO` permission if not granted
- Shows explanation text: "Keeps microphone active to detect distress keywords even when phone is locked. Uses more battery."

## Trigger Keywords

Case-insensitive matching against Vosk transcript:
- `help`
- `help me`
- `somebody help`
- `emergency`
- `save me`

## False Positive Protection

1. **Cooldown period:** 30-second cooldown after a trigger — ignore duplicates
2. **Countdown overlay:** When app is in foreground, user has countdown window to cancel
3. **Notification cancel:** "Cancel" action on the trigger notification
4. **Keyword specificity:** Only exact keyword matches, not substrings of longer words

## Vosk Model

- Model: `vosk-model-small-en-us-0.15` (~40MB)
- Bundled as Android asset in `android/app/src/main/assets/model-en/`
- Already present in repo as `vosk-model-small-en-us-0.15.zip`
- Offline-only, no network calls

## Persistent Notification

- **Channel:** "Guardian Protection"
- **Title:** "Guardian Active"
- **Body:** "Voice protection is on"
- **Actions:** "Stop" button to disable the service
- **Priority:** Low (minimal visual intrusion)

## Settings Integration

New AsyncStorage key: `lockScreenVoiceEnabled` (boolean, default: `false`)

Behavior:
- When enabled: service starts immediately and on device boot
- When disabled: service stops immediately
- Setting persists across app restarts

## Android Permissions Required

| Permission | Purpose |
|-----------|---------|
| `RECORD_AUDIO` | Microphone access for Vosk |
| `FOREGROUND_SERVICE` | Run persistent service |
| `FOREGROUND_SERVICE_MICROPHONE` | Foreground service type |
| `RECEIVE_BOOT_COMPLETED` | Auto-start on device boot |
| `VIBRATE` | Feedback on trigger detection |

## Impact

- **App size:** +~40MB (Vosk model)
- **Battery:** Moderate increase when enabled (continuous audio processing)
- **Privacy:** All processing on-device, no audio leaves the phone
- **Expo compatibility:** Requires custom dev client (already using one for EAS builds)

## File Structure

```
mobile/
├── android/app/src/main/
│   ├── assets/model-en/          # Vosk model files
│   └── java/com/guardian/mobile/
│       ├── vosk/
│       │   ├── VoskListenerService.kt
│       │   ├── VoskModule.kt
│       │   ├── VoskPackage.kt
│       │   └── BootReceiver.kt
├── plugins/
│   └── withVoskPlugin.ts         # Expo config plugin
├── src/
│   └── hooks/
│       └── useVoskBackground.ts  # React Native hook
```
