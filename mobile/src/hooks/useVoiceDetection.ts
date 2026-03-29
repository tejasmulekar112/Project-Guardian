import { useCallback, useRef, useState } from 'react';
import { Audio } from 'expo-av';
import type { VoiceDetectionResult } from '@guardian/shared-schemas';
import { detectVoice } from '../services/api';

const CHUNK_DURATION_MS = 5000;
const MAX_SILENT_CHUNKS = 6; // 30 seconds of silence before pausing

interface UseVoiceDetectionReturn {
  isListening: boolean;
  detection: VoiceDetectionResult | null;
  error: string | null;
  startListening: () => Promise<void>;
  stopListening: () => Promise<void>;
  clearDetection: () => void;
}

export function useVoiceDetection(): UseVoiceDetectionReturn {
  const [isListening, setIsListening] = useState(false);
  const [detection, setDetection] = useState<VoiceDetectionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const silentChunksRef = useRef(0);
  const activeRef = useRef(false);

  const recordAndDetect = useCallback(async (): Promise<void> => {
    if (!activeRef.current) return;

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

      recordingRef.current = recording;
      await recording.startAsync();

      // Wait for chunk duration
      await new Promise((resolve) => setTimeout(resolve, CHUNK_DURATION_MS));

      if (!activeRef.current) {
        await recording.stopAndUnloadAsync();
        return;
      }

      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      recordingRef.current = null;

      if (!uri) {
        // No audio captured, continue
        void recordAndDetect();
        return;
      }

      // Send to backend for detection
      try {
        const result = await detectVoice(uri);

        if (result.detected) {
          // Distress detected — stop listening and notify
          activeRef.current = false;
          setIsListening(false);
          setDetection(result);
          silentChunksRef.current = 0;
          return;
        }

        // Track silent/non-distress chunks
        if (!result.transcript || result.transcript.trim() === '') {
          silentChunksRef.current += 1;
        } else {
          silentChunksRef.current = 0;
        }

        // Pause if too many silent chunks
        if (silentChunksRef.current >= MAX_SILENT_CHUNKS) {
          silentChunksRef.current = 0;
          // Brief pause then resume
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      } catch {
        // API error — skip this chunk, continue recording
      }

      // Continue recording next chunk
      void recordAndDetect();
    } catch (err) {
      if (activeRef.current) {
        setError(err instanceof Error ? err.message : 'Recording failed');
        activeRef.current = false;
        setIsListening(false);
      }
    }
  }, []);

  const startListening = useCallback(async () => {
    setError(null);
    setDetection(null);
    silentChunksRef.current = 0;

    const { granted } = await Audio.requestPermissionsAsync();
    if (!granted) {
      setError('Microphone permission denied');
      return;
    }

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });

    activeRef.current = true;
    setIsListening(true);
    void recordAndDetect();
  }, [recordAndDetect]);

  const stopListening = useCallback(async () => {
    activeRef.current = false;
    setIsListening(false);

    if (recordingRef.current) {
      try {
        await recordingRef.current.stopAndUnloadAsync();
      } catch {
        // Already stopped
      }
      recordingRef.current = null;
    }
  }, []);

  const clearDetection = useCallback(() => {
    setDetection(null);
  }, []);

  return {
    isListening,
    detection,
    error,
    startListening,
    stopListening,
    clearDetection,
  };
}
