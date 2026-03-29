# Phase 3: Evidence & Cloud Upload — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto-record audio (30s) and video (15s) when SOS triggers, allow manual photos, save locally first, then upload to Firebase Storage with offline retry. Display evidence with upload status on the Status screen.

**Architecture:** Mobile-only — all recording, local storage, and Firebase Storage uploads happen directly from the React Native app. No backend changes. Evidence metadata (download URLs) is written to Firestore under the SOS event document. A local JSON manifest tracks upload status for offline resilience.

**Tech Stack:** expo-av (audio), expo-camera (video + photos), expo-file-system (local storage), firebase/storage (cloud upload), Firestore (metadata)

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `shared-schemas/src/evidence.ts` | Create | EvidenceItem and EvidenceType type definitions |
| `shared-schemas/src/index.ts` | Modify | Re-export evidence types |
| `mobile/src/services/firebase.ts` | Modify | Export Firebase Storage instance |
| `mobile/src/services/evidenceStorage.ts` | Create | Local file system operations: save files, read/write manifest |
| `mobile/src/services/evidenceUpload.ts` | Create | Firebase Storage upload with retry, Firestore metadata write |
| `mobile/src/hooks/useEvidenceRecorder.ts` | Create | Orchestrates audio + video auto-recording on SOS trigger |
| `mobile/src/hooks/useEvidenceUpload.ts` | Create | Manages upload queue, exposes per-file status |
| `mobile/src/components/RecordingIndicator.tsx` | Create | Countdown timer during active recording |
| `mobile/src/components/EvidenceList.tsx` | Create | Renders evidence thumbnails with upload status |
| `mobile/src/screens/HomeScreen.tsx` | Modify | Start evidence recording when SOS triggers |
| `mobile/src/screens/StatusScreen.tsx` | Modify | Full rewrite — evidence section, camera button, evidence list |
| `mobile/src/navigation/RootNavigator.tsx` | Modify | Pass eventId to Status screen |
| `mobile/app.json` | Modify | Add camera permission and expo-camera plugin |
| `mobile/package.json` | Modify | Add expo-camera, expo-file-system dependencies |

---

### Task 1: Install Dependencies and Configure Permissions

**Files:**
- Modify: `mobile/package.json`
- Modify: `mobile/app.json`

- [ ] **Step 1: Install expo-camera and expo-file-system**

Run from the repo root:

```bash
cd mobile && npx expo install expo-camera expo-file-system
```

- [ ] **Step 2: Add camera permission and plugins to app.json**

Open `mobile/app.json`. Add `"android.permission.CAMERA"` and `"android.permission.RECORD_AUDIO"` to the Android permissions array, and add the `expo-camera` plugin entry. The full `android` and `plugins` sections should look like:

```json
"android": {
  "adaptiveIcon": {
    "foregroundImage": "./assets/adaptive-icon.png",
    "backgroundColor": "#DC2626"
  },
  "package": "com.guardian.sos",
  "permissions": [
    "android.permission.ACCESS_COARSE_LOCATION",
    "android.permission.ACCESS_FINE_LOCATION",
    "android.permission.CAMERA",
    "android.permission.RECORD_AUDIO"
  ]
},
```

```json
"plugins": [
  [
    "expo-location",
    {
      "locationAlwaysAndWhenInUsePermission": "Project Guardian needs your location to send emergency alerts."
    }
  ],
  [
    "expo-notifications",
    {
      "icon": "./assets/notification-icon.png",
      "color": "#DC2626"
    }
  ],
  [
    "expo-camera",
    {
      "cameraPermission": "Project Guardian needs camera access to capture evidence during emergencies.",
      "microphonePermission": "Project Guardian needs microphone access to record audio evidence.",
      "recordAudioAndroid": true
    }
  ]
]
```

- [ ] **Step 3: Commit**

```bash
git add mobile/package.json mobile/app.json package-lock.json
git commit -m "chore: add expo-camera and expo-file-system dependencies"
```

---

### Task 2: Shared Schemas — EvidenceItem Type

**Files:**
- Create: `shared-schemas/src/evidence.ts`
- Modify: `shared-schemas/src/index.ts`

- [ ] **Step 1: Create the evidence type definitions**

Create `shared-schemas/src/evidence.ts`:

```typescript
export type EvidenceType = 'audio' | 'video' | 'photo';

export type EvidenceUploadStatus = 'pending' | 'uploading' | 'uploaded' | 'failed';

export interface EvidenceItem {
  type: EvidenceType;
  filename: string;
  localUri: string;
  uploadStatus: EvidenceUploadStatus;
  url?: string;
  createdAt: number;
}

export interface EvidenceManifest {
  eventId: string;
  userId: string;
  items: EvidenceItem[];
}
```

