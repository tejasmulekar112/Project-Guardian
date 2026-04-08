import { requireNativeModule } from 'expo-modules-core';
import { EventEmitter } from 'expo-modules-core';

type GuardianServiceEvents = {
  onBackgroundSOSTriggered: (event: BackgroundSOSEvent) => void;
};

const GuardianServiceNative = requireNativeModule('GuardianServiceModule');

export const guardianServiceEmitter = new EventEmitter(GuardianServiceNative as unknown as typeof EventEmitter.prototype) as unknown as {
  addListener<K extends keyof GuardianServiceEvents>(
    eventName: K,
    listener: GuardianServiceEvents[K],
  ): { remove: () => void };
};

export const GuardianService = {
  startService: () => GuardianServiceNative.startService(),
  stopService: () => GuardianServiceNative.stopService(),
  isRunning: () => GuardianServiceNative.isRunning(),
  setEnabled: (enabled: boolean) => GuardianServiceNative.setEnabled(enabled),
  isEnabled: () => GuardianServiceNative.isEnabled(),
  setAuthCredentials: (token: string, userId: string, apiUrl: string) =>
    GuardianServiceNative.setAuthCredentials(token, userId, apiUrl),
  clearAuthCredentials: () => GuardianServiceNative.clearAuthCredentials(),
  setKeywords: (keywordsJson: string) => GuardianServiceNative.setKeywords(keywordsJson),
  setCountdownDuration: (seconds: number) => GuardianServiceNative.setCountdownDuration(seconds),
  cancelCountdown: () => GuardianServiceNative.cancelCountdown(),
};

export type BackgroundSOSEvent = {
  eventId: string;
};
