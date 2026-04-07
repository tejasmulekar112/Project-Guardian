import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { GuardianService } from '../../modules/guardian-service';

const KEYWORDS_KEY = '@guardian_keywords';
const COUNTDOWN_KEY = '@guardian_countdown_duration';

const DEFAULT_KEYWORDS = [
  'help', 'help me', 'save me', 'emergency',
  'bachao', 'bacha', 'madad', 'sos',
];
const DEFAULT_COUNTDOWN_SECONDS = 10;

interface UseSettingsReturn {
  keywords: string[];
  countdownSeconds: number;
  loading: boolean;
  setKeywords: (keywords: string[]) => Promise<void>;
  setCountdownSeconds: (seconds: number) => Promise<void>;
  addKeyword: (keyword: string) => Promise<void>;
  removeKeyword: (keyword: string) => Promise<void>;
  resetKeywords: () => Promise<void>;
}

export function useSettings(): UseSettingsReturn {
  const [keywords, setKeywordsState] = useState<string[]>(DEFAULT_KEYWORDS);
  const [countdownSeconds, setCountdownState] = useState(DEFAULT_COUNTDOWN_SECONDS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [savedKeywords, savedCountdown] = await Promise.all([
        AsyncStorage.getItem(KEYWORDS_KEY),
        AsyncStorage.getItem(COUNTDOWN_KEY),
      ]);
      if (savedKeywords) {
        try {
          setKeywordsState(JSON.parse(savedKeywords));
        } catch {}
      }
      if (savedCountdown) {
        const parsed = parseInt(savedCountdown, 10);
        if (!isNaN(parsed)) setCountdownState(parsed);
      }
      setLoading(false);
    })();
  }, []);

  const syncKeywordsToNative = useCallback(async (kw: string[]) => {
    if (Platform.OS === 'android') {
      try {
        await GuardianService.setKeywords(JSON.stringify(kw));
      } catch {}
    }
  }, []);

  const syncCountdownToNative = useCallback(async (seconds: number) => {
    if (Platform.OS === 'android') {
      try {
        await GuardianService.setCountdownDuration(seconds);
      } catch {}
    }
  }, []);

  const setKeywords = useCallback(async (kw: string[]) => {
    if (kw.length === 0) return;
    setKeywordsState(kw);
    await AsyncStorage.setItem(KEYWORDS_KEY, JSON.stringify(kw));
    await syncKeywordsToNative(kw);
  }, [syncKeywordsToNative]);

  const addKeyword = useCallback(async (keyword: string) => {
    const trimmed = keyword.trim().toLowerCase();
    if (!trimmed) return;
    setKeywordsState((prev) => {
      if (prev.includes(trimmed)) return prev;
      const updated = [...prev, trimmed];
      AsyncStorage.setItem(KEYWORDS_KEY, JSON.stringify(updated));
      syncKeywordsToNative(updated);
      return updated;
    });
  }, [syncKeywordsToNative]);

  const removeKeyword = useCallback(async (keyword: string) => {
    setKeywordsState((prev) => {
      const updated = prev.filter((k) => k !== keyword);
      if (updated.length === 0) return prev;
      AsyncStorage.setItem(KEYWORDS_KEY, JSON.stringify(updated));
      syncKeywordsToNative(updated);
      return updated;
    });
  }, [syncKeywordsToNative]);

  const resetKeywords = useCallback(async () => {
    setKeywordsState(DEFAULT_KEYWORDS);
    await AsyncStorage.setItem(KEYWORDS_KEY, JSON.stringify(DEFAULT_KEYWORDS));
    await syncKeywordsToNative(DEFAULT_KEYWORDS);
  }, [syncKeywordsToNative]);

  const setCountdownSeconds = useCallback(async (seconds: number) => {
    setCountdownState(seconds);
    await AsyncStorage.setItem(COUNTDOWN_KEY, String(seconds));
    await syncCountdownToNative(seconds);
  }, [syncCountdownToNative]);

  return {
    keywords,
    countdownSeconds,
    loading,
    setKeywords,
    setCountdownSeconds,
    addKeyword,
    removeKeyword,
    resetKeywords,
  };
}
