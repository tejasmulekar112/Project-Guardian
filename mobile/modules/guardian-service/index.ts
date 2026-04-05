import { NativeModule, requireNativeModule } from 'expo-modules-core';
import { EventEmitter } from 'expo-modules-core';

interface GuardianServiceModuleType extends NativeModule {
  startService(): Promise<void>;
  stopService(): Promise<void>;
  isRunning(): Promise<boolean>;
  setEnabled(enabled: boolean): Promise<void>;
  isEnabled(): Promise<boolean>;
  setAuthCredentials(token: string, userId: string, apiUrl: string): Promise<void>;
  clearAuthCredentials(): Promise<void>;
}

const GuardianServiceNative = requireNativeModule<GuardianServiceModuleType>('GuardianServiceModule');

export const guardianServiceEmitter = new EventEmitter(GuardianServiceNative);

export const GuardianService = {
  startService: () => GuardianServiceNative.startService(),
  stopService: () => GuardianServiceNative.stopService(),
  isRunning: () => GuardianServiceNative.isRunning(),
  setEnabled: (enabled: boolean) => GuardianServiceNative.setEnabled(enabled),
  isEnabled: () => GuardianServiceNative.isEnabled(),
  setAuthCredentials: (token: string, userId: string, apiUrl: string) =>
    GuardianServiceNative.setAuthCredentials(token, userId, apiUrl),
  clearAuthCredentials: () => GuardianServiceNative.clearAuthCredentials(),
};

export type BackgroundSOSEvent = {
  eventId: string;
};
