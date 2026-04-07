# Lock Screen SOS Countdown

## Summary

Add a 10-second countdown with cancel option before firing SOS from background voice detection. Prevents false positives when `GuardianForegroundService` detects a distress keyword while the phone is locked or the app is backgrounded.

## Current Behavior

When Vosk detects a distress keyword in `GuardianForegroundService`, `onWakeWordDetected()` fires SOS immediately — no cancel window.

## New Behavior

1. Vosk detects keyword → start 10-second countdown (do NOT fire SOS yet)
2. Show high-priority heads-up notification: "SOS Detected — Triggering in 10s"
3. Notification updates every second with remaining time
4. Notification includes a **Cancel** action button
5. Device vibrates in a pattern during countdown
6. After 10s with no cancel → fire SOS via existing `onWakeWordDetected()` flow
7. If user taps Cancel → abort countdown, resume Vosk listening

## Architecture

### Files Modified

- `GuardianForegroundService.kt` — Add countdown logic between keyword detection and SOS trigger
  - New high-priority notification channel for SOS countdown alerts
  - `CountDownTimer` (10s) that updates notification each second
  - Vibration pattern during countdown
  - New method `onDistressDetected()` that starts countdown instead of calling `onWakeWordDetected()` directly

### Files Added

- `SOSCancelReceiver.kt` — BroadcastReceiver that handles the Cancel action from the notification
  - Receives cancel intent, tells service to abort countdown
  - Service resumes Vosk listening after cancel

### Notification Details

- **Channel:** New `guardian_sos_alert` channel with `IMPORTANCE_HIGH` (heads-up display)
- **Countdown notification:** Updates title every second ("SOS in 9s...", "SOS in 8s...")
- **Cancel action:** PendingIntent to `SOSCancelReceiver`
- **After SOS fires:** Reuses existing `buildSOSActiveNotification()`

### AndroidManifest Changes

- Register `SOSCancelReceiver` as a `<receiver>`

## Edge Cases

- **Multiple detections during countdown:** Ignored (cooldown + countdown in progress check)
- **Service killed during countdown:** Timer cancelled, no SOS sent (safe default)
- **User opens app during countdown:** In-app CountdownOverlay could take over (future enhancement, not in scope)
