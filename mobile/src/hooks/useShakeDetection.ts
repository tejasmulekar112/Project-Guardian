import { useCallback, useEffect, useRef, useState } from 'react';
import { Accelerometer } from 'expo-sensors';

const SHAKE_THRESHOLD = 1.8;  // G-force threshold for a shake
const SHAKE_COUNT_NEEDED = 3; // Number of shakes to trigger
const SHAKE_WINDOW_MS = 2000; // Time window for consecutive shakes
const COOLDOWN_MS = 500;      // Minimum time between individual shakes

interface UseShakeDetectionReturn {
  isActive: boolean;
  shakeDetected: boolean;
  start: () => void;
  stop: () => void;
  clearDetection: () => void;
}

export function useShakeDetection(): UseShakeDetectionReturn {
  const [isActive, setIsActive] = useState(false);
  const [shakeDetected, setShakeDetected] = useState(false);
  const shakeTimestamps = useRef<number[]>([]);
  const lastShakeTime = useRef(0);
  const subscriptionRef = useRef<ReturnType<typeof Accelerometer.addListener> | null>(null);

  const handleAccelerometerData = useCallback(
    (data: { x: number; y: number; z: number }) => {
      const totalForce = Math.sqrt(data.x ** 2 + data.y ** 2 + data.z ** 2);

      if (totalForce < SHAKE_THRESHOLD) return;

      const now = Date.now();
      if (now - lastShakeTime.current < COOLDOWN_MS) return;
      lastShakeTime.current = now;

      // Add timestamp and prune old ones outside the window
      shakeTimestamps.current.push(now);
      shakeTimestamps.current = shakeTimestamps.current.filter(
        (t) => now - t < SHAKE_WINDOW_MS,
      );

      if (shakeTimestamps.current.length >= SHAKE_COUNT_NEEDED) {
        shakeTimestamps.current = [];
        setShakeDetected(true);
      }
    },
    [],
  );

  const start = useCallback(() => {
    setShakeDetected(false);
    shakeTimestamps.current = [];
    lastShakeTime.current = 0;

    Accelerometer.setUpdateInterval(100);
    subscriptionRef.current = Accelerometer.addListener(handleAccelerometerData);
    setIsActive(true);
  }, [handleAccelerometerData]);

  const stop = useCallback(() => {
    subscriptionRef.current?.remove();
    subscriptionRef.current = null;
    setIsActive(false);
    shakeTimestamps.current = [];
  }, []);

  const clearDetection = useCallback(() => {
    setShakeDetected(false);
    shakeTimestamps.current = [];
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      subscriptionRef.current?.remove();
      subscriptionRef.current = null;
    };
  }, []);

  return { isActive, shakeDetected, start, stop, clearDetection };
}