- [ ] **Step 2: Export from shared-schemas index**

Open `shared-schemas/src/index.ts` and add at the end:

```typescript
export type {
  EvidenceType,
  EvidenceUploadStatus,
  EvidenceItem,
  EvidenceManifest,
} from './evidence';
```

- [ ] **Step 3: Commit**

```bash
git add shared-schemas/src/evidence.ts shared-schemas/src/index.ts
git commit -m "feat: add EvidenceItem and EvidenceManifest shared types"
```

---

### Task 3: Export Firebase Storage Instance

**Files:**
- Modify: `mobile/src/services/firebase.ts`

- [ ] **Step 1: Add storage export**

Open `mobile/src/services/firebase.ts`. Add this import at the top:

```typescript
import { getStorage } from 'firebase/storage';
```

Add this export at the bottom of the file:

```typescript
export const storage = getStorage(firebaseApp);
```

- [ ] **Step 2: Commit**

```bash
git add mobile/src/services/firebase.ts
git commit -m "feat: export Firebase Storage instance"
```

---

### Task 4: Local Evidence Storage Service

**Files:**
- Create: `mobile/src/services/evidenceStorage.ts`

- [ ] **Step 1: Create the local storage service**

Create `mobile/src/services/evidenceStorage.ts`:

```typescript
import * as FileSystem from 'expo-file-system';
import type { EvidenceItem, EvidenceManifest, EvidenceType, EvidenceUploadStatus } from '@guardian/shared-schemas';

const EVIDENCE_DIR = `${FileSystem.documentDirectory}evidence/`;

function eventDir(eventId: string): string {
  return `${EVIDENCE_DIR}${eventId}/`;
}

function manifestPath(eventId: string): string {
  return `${eventDir(eventId)}manifest.json`;
}

export async function ensureEventDir(eventId: string): Promise<string> {
  const dir = eventDir(eventId);
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
  return dir;
}

export async function readManifest(eventId: string): Promise<EvidenceManifest | null> {
  const path = manifestPath(eventId);
  const info = await FileSystem.getInfoAsync(path);
  if (!info.exists) return null;
  const content = await FileSystem.readAsStringAsync(path);
  return JSON.parse(content) as EvidenceManifest;
}

export async function writeManifest(manifest: EvidenceManifest): Promise<void> {
  await ensureEventDir(manifest.eventId);
  const path = manifestPath(manifest.eventId);
  await FileSystem.writeAsStringAsync(path, JSON.stringify(manifest));
}

export async function addEvidenceItem(
  eventId: string,
  userId: string,
  type: EvidenceType,
  sourceUri: string,
): Promise<EvidenceItem> {
  const dir = await ensureEventDir(eventId);
  const timestamp = Date.now();
  const ext = type === 'audio' ? 'm4a' : type === 'video' ? 'mp4' : 'jpg';
  const filename = `${type}-${timestamp}.${ext}`;
  const destUri = `${dir}${filename}`;

  await FileSystem.copyAsync({ from: sourceUri, to: destUri });

  const item: EvidenceItem = {
    type,
    filename,
    localUri: destUri,
    uploadStatus: 'pending',
    createdAt: timestamp,
  };

  // Update manifest
  let manifest = await readManifest(eventId);
  if (!manifest) {
    manifest = { eventId, userId, items: [] };
  }
  manifest.items.push(item);
  await writeManifest(manifest);

  return item;
}

export async function updateItemStatus(
  eventId: string,
  filename: string,
  status: EvidenceUploadStatus,
  url?: string,
): Promise<void> {
  const manifest = await readManifest(eventId);
  if (!manifest) return;

  const item = manifest.items.find((i) => i.filename === filename);
  if (!item) return;

  item.uploadStatus = status;
  if (url) item.url = url;

  await writeManifest(manifest);
}

export async function getAllPendingManifests(): Promise<EvidenceManifest[]> {
  const info = await FileSystem.getInfoAsync(EVIDENCE_DIR);
  if (!info.exists) return [];

  const dirs = await FileSystem.readDirectoryAsync(EVIDENCE_DIR);
  const manifests: EvidenceManifest[] = [];

  for (const dir of dirs) {
    const manifest = await readManifest(dir);
    if (manifest) {
      const hasPending = manifest.items.some(
        (i) => i.uploadStatus === 'pending' || i.uploadStatus === 'failed',
      );
      if (hasPending) manifests.push(manifest);
    }
  }

  return manifests;
}
```

