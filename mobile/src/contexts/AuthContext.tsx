import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import { auth } from '../services/firebase';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { registerFcmToken } from '../services/api';
import { Platform } from 'react-native';
import { GuardianService } from '../../modules/guardian-service';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let tokenRefreshInterval: ReturnType<typeof setInterval> | null = null;

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);

      // Clear any existing token refresh interval
      if (tokenRefreshInterval) {
        clearInterval(tokenRefreshInterval);
        tokenRefreshInterval = null;
      }

      // Share auth credentials with native background service (Android only)
      if (Platform.OS === 'android') {
        if (firebaseUser) {
          const syncToken = async () => {
            try {
              const token = await firebaseUser.getIdToken(true);
              const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000';
              await GuardianService.setAuthCredentials(token, firebaseUser.uid, apiUrl);
            } catch (e) {
              console.warn('Failed to refresh auth token for background service:', e);
            }
          };

          try {
            await syncToken();
            // Auto-start service if enabled
            const enabled = await GuardianService.isEnabled();
            if (enabled) {
              await GuardianService.startService();
            }
            // Refresh token every 45 minutes (tokens expire after 1 hour)
            tokenRefreshInterval = setInterval(syncToken, 45 * 60 * 1000);
          } catch (e) {
            console.warn('Failed to set auth credentials for background service:', e);
          }
        } else {
          try {
            await GuardianService.clearAuthCredentials();
          } catch (e) {
            console.warn('Failed to clear auth credentials for background service:', e);
          }
        }
      }
    });
    return () => {
      unsubscribe();
      if (tokenRefreshInterval) {
        clearInterval(tokenRefreshInterval);
      }
    };
  }, []);

  const { expoPushToken } = usePushNotifications();

  useEffect(() => {
    if (user && expoPushToken) {
      registerFcmToken(expoPushToken).catch(() => {
        // Silent fail — will retry on next app launch
      });
    }
  }, [user, expoPushToken]);

  const signIn = async (email: string, password: string): Promise<void> => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signUp = async (email: string, password: string): Promise<void> => {
    await createUserWithEmailAndPassword(auth, email, password);
  };

  const signOut = async (): Promise<void> => {
    if (Platform.OS === 'android') {
      try {
        await GuardianService.clearAuthCredentials();
      } catch (e) {
        console.warn('Failed to clear background service credentials:', e);
      }
    }
    await firebaseSignOut(auth);
  };

  const resetPassword = async (email: string): Promise<void> => {
    await sendPasswordResetEmail(auth, email);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut, resetPassword }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
