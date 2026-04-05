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