- [ ] **Step 2: Commit**

```bash
git add mobile/src/services/evidenceStorage.ts
git commit -m "feat: add local evidence storage service with manifest management"
```

---

### Task 5: Firebase Storage Upload Service

**Files:**
- Create: `mobile/src/services/evidenceUpload.ts`

- [ ] **Step 1: Create the upload service**

Create `mobile/src/services/evidenceUpload.ts`:

```typescript
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { getFirestore } from 'firebase/firestore';
import * as FileSystem from 'expo-file-system';
import { storage, firebaseApp } from './firebase';
import { updateItemStatus, getAllPendingManifests, readManifest } from './evidenceStorage';
import type { EvidenceItem } from '@guardian/shared-schemas';

const db = getFirestore(firebaseApp);

export async function uploadEvidenceFile(
  userId: string,
  eventId: string,
  item: EvidenceItem,
): Promise<string> {
  await updateItemStatus(eventId, item.filename, 'uploading');

  try {
    const storagePath = `evidence/${userId}/${eventId}/${item.filename}`;
    const storageRef = ref(storage, storagePath);

    // Read local file as base64, convert to blob
    const base64 = await FileSystem.readAsStringAsync(item.localUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const response = await fetch(`data:application/octet-stream;base64,${base64}`);
    const blob = await response.blob();

    // Upload with resumable upload
    await new Promise<void>((resolve, reject) => {
      const task = uploadBytesResumable(storageRef, blob);
      task.on(
        'state_changed',
        null,
        (error) => reject(error),
        () => resolve(),
      );
    });

    const downloadUrl = await getDownloadURL(storageRef);

    // Update local manifest
    await updateItemStatus(eventId, item.filename, 'uploaded', downloadUrl);

    // Write metadata to Firestore
    const eventRef = doc(db, 'sos_events', eventId);
    await updateDoc(eventRef, {
      evidence: arrayUnion({
        type: item.type,
        url: downloadUrl,
        filename: item.filename,
        createdAt: item.createdAt,
      }),
    });

    return downloadUrl;
  } catch (error) {
    await updateItemStatus(eventId, item.filename, 'failed');
    throw error;
  }
}

export async function uploadAllPending(): Promise<void> {
  const manifests = await getAllPendingManifests();

  for (const manifest of manifests) {
    const pendingItems = manifest.items.filter(
      (i) => i.uploadStatus === 'pending' || i.uploadStatus === 'failed',
    );

    for (const item of pendingItems) {
      try {
        await uploadEvidenceFile(manifest.userId, manifest.eventId, item);
      } catch {
        // Continue with next item — already marked as failed
      }
    }
  }
}

export async function uploadEventEvidence(eventId: string): Promise<void> {
  const manifest = await readManifest(eventId);
  if (!manifest) return;

  const pendingItems = manifest.items.filter(
    (i) => i.uploadStatus === 'pending' || i.uploadStatus === 'failed',
  );

  for (const item of pendingItems) {
    try {
      await uploadEvidenceFile(manifest.userId, manifest.eventId, item);
    } catch {
      // Continue with next item
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add mobile/src/services/evidenceUpload.ts
git commit -m "feat: add Firebase Storage upload service with retry and Firestore metadata"
```

---

### Task 6: useEvidenceRecorder Hook

**Files:**
- Create: `mobile/src/hooks/useEvidenceRecorder.ts`

- [ ] **Step 1: Create the evidence recorder hook**

Create `mobile/src/hooks/useEvidenceRecorder.ts`:

