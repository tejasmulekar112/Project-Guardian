# Phase 2: AI Voice Detection Design

**Date:** 2026-03-30
**Status:** Approved

## Problem

Users in danger may not be able to press the SOS button. Voice-activated detection allows hands-free emergency triggering by detecting distress keywords spoken aloud.

## Architecture

```
Phone (toggle listening ON)
  ├── Records 5-second audio chunks (expo-av, m4a format)
  ├── POST /sos/voice-detect (multipart upload)
  │
Backend (Render)
  ├── Receives audio file
  ├── OpenAI Whisper API → transcript
  ├── Keyword matching against distress phrases
  ├── Returns { detected, transcript, keyword, confidence }
  │
Phone (if detected=true)
  ├── 10-second countdown overlay ("Tap to cancel")
  ├── If not cancelled → triggerSOS(triggerType: 'voice')
  └── Same Firestore + Twilio + FCM flow as manual
```

## Mobile Changes

### New dependency
- `expo-av` — audio recording

### New files

**`mobile/src/hooks/useVoiceDetection.ts`**
- Manages audio recording lifecycle (start/stop)
- Records in 5-second chunks using `Audio.Recording`
- Uploads each chunk to `POST /sos/voice-detect`
- Returns: `{ isListening, startListening, stopListening, detection }`
- On detection: sets `detection` state with transcript and keyword
- Recording format: m4a (AAC), mono, 16kHz sample rate (optimal for Whisper)
- Pauses uploading after 30 seconds of empty transcripts (resumes on next chunk with content)

**`mobile/src/components/CountdownOverlay.tsx`**
- Full-screen overlay shown when distress is detected
- Displays: "Distress detected: '{keyword}'"
- 10-second countdown timer with large cancel button
- If countdown reaches 0: calls `onConfirm()` callback
- If user taps cancel: calls `onCancel()` callback, resumes listening

**`mobile/src/components/VoiceIndicator.tsx`**
- Small pulsing microphone icon shown when listening is active
- Indicates to user that voice detection is running

### Modified files

**`mobile/src/screens/HomeScreen.tsx`**
- Add "Start Listening" / "Stop Listening" toggle button below SOS button
- Integrate `useVoiceDetection` hook
- When detection triggers, show `CountdownOverlay`
- On countdown complete: call `handleSOS()` with `triggerType: 'voice'`
- Show `VoiceIndicator` when listening is active

**`mobile/src/services/api.ts`**
- Add `detectVoice(audioUri: string): Promise<VoiceDetectionResult>` function
- Sends multipart/form-data POST to `/sos/voice-detect`
- Returns `{ detected, transcript, keyword, confidence }`

### New shared type

**`shared-schemas/src/voice-detection.ts`**
```typescript
export interface VoiceDetectionResult {
  detected: boolean;
  transcript: string;
  keyword: string | null;
  confidence: number;
}
```

## Backend Changes

### New endpoint

**`POST /sos/voice-detect`**
- Accepts: multipart/form-data with audio file
- Auth: Firebase token required
- Saves uploaded file to temp directory
- Calls `DistressDetector.detect_from_audio()`
- Deletes temp file after processing
- Returns: `VoiceDetectionResult` JSON

### New dependency
- `openai` — for Whisper API
- `python-multipart` — for file upload handling

### Modified files

**`backend/app/routers/sos.py`**
- Add `POST /voice-detect` endpoint
- Accepts `UploadFile` parameter
- Calls detector, returns result

**`backend/app/config.py`**
- Add `openai_api_key: str` setting

**`backend/app/services/whisper_service.py`** (new)
- Wraps `DistressDetector` from ai-services
- Handles OpenAI client initialization
- `async def detect(audio_path: str) -> VoiceDetectionResult`
- Uses `openai.audio.transcriptions.create(model="whisper-1", file=...)`
- Runs keyword matching on transcript

**`backend/requirements.txt`**
- Add `openai` and `python-multipart`

### Distress keywords (from existing config)
```
help, help me, emergency, call the police,
someone help, i'm in danger, save me, stop
```

## Audio Chunking Strategy

- Chunk size: 5 seconds
- Format: m4a (AAC codec), mono, 16kHz
- Each chunk is uploaded independently
- Backend processes and responds per chunk
- If 6 consecutive chunks return empty transcripts (30 seconds of silence), mobile pauses uploading
- Next chunk with any audio content resumes the cycle
- Estimated Whisper API cost: ~$0.006/minute = ~$0.0005 per 5-second chunk

## Countdown Flow

1. Backend returns `detected: true` with matched keyword
2. Mobile stops recording
3. CountdownOverlay appears: "Distress detected: 'help me'"
4. 10-second countdown starts with large red cancel button
5. If user taps cancel: overlay dismisses, listening resumes
6. If countdown hits 0: `triggerSOS()` called with `triggerType: 'voice'`, message includes transcript

## Error Handling

- Network failure during upload: skip chunk, continue recording next chunk
- Whisper API failure: log error, skip chunk, continue
- Microphone permission denied: show alert, disable voice feature
- OpenAI API key missing on backend: return 503 with clear error message

## What Stays the Same

- Manual SOS button (always available)
- SOS trigger flow (Firestore + Twilio + FCM)
- All existing screens and navigation
- Firebase Auth
- Contacts management (direct Firestore)
