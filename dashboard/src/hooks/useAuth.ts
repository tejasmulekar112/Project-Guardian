import { useState, useEffect, useCallback } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

interface AuthState {
  user: User | null;
  isAdmin: boolean;
  loading: boolean;
  error: string | null;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAdmin: false,
    loading: true,
    error: null,
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const adminDoc = await getDoc(doc(db, 'admins', user.uid));
          if (adminDoc.exists()) {
            setState({ user, isAdmin: true, loading: false, error: null });
          } else {
            await firebaseSignOut(auth);
            setState({
              user: null,
              isAdmin: false,
              loading: false,
              error: 'Access denied. You are not an admin.',
            });
          }
        } catch (e) {
          console.error('Auth state check failed:', e);
          setState({ user: null, isAdmin: false, loading: false, error: 'Authentication error.' });
        }
      } else {
        setState({ user: null, isAdmin: false, loading: false, error: null });
      }
    });
    return unsubscribe;
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: 'Invalid email or password.',
      }));
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await firebaseSignOut(auth);
    } catch (e) {
      console.error('Sign out failed:', e);
    }
  }, []);

  return { ...state, signIn, signOut };
}