```typescript
import { useCallback, useRef, useState } from 'react';
import { Audio } from 'expo-av';
import { CameraView } from 'expo-camera';
import * as FileSystem from 'expo-file-system';
import { addEvidenceItem } from '../services/evidenceStorage';
import { uploadEventEvidence } from '../services/evidenceUpload';

const AUDIO_DURATION_MS = 30000;
const VIDEO_DURATION_MS = 15000;

interface RecordingState {
  isRecording: boolean;
  audioRemaining: number;
  videoRemaining: number;
  recordingComplete: boolean;
}

interface UseEvidenceRecorderReturn {
  state: RecordingState;
  cameraRef: React.RefObject<CameraView | null>;
  startRecording: (eventId: string, userId: string) => Promise<void>;
  stopRecording: () => Promise<void>;
}

export function useEvidenceRecorder(): UseEvidenceRecorderReturn {
  const [state, setState] = useState<RecordingState>({
    isRecording: false,
    audioRemaining: 0,
    videoRemaining: 0,
    recordingComplete: false,
  });

  const audioRecordingRef = useRef<Audio.Recording | null>(null);
  const cameraRef = useRef<CameraView | null>(null);
  const audioTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const videoTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const eventIdRef = useRef<string>('');
  const userIdRef = useRef<string>('');

  const cleanup = useCallback(() => {
    if (audioTimerRef.current) {
      clearInterval(audioTimerRef.current);
      audioTimerRef.current = null;
    }
    if (videoTimerRef.current) {
      clearInterval(videoTimerRef.current);
      videoTimerRef.current = null;
    }
  }, []);

  const startRecording = useCallback(async (eventId: string, userId: string) => {
    eventIdRef.current = eventId;
    userIdRef.current = userId;

    setState({
      isRecording: true,
      audioRemaining: AUDIO_DURATION_MS / 1000,
      videoRemaining: VIDEO_DURATION_MS / 1000,
      recordingComplete: false,
    });

    // Request permissions
    const { granted: audioGranted } = await Audio.requestPermissionsAsync();
    if (!audioGranted) {
      setState((prev) => ({ ...prev, isRecording: false }));
      return;
    }

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });

    // Start audio recording
    try {
      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync({
        android: {
          extension: '.m4a',
          outputFormat: Audio.AndroidOutputFormat.MPEG_4,
          audioEncoder: Audio.AndroidAudioEncoder.AAC,
          sampleRate: 16000,
          numberOfChannels: 1,
          bitRate: 64000,
        },
        ios: {
          extension: '.m4a',
          outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
          audioQuality: Audio.IOSAudioQuality.MEDIUM,
          sampleRate: 16000,
          numberOfChannels: 1,
          bitRate: 64000,
        },
        web: {},
      });
      audioRecordingRef.current = recording;
      await recording.startAsync();
    } catch {
      // Audio recording failed — continue with video
    }

    // Start video recording
    try {
      if (cameraRef.current) {
        const videoPromise = cameraRef.current.recordAsync({ maxDuration: VIDEO_DURATION_MS / 1000 });

        // Stop video after duration
        setTimeout(async () => {
          try {
            if (cameraRef.current) {
              cameraRef.current.stopRecording();
            }
          } catch {
            // Already stopped
          }
        }, VIDEO_DURATION_MS);

        // Handle video result in background
        videoPromise?.then(async (video) => {
          if (video?.uri) {
            await addEvidenceItem(eventIdRef.current, userIdRef.current, 'video', video.uri);
          }
        }).catch(() => {
          // Video recording failed
        });
      }
    } catch {
      // Camera not available
    }

    // Audio countdown timer
    audioTimerRef.current = setInterval(() => {
      setState((prev) => {
        const newRemaining = prev.audioRemaining - 1;
        if (newRemaining <= 0) {
          return { ...prev, audioRemaining: 0 };
        }
        return { ...prev, audioRemaining: newRemaining };
      });
    }, 1000);

    // Video countdown timer
    videoTimerRef.current = setInterval(() => {
      setState((prev) => {
        const newRemaining = prev.videoRemaining - 1;
        if (newRemaining <= 0) {
          if (videoTimerRef.current) {
            clearInterval(videoTimerRef.current);
            videoTimerRef.current = null;
          }
          return { ...prev, videoRemaining: 0 };
        }
        return { ...prev, videoRemaining: newRemaining };
      });
    }, 1000);

    // Stop audio after duration
    setTimeout(async () => {
      try {
        if (audioRecordingRef.current) {
          await audioRecordingRef.current.stopAndUnloadAsync();
          const uri = audioRecordingRef.current.getURI();
          audioRecordingRef.current = null;

          if (uri) {
            await addEvidenceItem(eventIdRef.current, userIdRef.current, 'audio', uri);
          }
        }
      } catch {
        // Already stopped
      }

      cleanup();
      setState((prev) => ({
        ...prev,
        isRecording: false,
        audioRemaining: 0,
        videoRemaining: 0,
        recordingComplete: true,
      }));

      // Start uploading in background
      void uploadEventEvidence(eventIdRef.current);
    }, AUDIO_DURATION_MS);
  }, [cleanup]);

  const stopRecording = useCallback(async () => {
    cleanup();

    try {
      if (audioRecordingRef.current) {
        await audioRecordingRef.current.stopAndUnloadAsync();
        const uri = audioRecordingRef.current.getURI();
        audioRecordingRef.current = null;

        if (uri) {
          await addEvidenceItem(eventIdRef.current, userIdRef.current, 'audio', uri);
        }
      }
    } catch {
      // Already stopped
    }

    try {
      if (cameraRef.current) {
        cameraRef.current.stopRecording();
      }
    } catch {
      // Already stopped
    }

    setState({
      isRecording: false,
      audioRemaining: 0,
      videoRemaining: 0,
      recordingComplete: true,
    });

    void uploadEventEvidence(eventIdRef.current);
  }, [cleanup]);

  return { state, cameraRef, startRecording, stopRecording };
}
```

