# Phase 3: Evidence & Cloud Upload — Design Spec

## Overview

Capture audio, video, and photos as evidence during SOS events, store locally first (offline-first), then upload to Firebase Storage. Evidence is viewable on the Status screen. No backend changes — mobile communicates directly with Firebase.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Media types | Audio + Video + Photos | All three for maximum evidence |
| Audio duration | 30 seconds auto-record | Short burst, small file, captures immediate context |
| Video duration | 15 seconds auto-record | Captures visual context without large files |
| Photos | Manual, after auto-recording | User takes photos when safe to do so |
| Security | Firebase Storage rules (auth-based) | Simple, secure, no encryption complexity |
| Offline strategy | Save locally first, upload in background | Evidence never lost, even without network |
| Upload target | Firebase Storage directly from mobile | No backend involvement, follows Firestore contacts pattern |
| Evidence viewing | Status screen evidence section | No separate screen needed for small media set |

## Recording Flow

When SOS triggers (manual or voice):

1. Audio auto-records for 30 seconds using `expo-av` (already installed)
2. Video auto-records for 15 seconds using `expo-camera`
3. Both save to device local filesystem (`expo-file-system`) immediately
4. Recording starts in parallel with the SOS API call — does not wait for backend response
5. Voice detection's existing `expo-av` recording stops before evidence recording starts (no conflict)
6. After recording completes, a camera button appears on the Status screen for manual photo capture

## Storage Architecture

### Local Storage

All media saves to `${FileSystem.documentDirectory}evidence/{eventId}/`:
- `audio-{timestamp}.m4a` — 30-second audio recording
- `video-{timestamp}.mp4` — 15-second video recording
- `photo-{timestamp}.jpg` — manual photo captures
- `manifest.json` — tracks each file's upload status (`pending`, `uploading`, `uploaded`)

### Firebase Storage Structure

```
evidence/{userId}/{eventId}/
  ├── audio-{timestamp}.m4a
  ├── video-{timestamp}.mp4
  ├── photo-{timestamp}.jpg
  └── ...
```

### Upload Logic

1. After each file is saved locally, it is queued for upload
2. Upload uses Firebase Storage SDK (`uploadBytesResumable`) which supports pause/resume
3. If upload fails (no network), the manifest marks it `pending` and retries when connectivity returns
4. On app launch, check manifest for any `pending` files and resume uploads
5. Once uploaded, the download URL is written to Firestore under the SOS event document

### Firestore Schema Addition

Under `sos_events/{eventId}`:

```json
{
  "evidence": [
    {
      "type": "audio",
      "url": "https://firebasestorage.googleapis.com/...",
      "filename": "audio-1711792800.m4a",
      "createdAt": "<timestamp>"
    },
    {
      "type": "video",
      "url": "https://firebasestorage.googleapis.com/...",
      "filename": "video-1711792800.mp4",
      "createdAt": "<timestamp>"
    },
    {
      "type": "photo",
      "url": "https://firebasestorage.googleapis.com/...",
      "filename": "photo-1711792803.jpg",
      "createdAt": "<timestamp>"
    }
  ]
}
```

## Status Screen Evidence UI

### During Recording

Audio records for 30 seconds, video records for 15 seconds (video finishes first).

- Recording indicator: "Recording audio... 15s remaining" / "Recording video... 8s remaining"
- Pulsing red dot (reuse VoiceIndicator style)
- Video indicator disappears after 15 seconds; audio indicator remains until 30 seconds

### After Recording Completes

- **"Take Photo" button** — opens camera for manual photo capture
- Evidence item list with thumbnails:
  - Audio: waveform icon + duration + upload status
  - Video: video thumbnail + duration + upload status
  - Photo: image thumbnail + upload status
- Upload status per item: uploading spinner, checkmark (uploaded), or retry icon (failed)
- Tap photo/video to view fullscreen
- Tap audio to play back
- Upload summary at top: "3/4 files uploaded" or "All evidence uploaded"

## Security

### Firebase Storage Rules

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /evidence/{userId}/{eventId}/{fileName} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

Only the authenticated user who created the SOS event can read/write their evidence files.

### Permissions

- Camera: required for video recording and photos (`expo-camera`)
- Microphone: already granted from Phase 2 (`expo-av`)
- File system: no extra permission needed (app-private storage)

## New Dependencies

| Package | Purpose |
|---------|---------|
| `expo-camera` | Video recording and photo capture |
| `expo-file-system` | Local file storage and manifest management |
| `firebase/storage` | Already included in `firebase` package |

## New Files

| File | Purpose |
|------|---------|
| `mobile/src/services/evidenceStorage.ts` | Local file management (save, read manifest, cleanup) |
| `mobile/src/services/evidenceUpload.ts` | Firebase Storage upload with retry logic |
| `mobile/src/hooks/useEvidenceRecorder.ts` | Orchestrates auto-recording (audio + video) on SOS trigger |
| `mobile/src/hooks/useEvidenceUpload.ts` | Manages upload queue and status |
| `mobile/src/components/EvidenceList.tsx` | Renders evidence items with thumbnails and upload status |
| `mobile/src/components/RecordingIndicator.tsx` | Shows recording countdown during capture |
| `shared-schemas/src/evidence.ts` | EvidenceItem type definition |

## Modified Files

| File | Change |
|------|--------|
| `mobile/src/screens/HomeScreen.tsx` | Trigger evidence recording alongside SOS |
| `mobile/src/screens/StatusScreen.tsx` | Add evidence section with camera button |
| `mobile/src/services/firebase.ts` | Export Firebase Storage instance |
| `shared-schemas/src/index.ts` | Export evidence types |

## Out of Scope

- End-to-end encryption (can be added later without architectural changes)
- Evidence sharing with emergency contacts (Phase 4 dashboard territory)
- Background recording when app is minimized
- Cloud-side processing or transcoding of media files
