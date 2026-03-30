import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import type { VoiceDetectionResult } from '@guardian/shared-schemas';

const DISTRESS_KEYWORDS = [
  'help',
  'help me',
  'emergency',
  'call the police',
  'someone help',
  'save me',
  'danger',
  'stop',
  'sos',
  'bachao',
  'please help',
];

interface UseVoiceDetectionReturn {
  isListening: boolean;
  detection: VoiceDetectionResult | null;
  error: string | null;
  startListening: () => Promise<void>;
  stopListening: () => Promise<void>;
  clearDetection: () => void;
}

function checkKeywords(transcript: string): { detected: boolean; keyword: string | null } {
  const lower = transcript.toLowerCase();
  for (const keyword of DISTRESS_KEYWORDS) {
    if (lower.includes(keyword)) {
      return { detected: true, keyword };
    }
  }
  return { detected: false, keyword: null };
}

export function useVoiceDetection(): UseVoiceDetectionReturn {
  const [isListening, setIsListening] = useState(false);
  const [detection, setDetection] = useState<VoiceDetectionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const activeRef = useRef(false);

  useSpeechRecognitionEvent('result', (event) => {
    if (!activeRef.current) return;

    // Collect all transcripts from results
    const transcript = event.results
      .map((r) => r.transcript)
      .join(' ')
      .trim();
    if (!transcript) return;

    console.log('Speech recognized:', transcript);

    const { detected, keyword } = checkKeywords(transcript);
    if (detected) {
      activeRef.current = false;
      setIsListening(false);
      setDetection({
        detected: true,
        transcript,
        keyword: keyword ?? '',
        confidence: 1.0,
      });
      ExpoSpeechRecognitionModule.stop();
    }
  });

  useSpeechRecognitionEvent('end', () => {
    // Auto-restart if still supposed to be listening
    if (activeRef.current) {
      ExpoSpeechRecognitionModule.start({
        lang: 'en-US',
        interimResults: true,
        continuous: true,
        contextualStrings: DISTRESS_KEYWORDS,
      });
    }
  });

  useSpeechRecognitionEvent('error', (event) => {
    console.error('Speech recognition error:', event.error);
    // Restart on transient errors
    if (activeRef.current && event.error !== 'not-allowed') {
      setTimeout(() => {
        if (activeRef.current) {
          ExpoSpeechRecognitionModule.start({
            lang: 'en-US',
            interimResults: true,
            continuous: true,
            contextualStrings: DISTRESS_KEYWORDS,
          });
        }
      }, 1000);
    } else if (event.error === 'not-allowed') {
      setError('Microphone permission denied');
      activeRef.current = false;
      setIsListening(false);
    }
  });

  const startListening = useCallback(async () => {
    setError(null);
    setDetection(null);

    const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!granted) {
      setError('Microphone permission denied');
      return;
    }

    activeRef.current = true;
    setIsListening(true);

    ExpoSpeechRecognitionModule.start({
      lang: 'en-US',
      interimResults: true,
      continuous: true,
      contextualStrings: DISTRESS_KEYWORDS,
    });
  }, []);

  const stopListening = useCallback(async () => {
    activeRef.current = false;
    setIsListening(false);
    ExpoSpeechRecognitionModule.stop();
  }, []);

  const clearDetection = useCallback(() => {
    setDetection(null);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      activeRef.current = false;
      ExpoSpeechRecognitionModule.stop();
    };
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