- [ ] **Step 2: Commit**

```bash
git add mobile/src/hooks/useEvidenceRecorder.ts
git commit -m "feat: add useEvidenceRecorder hook for auto audio/video capture"
```

---

### Task 7: useEvidenceUpload Hook

**Files:**
- Create: `mobile/src/hooks/useEvidenceUpload.ts`

- [ ] **Step 1: Create the upload status hook**

Create `mobile/src/hooks/useEvidenceUpload.ts`:

```typescript
import { useCallback, useEffect, useState } from 'react';
import { readManifest } from '../services/evidenceStorage';
import { uploadEventEvidence, uploadAllPending } from '../services/evidenceUpload';
import type { EvidenceItem } from '@guardian/shared-schemas';

interface UseEvidenceUploadReturn {
  items: EvidenceItem[];
  uploadedCount: number;
  totalCount: number;
  isUploading: boolean;
  refresh: () => Promise<void>;
  retryAll: () => Promise<void>;
}

export function useEvidenceUpload(eventId: string | null): UseEvidenceUploadReturn {
  const [items, setItems] = useState<EvidenceItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const refresh = useCallback(async () => {
    if (!eventId) {
      setItems([]);
      return;
    }
    const manifest = await readManifest(eventId);
    setItems(manifest?.items ?? []);
  }, [eventId]);

  // Poll for status updates while uploading
  useEffect(() => {
    if (!eventId) return;

    void refresh();

    const interval = setInterval(() => {
      void refresh();
    }, 2000);

    return () => clearInterval(interval);
  }, [eventId, refresh]);

  // Resume pending uploads on mount
  useEffect(() => {
    void uploadAllPending();
  }, []);

  const retryAll = useCallback(async () => {
    if (!eventId) return;
    setIsUploading(true);
    try {
      await uploadEventEvidence(eventId);
    } finally {
      setIsUploading(false);
      await refresh();
    }
  }, [eventId, refresh]);

  const uploadedCount = items.filter((i) => i.uploadStatus === 'uploaded').length;
  const totalCount = items.length;

  return { items, uploadedCount, totalCount, isUploading, refresh, retryAll };
}
```

- [ ] **Step 2: Commit**

```bash
git add mobile/src/hooks/useEvidenceUpload.ts
git commit -m "feat: add useEvidenceUpload hook for upload status tracking"
```

---

### Task 8: RecordingIndicator Component

**Files:**
- Create: `mobile/src/components/RecordingIndicator.tsx`

- [ ] **Step 1: Create the recording indicator component**

Create `mobile/src/components/RecordingIndicator.tsx`:

```typescript
import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';

interface RecordingIndicatorProps {
  audioRemaining: number;
  videoRemaining: number;
}

export const RecordingIndicator = ({ audioRemaining, videoRemaining }: RecordingIndicatorProps) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.3,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [pulseAnim]);

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Animated.View style={[styles.dot, { transform: [{ scale: pulseAnim }] }]} />
        <Text style={styles.label}>Recording Evidence</Text>
      </View>

      {audioRemaining > 0 && (
        <Text style={styles.timer}>Audio: {audioRemaining}s remaining</Text>
      )}
      {videoRemaining > 0 && (
        <Text style={styles.timer}>Video: {videoRemaining}s remaining</Text>
      )}
      {audioRemaining <= 0 && videoRemaining <= 0 && (
        <Text style={styles.complete}>Recording complete</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1F2937',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#EF4444',
  },
  label: {
    color: '#EF4444',
    fontSize: 16,
    fontWeight: '600',
  },
  timer: {
    color: '#FBBF24',
    fontSize: 14,
    marginLeft: 20,
    marginTop: 4,
  },
  complete: {
    color: '#34D399',
    fontSize: 14,
    marginLeft: 20,
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add mobile/src/components/RecordingIndicator.tsx
git commit -m "feat: add RecordingIndicator component with countdown timers"
```

---

### Task 9: EvidenceList Component

**Files:**
- Create: `mobile/src/components/EvidenceList.tsx`

- [ ] **Step 1: Create the evidence list component**

Create `mobile/src/components/EvidenceList.tsx`:

