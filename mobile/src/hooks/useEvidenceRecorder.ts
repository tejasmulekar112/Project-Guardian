import { useCallback, useRef, useState } from 'react';
import { Audio } from 'expo-av';
import { CameraView } from 'expo-camera';
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
