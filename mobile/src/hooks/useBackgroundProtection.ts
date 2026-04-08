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

const isAndroid = Platform.OS === 'android';

export function useBackgroundProtection(): UseBackgroundProtectionReturn {
  const [isRunning, setIsRunning] = useState(false);
  const [isEnabled, setIsEnabled] = useState(true);
  const [backgroundSOSEventId, setBackgroundSOSEventId] = useState<string | null>(null);

  useEffect(() => {
    if (!isAndroid) return;

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
    if (!isAndroid) return;
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
    isRunning: isAndroid ? isRunning : false,
    isEnabled: isAndroid ? isEnabled : false,
    toggle,
    backgroundSOSEventId: isAndroid ? backgroundSOSEventId : null,
    clearBackgroundSOS,
  };
}