```typescript
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, ActivityIndicator, Modal } from 'react-native';
import { Audio } from 'expo-av';
import type { EvidenceItem } from '@guardian/shared-schemas';

interface EvidenceListProps {
  items: EvidenceItem[];
  uploadedCount: number;
  totalCount: number;
  onRetry: () => void;
}

export const EvidenceList = ({ items, uploadedCount, totalCount, onRetry }: EvidenceListProps) => {
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const [previewUri, setPreviewUri] = useState<string | null>(null);

  const playAudio = async (uri: string) => {
    try {
      setPlayingAudio(uri);
      const { sound } = await Audio.Sound.createAsync({ uri });
      sound.setOnPlaybackStatusUpdate((status) => {
        if ('didJustFinish' in status && status.didJustFinish) {
          setPlayingAudio(null);
          void sound.unloadAsync();
        }
      });
      await sound.playAsync();
    } catch {
      setPlayingAudio(null);
    }
  };

  const renderStatusIcon = (item: EvidenceItem) => {
    switch (item.uploadStatus) {
      case 'uploading':
        return <ActivityIndicator size="small" color="#60A5FA" />;
      case 'uploaded':
        return <Text style={styles.checkmark}>✓</Text>;
      case 'failed':
        return (
          <TouchableOpacity onPress={onRetry}>
            <Text style={styles.retryIcon}>↻</Text>
          </TouchableOpacity>
        );
      default:
        return <Text style={styles.pendingIcon}>⏳</Text>;
    }
  };

  const renderTypeIcon = (item: EvidenceItem) => {
    switch (item.type) {
      case 'audio':
        return '🎵';
      case 'video':
        return '🎬';
      case 'photo':
        return '📷';
    }
  };

  const handleItemPress = (item: EvidenceItem) => {
    if (item.type === 'audio') {
      void playAudio(item.localUri);
    } else {
      setPreviewUri(item.localUri);
    }
  };

  const hasFailed = items.some((i) => i.uploadStatus === 'failed');

  return (
    <View style={styles.container}>
      <View style={styles.summaryRow}>
        <Text style={styles.summaryText}>
          {totalCount === 0
            ? 'No evidence yet'
            : uploadedCount === totalCount
              ? 'All evidence uploaded'
              : `${uploadedCount}/${totalCount} files uploaded`}
        </Text>
        {hasFailed && (
          <TouchableOpacity onPress={onRetry}>
            <Text style={styles.retryAllText}>Retry All</Text>
          </TouchableOpacity>
        )}
      </View>

      {items.map((item) => (
        <TouchableOpacity
          key={item.filename}
          style={styles.itemRow}
          onPress={() => handleItemPress(item)}
        >
          <Text style={styles.typeIcon}>{renderTypeIcon(item)}</Text>
          <View style={styles.itemInfo}>
            <Text style={styles.itemFilename}>{item.filename}</Text>
            <Text style={styles.itemTime}>
              {new Date(item.createdAt).toLocaleTimeString()}
            </Text>
          </View>
          {playingAudio === item.localUri ? (
            <Text style={styles.playingText}>Playing...</Text>
          ) : (
            renderStatusIcon(item)
          )}
        </TouchableOpacity>
      ))}

      {/* Fullscreen preview modal for photos/videos */}
      <Modal visible={!!previewUri} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          onPress={() => setPreviewUri(null)}
          activeOpacity={1}
        >
          {previewUri && (
            <Image
              source={{ uri: previewUri }}
              style={styles.previewImage}
              resizeMode="contain"
            />
          )}
          <Text style={styles.closeText}>Tap to close</Text>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryText: {
    color: '#9CA3AF',
    fontSize: 14,
  },
  retryAllText: {
    color: '#60A5FA',
    fontSize: 14,
    fontWeight: '600',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F2937',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    gap: 12,
  },
  typeIcon: {
    fontSize: 20,
  },
  itemInfo: {
    flex: 1,
  },
  itemFilename: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  itemTime: {
    color: '#6B7280',
    fontSize: 12,
    marginTop: 2,
  },
  checkmark: {
    color: '#34D399',
    fontSize: 18,
    fontWeight: 'bold',
  },
  retryIcon: {
    color: '#EF4444',
    fontSize: 20,
    fontWeight: 'bold',
  },
  pendingIcon: {
    fontSize: 16,
  },
  playingText: {
    color: '#60A5FA',
    fontSize: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewImage: {
    width: '90%',
    height: '70%',
  },
  closeText: {
    color: '#9CA3AF',
    fontSize: 16,
    marginTop: 24,
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add mobile/src/components/EvidenceList.tsx
git commit -m "feat: add EvidenceList component with thumbnails and upload status"
```

