import { useState, useEffect, useCallback } from 'react';
import * as Location from 'expo-location';
import type { GeoLocation } from '@guardian/shared-schemas';

interface UseLocationResult {
  location: GeoLocation | null;
  error: string | null;
  loading: boolean;
  refresh: () => Promise<GeoLocation | null>;
}

export function useLocation(): UseLocationResult {
  const [location, setLocation] = useState<GeoLocation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const requestAndGetLocation = useCallback(async (): Promise<GeoLocation | null> => {
    setLoading(true);
    setError(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Location permission denied');
        setLoading(false);
        return null;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const geo: GeoLocation = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracyMeters: position.coords.accuracy ?? undefined,
      };

      setLocation(geo);
      setLoading(false);
      return geo;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to get location';
      setError(msg);
      setLoading(false);
      return null;
    }
  }, []);

  useEffect(() => {
    void requestAndGetLocation();
  }, []);

  return { location, error, loading, refresh: requestAndGetLocation };
}