---

### Task 10: Update Navigation — Pass eventId to Status Screen

**Files:**
- Modify: `mobile/src/navigation/RootNavigator.tsx`

- [ ] **Step 1: Update AppStackParamList to include eventId on Status route**

Open `mobile/src/navigation/RootNavigator.tsx`. Change the `Status` route type from `undefined` to accept an optional `eventId`:

Replace:
```typescript
type AppStackParamList = {
  Home: undefined;
  Status: undefined;
  Contacts: undefined;
  Tracking: { initialLocation: GeoLocation; eventId: string };
};
```

With:
```typescript
type AppStackParamList = {
  Home: undefined;
  Status: { eventId: string } | undefined;
  Contacts: undefined;
  Tracking: { initialLocation: GeoLocation; eventId: string };
};
```

- [ ] **Step 2: Commit**

```bash
git add mobile/src/navigation/RootNavigator.tsx
git commit -m "feat: update Status route to accept eventId parameter"
```

---

### Task 11: Update HomeScreen — Trigger Evidence Recording

**Files:**
- Modify: `mobile/src/screens/HomeScreen.tsx`

- [ ] **Step 1: Add evidence recorder integration**

Open `mobile/src/screens/HomeScreen.tsx`.

Add these imports at the top (after the existing imports):

```typescript
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useEvidenceRecorder } from '../hooks/useEvidenceRecorder';
```

Inside the `HomeScreen` component, after the `useVoiceDetection()` call, add:

```typescript
const { state: recorderState, cameraRef, startRecording } = useEvidenceRecorder();
const [cameraPermission, requestCameraPermission] = useCameraPermissions();
```

Modify the `handleSOS` callback. After `setIsTriggered(true);` and before the `Alert.alert('SOS Sent', ...)` line, add the evidence recording trigger:

```typescript
      setIsTriggered(true);

      // Start evidence recording
      if (!cameraPermission?.granted) {
        await requestCameraPermission();
      }
      void startRecording(result.eventId, user.uid);

      Alert.alert('SOS Sent', `Emergency contacts are being notified.\nEvent: ${result.eventId}`);
```

Also modify the `Alert.alert` callback in the SOS Sent alert to navigate to the Status screen with eventId. Replace the plain `Alert.alert` with:

```typescript
      Alert.alert('SOS Sent', `Emergency contacts are being notified.`, [
        {
          text: 'View Status',
          onPress: () => navigation.navigate('Status', { eventId: result.eventId }),
        },
      ]);
```

Finally, add the hidden camera view inside the JSX, just before the closing `</View>` of the root container. This is needed for video recording — the camera must be mounted but can be hidden:

```typescript
      {/* Hidden camera for evidence recording */}
      {isTriggered && recorderState.isRecording && (
        <CameraView
          ref={cameraRef}
          style={styles.hiddenCamera}
          facing="back"
          mode="video"
        />
      )}
    </View>
  );
```

Add this style to the `styles` object:

```typescript
  hiddenCamera: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
```

- [ ] **Step 2: Commit**

```bash
git add mobile/src/screens/HomeScreen.tsx
git commit -m "feat: trigger evidence recording when SOS fires"
```

---

### Task 12: Rewrite StatusScreen — Evidence Section with Camera

**Files:**
- Modify: `mobile/src/screens/StatusScreen.tsx`

- [ ] **Step 1: Rewrite the StatusScreen with evidence display**

Replace the entire contents of `mobile/src/screens/StatusScreen.tsx` with:

```typescript
import React, { useState, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { GeoLocation } from '@guardian/shared-schemas';
import { RecordingIndicator } from '../components/RecordingIndicator';
import { EvidenceList } from '../components/EvidenceList';
import { useEvidenceUpload } from '../hooks/useEvidenceUpload';
import { useEvidenceRecorder } from '../hooks/useEvidenceRecorder';
import { addEvidenceItem } from '../services/evidenceStorage';
import { uploadEventEvidence } from '../services/evidenceUpload';
import { useAuth } from '../contexts/AuthContext';

type StatusScreenProps = NativeStackScreenProps<{
  Home: undefined;
  Status: { eventId: string } | undefined;
  Contacts: undefined;
  Tracking: { initialLocation: GeoLocation; eventId: string };
}, 'Status'>;

export const StatusScreen = ({ route }: StatusScreenProps) => {
  const eventId = route.params?.eventId ?? null;
  const { user } = useAuth();
  const { state: recorderState } = useEvidenceRecorder();
  const { items, uploadedCount, totalCount, retryAll } = useEvidenceUpload(eventId);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [showCamera, setShowCamera] = useState(false);
  const photoCameraRef = useRef<CameraView | null>(null);

  const takePhoto = useCallback(async () => {
    if (!photoCameraRef.current || !eventId || !user) return;

    try {
      const photo = await photoCameraRef.current.takePictureAsync({ quality: 0.8 });
      if (photo?.uri) {
        await addEvidenceItem(eventId, user.uid, 'photo', photo.uri);
        void uploadEventEvidence(eventId);
        setShowCamera(false);
      }
    } catch {
      Alert.alert('Error', 'Failed to take photo');
    }
  }, [eventId, user]);

  const handleOpenCamera = useCallback(async () => {
    if (!cameraPermission?.granted) {
      const result = await requestCameraPermission();
      if (!result.granted) {
        Alert.alert('Permission Denied', 'Camera permission is required to take photos.');
        return;
      }
    }
    setShowCamera(true);
  }, [cameraPermission, requestCameraPermission]);

  if (showCamera) {
    return (
      <View style={styles.cameraContainer}>
        <CameraView
          ref={photoCameraRef}
          style={styles.camera}
          facing="back"
        />
        <View style={styles.cameraControls}>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowCamera(false)}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.captureBtn} onPress={takePhoto}>
            <View style={styles.captureBtnInner} />
          </TouchableOpacity>
          <View style={styles.spacer} />
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>SOS Triggered</Text>
      <Text style={styles.subtitle}>Help is on the way</Text>

      {eventId && <Text style={styles.eventId}>Event: {eventId}</Text>}

      {/* Recording indicator */}
      {recorderState.isRecording && (
        <RecordingIndicator
          audioRemaining={recorderState.audioRemaining}
          videoRemaining={recorderState.videoRemaining}
        />
      )}

      {/* Take Photo button — shown after recording completes */}
      {eventId && recorderState.recordingComplete && (
        <TouchableOpacity style={styles.photoBtn} onPress={handleOpenCamera}>
          <Text style={styles.photoBtnText}>Take Photo</Text>
        </TouchableOpacity>
      )}

      {/* Evidence list */}
      {eventId && (
        <EvidenceList
          items={items}
          uploadedCount={uploadedCount}
          totalCount={totalCount}
          onRetry={retryAll}
        />
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
  },
  content: {
    padding: 20,
  },
  title: {
    color: '#EF4444',
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    color: '#34D399',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  eventId: {
    color: '#6B7280',
    fontSize: 12,
    marginBottom: 24,
    fontFamily: 'monospace',
  },
  photoBtn: {
    backgroundColor: '#1F2937',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderWidth: 2,
    borderColor: '#60A5FA',
    alignItems: 'center',
    marginBottom: 16,
  },
  photoBtnText: {
    color: '#60A5FA',
    fontSize: 16,
    fontWeight: '600',
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  camera: {
    flex: 1,
  },
  cameraControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 40,
    backgroundColor: '#000000',
  },
  cancelBtn: {
    padding: 12,
  },
  cancelBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  captureBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureBtnInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
  },
  spacer: {
    width: 60,
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add mobile/src/screens/StatusScreen.tsx
git commit -m "feat: rewrite StatusScreen with evidence display, camera, and upload status"
```

---

### Task 13: Final Integration Test and Commit

- [ ] **Step 1: Run TypeScript type check**

```bash
cd mobile && npx tsc --noEmit
```

Fix any type errors that appear.

- [ ] **Step 2: Verify all files are committed**

```bash
git status
```

If there are uncommitted changes, stage and commit them:

```bash
git add -A
git commit -m "fix: resolve type errors from Phase 3 integration"
```

- [ ] **Step 3: Push to GitHub**

```bash
git push origin main
```

---

### Task 14: Deploy — Build New APK

- [ ] **Step 1: Build the APK via EAS**

```bash
cd mobile && npx eas build --platform android --profile preview --non-interactive
```

Wait for the build to complete (~10-15 minutes). The output will include a download URL for the APK.

- [ ] **Step 2: Update Firebase Storage security rules**

In the Firebase Console (https://console.firebase.google.com), go to **Storage** → **Rules** and set:

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

Click **Publish**.

- [ ] **Step 3: Verify Firebase Storage is enabled**

In the Firebase Console, go to **Storage**. If not yet enabled, click **Get Started** and choose a region (e.g., `us-central`). The storage bucket URL should match `storageBucket` in your Firebase config.
