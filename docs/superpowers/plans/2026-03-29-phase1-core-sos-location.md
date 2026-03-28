# Phase 1: Core SOS & Location — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the scaffolded Project Guardian monorepo into a working SOS system where a user can register, log in, press the SOS button, and have their emergency contacts notified via SMS and push notification with a live location link.

**Architecture:** Firebase JS SDK on mobile for auth, Firebase Admin SDK on backend for Firestore + FCM + token verification. SOS flow: mobile captures GPS → POST /sos/trigger with auth token → backend stores event in Firestore → sends Twilio SMS + FCM push to emergency contacts. expo-location for GPS, expo-notifications for push token registration.

**Tech Stack:** FastAPI, Firebase Admin SDK, Firebase JS SDK v10, Twilio REST API, expo-location, expo-notifications, react-native-maps

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `backend/app/firebase_init.py` | One-time Firebase Admin SDK initialization |
| `backend/app/routers/users.py` | User profile + emergency contacts CRUD |
| `backend/app/models/user.py` | Pydantic models for user profile requests |
| `backend/tests/test_health.py` | Separated health tests |
| `backend/tests/test_users.py` | User profile endpoint tests |
| `mobile/src/contexts/AuthContext.tsx` | Auth state provider + Firebase listener |
| `mobile/src/screens/LoginScreen.tsx` | Email/password login |
| `mobile/src/screens/RegisterScreen.tsx` | Email/password registration |
| `mobile/src/screens/ContactsScreen.tsx` | Emergency contact management |
| `mobile/src/screens/TrackingScreen.tsx` | Live map after SOS trigger |
| `mobile/src/hooks/useLocation.ts` | GPS permission + location capture |

### Modified Files
| File | Changes |
|------|---------|
| `backend/app/main.py` | Add Firebase init lifespan, users router |
| `backend/app/middleware/auth.py` | Replace stub with real Firebase token verification |
| `backend/app/services/firebase_service.py` | Replace stubs with real Firestore + FCM calls |
| `backend/app/services/twilio_service.py` | Replace stub with real Twilio SMS |
| `backend/app/routers/sos.py` | Wire real services, add auth dependency |
| `backend/tests/test_sos.py` | Update for auth + real service mocks |
| `mobile/src/services/firebase.ts` | Real Firebase JS SDK init |
| `mobile/src/services/api.ts` | Add auth token header, new endpoint functions |
| `mobile/src/screens/HomeScreen.tsx` | GPS capture + real API call |
| `mobile/src/navigation/RootNavigator.tsx` | Auth-gated navigation, new screens |
| `mobile/package.json` | Add firebase, expo-notifications deps |
| `mobile/app.json` | Add expo-notifications plugin |

---

## Task 0: Firebase Project Setup (Console)

This is a manual prerequisite — no code, just config.

- [ ] **Step 1: Create Firebase project**

Go to https://console.firebase.google.com → Create project "project-guardian".

- [ ] **Step 2: Enable Authentication**

Firebase Console → Authentication → Sign-in method → Enable "Email/Password".

- [ ] **Step 3: Create Firestore database**

Firebase Console → Firestore Database → Create database → Start in **test mode** (we'll add security rules later).

- [ ] **Step 4: Enable Cloud Messaging**

Firebase Console → Cloud Messaging → should be enabled by default for new projects.

- [ ] **Step 5: Download service account key**

Firebase Console → Project Settings → Service accounts → Generate new private key → Save as `backend/firebase-service-account.json` (already in .gitignore).

- [ ] **Step 6: Get web app config**

Firebase Console → Project Settings → General → Add web app → Copy the `firebaseConfig` object.

- [ ] **Step 7: Create .env files**

```bash
# backend/.env
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_PHONE=
GOOGLE_MAPS_API_KEY=
DEBUG=true
CORS_ORIGINS=http://localhost:19006
BACKEND_HOST=0.0.0.0
BACKEND_PORT=8000
```

```bash
# mobile/.env
EXPO_PUBLIC_API_URL=http://localhost:8000
EXPO_PUBLIC_FIREBASE_API_KEY=your-api-key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
EXPO_PUBLIC_FIREBASE_APP_ID=your-app-id
```

- [ ] **Step 8: Commit config changes**

```bash
git add backend/.env.example mobile/.env.example
git commit -m "chore: update .env.example with full Firebase config fields"
```

---

## Task 1: Backend — Firebase Admin SDK Init + Auth Middleware

**Files:**
- Create: `backend/app/firebase_init.py`
- Modify: `backend/app/main.py`
- Modify: `backend/app/middleware/auth.py`
- Modify: `backend/app/routers/sos.py`
- Modify: `backend/tests/test_sos.py`

- [ ] **Step 1: Install firebase-admin**

```bash
cd backend && .venv/Scripts/python.exe -m pip install firebase-admin
```

- [ ] **Step 2: Create Firebase init module**

Create `backend/app/firebase_init.py`:

```python
import firebase_admin
from firebase_admin import credentials

from app.config import settings


def init_firebase() -> None:
    """Initialize Firebase Admin SDK. Safe to call multiple times."""
    if firebase_admin._apps:
        return
    cred = credentials.Certificate(settings.firebase_service_account_path)
    firebase_admin.initialize_app(cred, {
        "projectId": settings.firebase_project_id,
    })
```

- [ ] **Step 3: Add lifespan to main.py**

Modify `backend/app/main.py`:

```python
from contextlib import asynccontextmanager
from collections.abc import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.firebase_init import init_firebase
from app.routers import health, sos, users


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    init_firebase()
    yield


app = FastAPI(title="Project Guardian API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/health", tags=["health"])
app.include_router(sos.router, prefix="/sos", tags=["sos"])
```

Note: `users` router import is added here but will be registered in Task 3.

- [ ] **Step 4: Implement real auth middleware**

Replace contents of `backend/app/middleware/auth.py`:

```python
from fastapi import HTTPException, Security
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from firebase_admin import auth

security = HTTPBearer(auto_error=False)


async def verify_firebase_token(
    credentials: HTTPAuthorizationCredentials | None = Security(security),
) -> dict:
    """Verify Firebase Auth ID token from Authorization header."""
    if credentials is None:
        raise HTTPException(status_code=401, detail="Missing authorization header")

    try:
        decoded = auth.verify_id_token(credentials.credentials)
    except auth.InvalidIdTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    except auth.ExpiredIdTokenError:
        raise HTTPException(status_code=401, detail="Token expired")
    except Exception:
        raise HTTPException(status_code=401, detail="Token verification failed")

    return decoded
```

- [ ] **Step 5: Add auth to SOS router**

Modify `backend/app/routers/sos.py` to require auth:

```python
import uuid

from fastapi import APIRouter, Depends

from app.middleware.auth import verify_firebase_token
from app.models.sos_event import SOSStatus, SOSTriggerRequest, SOSTriggerResponse

router = APIRouter()


@router.post("/trigger", response_model=SOSTriggerResponse)
async def trigger_sos(
    payload: SOSTriggerRequest,
    user: dict = Depends(verify_firebase_token),
) -> SOSTriggerResponse:
    """SOS Flow: Trigger -> store in Firestore -> notify via FCM -> SMS via Twilio."""
    event_id = str(uuid.uuid4())

    # TODO (Task 3): Wire Firestore storage
    # TODO (Task 5): Wire Twilio SMS
    # TODO (Task 6): Wire FCM push

    return SOSTriggerResponse(event_id=event_id, status=SOSStatus.DISPATCHED)
```

- [ ] **Step 6: Update tests to mock auth**

Replace `backend/tests/test_sos.py`:

```python
from unittest.mock import patch

from fastapi.testclient import TestClient


MOCK_USER = {"uid": "test-user-001", "email": "test@example.com"}


def test_trigger_sos(client: TestClient) -> None:
    with patch("app.middleware.auth.auth.verify_id_token", return_value=MOCK_USER):
        response = client.post(
            "/sos/trigger",
            headers={"Authorization": "Bearer fake-token"},
            json={
                "user_id": "test-user-001",
                "location": {
                    "latitude": 28.6139,
                    "longitude": 77.2090,
                    "accuracy_meters": 10.0,
                },
                "trigger_type": "manual",
                "message": "Test SOS event",
            },
        )
    assert response.status_code == 200
    data = response.json()
    assert "event_id" in data
    assert data["status"] == "dispatched"


def test_trigger_sos_minimal(client: TestClient) -> None:
    with patch("app.middleware.auth.auth.verify_id_token", return_value=MOCK_USER):
        response = client.post(
            "/sos/trigger",
            headers={"Authorization": "Bearer fake-token"},
            json={
                "user_id": "test-user-002",
                "location": {"latitude": 0.0, "longitude": 0.0},
            },
        )
    assert response.status_code == 200
    assert response.json()["status"] == "dispatched"


def test_trigger_sos_invalid_payload(client: TestClient) -> None:
    with patch("app.middleware.auth.auth.verify_id_token", return_value=MOCK_USER):
        response = client.post(
            "/sos/trigger",
            headers={"Authorization": "Bearer fake-token"},
            json={},
        )
    assert response.status_code == 422


def test_trigger_sos_no_auth(client: TestClient) -> None:
    response = client.post(
        "/sos/trigger",
        json={
            "user_id": "test-user-001",
            "location": {"latitude": 28.6139, "longitude": 77.2090},
        },
    )
    assert response.status_code == 401
```

- [ ] **Step 7: Mock Firebase init in conftest**

Update `backend/tests/conftest.py`:

```python
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture(autouse=True)
def mock_firebase_init():
    with patch("app.firebase_init.init_firebase"):
        yield


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)
```

- [ ] **Step 8: Run tests**

```bash
cd backend && .venv/Scripts/python.exe -m pytest tests/ -v
```

Expected: 4 tests pass (trigger, minimal, invalid_payload, no_auth).

- [ ] **Step 9: Commit**

```bash
git add backend/app/firebase_init.py backend/app/main.py backend/app/middleware/auth.py backend/app/routers/sos.py backend/tests/
git commit -m "feat(backend): add Firebase Admin SDK init and real auth middleware"
```

---

## Task 2: Mobile — Firebase Auth (Login/Register)

**Files:**
- Modify: `mobile/package.json`
- Modify: `mobile/src/services/firebase.ts`
- Create: `mobile/src/contexts/AuthContext.tsx`
- Create: `mobile/src/screens/LoginScreen.tsx`
- Create: `mobile/src/screens/RegisterScreen.tsx`
- Modify: `mobile/src/navigation/RootNavigator.tsx`
- Modify: `mobile/src/services/api.ts`
- Modify: `mobile/.env.example`

- [ ] **Step 1: Install Firebase JS SDK**

```bash
cd d:/Projects/SOS_app && npm install firebase --workspace=mobile
```

- [ ] **Step 2: Complete Firebase init service**

Replace `mobile/src/services/firebase.ts`:

```typescript
import { initializeApp } from 'firebase/app';
import { getAuth, initializeAuth, getReactNativePersistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

export const firebaseApp = initializeApp(firebaseConfig);

export const auth = initializeAuth(firebaseApp, {
  persistence: getReactNativePersistence(AsyncStorage),
});
```

- [ ] **Step 3: Install AsyncStorage**

```bash
cd d:/Projects/SOS_app && npm install @react-native-async-storage/async-storage --workspace=mobile
```

- [ ] **Step 4: Create AuthContext**

Create `mobile/src/contexts/AuthContext.tsx`:

```tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import { auth } from '../services/firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const signIn = async (email: string, password: string): Promise<void> => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signUp = async (email: string, password: string): Promise<void> => {
    await createUserWithEmailAndPassword(auth, email, password);
  };

  const signOut = async (): Promise<void> => {
    await firebaseSignOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut }}>
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
```

- [ ] **Step 5: Create LoginScreen**

Create `mobile/src/screens/LoginScreen.tsx`:

```tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../contexts/AuthContext';

interface LoginScreenProps {
  navigation: NativeStackNavigationProp<{ Login: undefined; Register: undefined }>;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ navigation }) => {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (): Promise<void> => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    setLoading(true);
    try {
      await signIn(email, password);
    } catch (error) {
      Alert.alert('Login Failed', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Project Guardian</Text>
      <Text style={styles.subtitle}>Sign in to continue</Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor="#6B7280"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor="#6B7280"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.buttonText}>Sign In</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.navigate('Register')}>
        <Text style={styles.link}>Don't have an account? Register</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#111827',
    padding: 24,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    color: '#9CA3AF',
    fontSize: 16,
    marginBottom: 32,
  },
  input: {
    width: '100%',
    backgroundColor: '#1F2937',
    color: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    fontSize: 16,
  },
  button: {
    width: '100%',
    backgroundColor: '#DC2626',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  link: {
    color: '#60A5FA',
    fontSize: 14,
  },
});
```

- [ ] **Step 6: Create RegisterScreen**

Create `mobile/src/screens/RegisterScreen.tsx`:

```tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';

export const RegisterScreen: React.FC = () => {
  const { signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async (): Promise<void> => {
    if (!email || !password || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      await signUp(email, password);
    } catch (error) {
      Alert.alert('Registration Failed', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create Account</Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor="#6B7280"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor="#6B7280"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <TextInput
        style={styles.input}
        placeholder="Confirm Password"
        placeholderTextColor="#6B7280"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
      />

      <TouchableOpacity style={styles.button} onPress={handleRegister} disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.buttonText}>Register</Text>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#111827',
    padding: 24,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 32,
  },
  input: {
    width: '100%',
    backgroundColor: '#1F2937',
    color: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    fontSize: 16,
  },
  button: {
    width: '100%',
    backgroundColor: '#DC2626',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
```

- [ ] **Step 7: Update RootNavigator with auth-gated navigation**

Replace `mobile/src/navigation/RootNavigator.tsx`:

```tsx
import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { HomeScreen } from '../screens/HomeScreen';
import { StatusScreen } from '../screens/StatusScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
import { ContactsScreen } from '../screens/ContactsScreen';

type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

type AppStackParamList = {
  Home: undefined;
  Status: undefined;
  Contacts: undefined;
};

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const AppStack = createNativeStackNavigator<AppStackParamList>();

const headerOptions = {
  headerStyle: { backgroundColor: '#111827' },
  headerTintColor: '#FFFFFF',
  headerTitleStyle: { fontWeight: 'bold' as const },
};

const AuthNavigator: React.FC = () => (
  <AuthStack.Navigator screenOptions={headerOptions}>
    <AuthStack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
    <AuthStack.Screen name="Register" component={RegisterScreen} options={{ title: 'Register' }} />
  </AuthStack.Navigator>
);

const AppNavigator: React.FC = () => (
  <AppStack.Navigator screenOptions={headerOptions}>
    <AppStack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
    <AppStack.Screen name="Status" component={StatusScreen} options={{ title: 'SOS Status' }} />
    <AppStack.Screen name="Contacts" component={ContactsScreen} options={{ title: 'Emergency Contacts' }} />
  </AppStack.Navigator>
);

const NavigationContent: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#111827' }}>
        <ActivityIndicator size="large" color="#DC2626" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {user ? <AppNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
};

export const RootNavigator: React.FC = () => (
  <AuthProvider>
    <NavigationContent />
  </AuthProvider>
);
```

Note: `ContactsScreen` is imported here but will be created in Task 7. Create a placeholder file for now to avoid import errors.

- [ ] **Step 8: Update api.ts to send auth token**

Replace `mobile/src/services/api.ts`:

```typescript
import type { SOSTriggerRequest, SOSTriggerResponse } from '@guardian/shared-schemas';
import { auth } from './firebase';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000';

async function getAuthHeaders(): Promise<Record<string, string>> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Not authenticated');
  }
  const token = await user.getIdToken();
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };
}

export async function triggerSOS(payload: SOSTriggerRequest): Promise<SOSTriggerResponse> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_URL}/sos/trigger`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`SOS trigger failed: ${response.status}`);
  }

  return response.json() as Promise<SOSTriggerResponse>;
}

export async function healthCheck(): Promise<{ status: string }> {
  const response = await fetch(`${API_URL}/health`);
  return response.json() as Promise<{ status: string }>;
}
```

- [ ] **Step 9: Create placeholder ContactsScreen**

Create `mobile/src/screens/ContactsScreen.tsx`:

```tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export const ContactsScreen: React.FC = () => (
  <View style={styles.container}>
    <Text style={styles.title}>Emergency Contacts</Text>
    <Text style={styles.placeholder}>Contact management coming soon</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#111827',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  placeholder: {
    color: '#9CA3AF',
    fontSize: 16,
  },
});
```

- [ ] **Step 10: Update .env.example**

Update `mobile/.env.example`:

```
EXPO_PUBLIC_API_URL=http://localhost:8000
EXPO_PUBLIC_FIREBASE_API_KEY=
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=
EXPO_PUBLIC_FIREBASE_PROJECT_ID=
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
EXPO_PUBLIC_FIREBASE_APP_ID=
```

- [ ] **Step 11: Commit**

```bash
git add mobile/
git commit -m "feat(mobile): add Firebase Auth with login/register screens and auth-gated navigation"
```

---

## Task 3: Backend — Firestore Integration (SOS Events + User Profiles)

**Files:**
- Modify: `backend/app/services/firebase_service.py`
- Create: `backend/app/models/user.py`
- Create: `backend/app/routers/users.py`
- Modify: `backend/app/routers/sos.py`
- Modify: `backend/app/main.py`
- Create: `backend/tests/test_users.py`
- Modify: `backend/tests/test_sos.py`

- [ ] **Step 1: Create user models**

Create `backend/app/models/user.py`:

```python
from pydantic import BaseModel


class EmergencyContactRequest(BaseModel):
    name: str
    phone: str
    relationship: str


class UserProfileRequest(BaseModel):
    display_name: str
    phone: str


class UserProfileResponse(BaseModel):
    uid: str
    display_name: str
    phone: str
    emergency_contacts: list[EmergencyContactRequest]


class EmergencyContactResponse(BaseModel):
    contacts: list[EmergencyContactRequest]
```

- [ ] **Step 2: Implement Firestore operations in firebase_service**

Replace `backend/app/services/firebase_service.py`:

```python
import time

from firebase_admin import firestore, messaging

from app.models.sos_event import SOSTriggerRequest


class FirebaseService:
    """Firebase Firestore and FCM operations."""

    @staticmethod
    def _db():
        return firestore.client()

    @staticmethod
    async def create_sos_event(payload: SOSTriggerRequest, event_id: str) -> str:
        """Store an SOS event in Firestore."""
        db = FirebaseService._db()
        doc_ref = db.collection("sos_events").document(event_id)
        doc_ref.set({
            "user_id": payload.user_id,
            "latitude": payload.location.latitude,
            "longitude": payload.location.longitude,
            "accuracy_meters": payload.location.accuracy_meters,
            "trigger_type": payload.trigger_type.value,
            "message": payload.message,
            "status": "triggered",
            "created_at": time.time(),
            "updated_at": time.time(),
        })
        return event_id

    @staticmethod
    async def get_user_contacts(user_id: str) -> list[dict]:
        """Get emergency contacts for a user from Firestore."""
        db = FirebaseService._db()
        doc = db.collection("users").document(user_id).get()
        if not doc.exists:
            return []
        data = doc.to_dict()
        return data.get("emergency_contacts", [])

    @staticmethod
    async def get_user_profile(user_id: str) -> dict | None:
        """Get user profile from Firestore."""
        db = FirebaseService._db()
        doc = db.collection("users").document(user_id).get()
        if not doc.exists:
            return None
        return doc.to_dict() | {"uid": user_id}

    @staticmethod
    async def upsert_user_profile(user_id: str, display_name: str, phone: str) -> None:
        """Create or update user profile in Firestore."""
        db = FirebaseService._db()
        db.collection("users").document(user_id).set(
            {"display_name": display_name, "phone": phone},
            merge=True,
        )

    @staticmethod
    async def set_emergency_contacts(user_id: str, contacts: list[dict]) -> None:
        """Replace all emergency contacts for a user."""
        db = FirebaseService._db()
        db.collection("users").document(user_id).set(
            {"emergency_contacts": contacts},
            merge=True,
        )

    @staticmethod
    async def notify_contacts(user_id: str, event_id: str, maps_url: str) -> int:
        """Send FCM push notifications to emergency contacts that have FCM tokens."""
        contacts = await FirebaseService.get_user_contacts(user_id)
        sent_count = 0
        for contact in contacts:
            fcm_token = contact.get("fcm_token")
            if not fcm_token:
                continue
            message = messaging.Message(
                notification=messaging.Notification(
                    title="SOS Alert!",
                    body=f"Emergency! Location: {maps_url}",
                ),
                token=fcm_token,
            )
            try:
                messaging.send(message)
                sent_count += 1
            except Exception:
                pass  # Token may be invalid — skip
        return sent_count
```

- [ ] **Step 3: Create users router**

Create `backend/app/routers/users.py`:

```python
from fastapi import APIRouter, Depends

from app.middleware.auth import verify_firebase_token
from app.models.user import (
    EmergencyContactRequest,
    EmergencyContactResponse,
    UserProfileRequest,
    UserProfileResponse,
)
from app.services.firebase_service import FirebaseService

router = APIRouter()


@router.get("/me", response_model=UserProfileResponse)
async def get_profile(user: dict = Depends(verify_firebase_token)) -> UserProfileResponse:
    """Get the current user's profile."""
    uid = user["uid"]
    profile = await FirebaseService.get_user_profile(uid)
    if profile is None:
        return UserProfileResponse(
            uid=uid, display_name="", phone="", emergency_contacts=[]
        )
    return UserProfileResponse(
        uid=uid,
        display_name=profile.get("display_name", ""),
        phone=profile.get("phone", ""),
        emergency_contacts=[
            EmergencyContactRequest(**c)
            for c in profile.get("emergency_contacts", [])
        ],
    )


@router.put("/me")
async def update_profile(
    body: UserProfileRequest,
    user: dict = Depends(verify_firebase_token),
) -> dict[str, str]:
    """Update the current user's profile."""
    await FirebaseService.upsert_user_profile(user["uid"], body.display_name, body.phone)
    return {"status": "updated"}


@router.get("/me/contacts", response_model=EmergencyContactResponse)
async def get_contacts(user: dict = Depends(verify_firebase_token)) -> EmergencyContactResponse:
    """Get emergency contacts."""
    contacts = await FirebaseService.get_user_contacts(user["uid"])
    return EmergencyContactResponse(
        contacts=[EmergencyContactRequest(**c) for c in contacts]
    )


@router.put("/me/contacts")
async def set_contacts(
    body: EmergencyContactResponse,
    user: dict = Depends(verify_firebase_token),
) -> dict[str, str]:
    """Replace all emergency contacts."""
    await FirebaseService.set_emergency_contacts(
        user["uid"],
        [c.model_dump() for c in body.contacts],
    )
    return {"status": "updated"}
```

- [ ] **Step 4: Register users router in main.py**

Add to `backend/app/main.py` after the sos router:

```python
from app.routers import health, sos, users

# ... existing code ...

app.include_router(users.router, prefix="/users", tags=["users"])
```

- [ ] **Step 5: Wire Firestore into SOS router**

Update `backend/app/routers/sos.py`:

```python
import uuid

from fastapi import APIRouter, Depends

from app.middleware.auth import verify_firebase_token
from app.models.sos_event import SOSStatus, SOSTriggerRequest, SOSTriggerResponse
from app.services.firebase_service import FirebaseService
from app.services.location_service import LocationService

router = APIRouter()


@router.post("/trigger", response_model=SOSTriggerResponse)
async def trigger_sos(
    payload: SOSTriggerRequest,
    user: dict = Depends(verify_firebase_token),
) -> SOSTriggerResponse:
    """SOS Flow: Trigger -> Firestore -> Twilio SMS -> FCM push."""
    event_id = str(uuid.uuid4())

    # 1. Store event in Firestore
    await FirebaseService.create_sos_event(payload, event_id)

    # 2. Get maps URL for notifications
    maps_url = await LocationService.get_maps_url(
        payload.location.latitude, payload.location.longitude
    )

    # TODO (Task 5): Wire Twilio SMS
    # TODO (Task 6): Wire FCM push — await FirebaseService.notify_contacts(user["uid"], event_id, maps_url)

    return SOSTriggerResponse(event_id=event_id, status=SOSStatus.DISPATCHED)
```

- [ ] **Step 6: Write tests for users router**

Create `backend/tests/test_users.py`:

```python
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

MOCK_USER = {"uid": "test-user-001", "email": "test@example.com"}


def test_get_profile_empty(client: TestClient) -> None:
    with (
        patch("app.middleware.auth.auth.verify_id_token", return_value=MOCK_USER),
        patch(
            "app.services.firebase_service.FirebaseService.get_user_profile",
            new_callable=AsyncMock,
            return_value=None,
        ),
    ):
        response = client.get(
            "/users/me",
            headers={"Authorization": "Bearer fake-token"},
        )
    assert response.status_code == 200
    data = response.json()
    assert data["uid"] == "test-user-001"
    assert data["emergency_contacts"] == []


def test_update_profile(client: TestClient) -> None:
    with (
        patch("app.middleware.auth.auth.verify_id_token", return_value=MOCK_USER),
        patch(
            "app.services.firebase_service.FirebaseService.upsert_user_profile",
            new_callable=AsyncMock,
        ) as mock_upsert,
    ):
        response = client.put(
            "/users/me",
            headers={"Authorization": "Bearer fake-token"},
            json={"display_name": "Test User", "phone": "+1234567890"},
        )
    assert response.status_code == 200
    mock_upsert.assert_called_once_with("test-user-001", "Test User", "+1234567890")


def test_set_contacts(client: TestClient) -> None:
    with (
        patch("app.middleware.auth.auth.verify_id_token", return_value=MOCK_USER),
        patch(
            "app.services.firebase_service.FirebaseService.set_emergency_contacts",
            new_callable=AsyncMock,
        ) as mock_set,
    ):
        response = client.put(
            "/users/me/contacts",
            headers={"Authorization": "Bearer fake-token"},
            json={
                "contacts": [
                    {"name": "Mom", "phone": "+1111111111", "relationship": "Mother"},
                ]
            },
        )
    assert response.status_code == 200
    mock_set.assert_called_once()


def test_get_contacts(client: TestClient) -> None:
    with (
        patch("app.middleware.auth.auth.verify_id_token", return_value=MOCK_USER),
        patch(
            "app.services.firebase_service.FirebaseService.get_user_contacts",
            new_callable=AsyncMock,
            return_value=[{"name": "Mom", "phone": "+1111111111", "relationship": "Mother"}],
        ),
    ):
        response = client.get(
            "/users/me/contacts",
            headers={"Authorization": "Bearer fake-token"},
        )
    assert response.status_code == 200
    data = response.json()
    assert len(data["contacts"]) == 1
    assert data["contacts"][0]["name"] == "Mom"
```

- [ ] **Step 7: Run all tests**

```bash
cd backend && .venv/Scripts/python.exe -m pytest tests/ -v
```

Expected: All tests pass.

- [ ] **Step 8: Commit**

```bash
git add backend/
git commit -m "feat(backend): add Firestore integration for SOS events and user profile CRUD"
```

---

## Task 4: Mobile — Location Capture on SOS Trigger

**Files:**
- Create: `mobile/src/hooks/useLocation.ts`
- Modify: `mobile/src/screens/HomeScreen.tsx`

- [ ] **Step 1: Create useLocation hook**

Create `mobile/src/hooks/useLocation.ts`:

```typescript
import { useState, useEffect } from 'react';
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
  const [loading, setLoading] = useState(false);

  const requestAndGetLocation = async (): Promise<GeoLocation | null> => {
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
  };

  useEffect(() => {
    void requestAndGetLocation();
  }, []);

  return { location, error, loading, refresh: requestAndGetLocation };
}
```

- [ ] **Step 2: Wire location into HomeScreen**

Replace `mobile/src/screens/HomeScreen.tsx`:

```tsx
import React, { useState } from 'react';
import { View, StyleSheet, Text, Alert } from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SOSButton } from '../components/SOSButton';
import { useLocation } from '../hooks/useLocation';
import { useAuth } from '../contexts/AuthContext';
import { triggerSOS } from '../services/api';
import type { TriggerType } from '@guardian/shared-schemas';

interface HomeScreenProps {
  navigation: NativeStackNavigationProp<{
    Home: undefined;
    Status: undefined;
    Contacts: undefined;
  }>;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ navigation }) => {
  const { user, signOut } = useAuth();
  const { location, refresh: refreshLocation } = useLocation();
  const [isTriggered, setIsTriggered] = useState(false);
  const [sending, setSending] = useState(false);

  const handleSOS = async (): Promise<void> => {
    setSending(true);
    try {
      const currentLocation = location ?? (await refreshLocation());

      if (!currentLocation) {
        Alert.alert(
          'Location Unavailable',
          'Could not get your location. SOS will be sent without precise coordinates.',
        );
      }

      const result = await triggerSOS({
        userId: user?.uid ?? '',
        location: currentLocation ?? { latitude: 0, longitude: 0 },
        triggerType: 'manual' as TriggerType,
        message: 'Emergency SOS triggered',
      });

      setIsTriggered(true);
      Alert.alert('SOS Sent', `Emergency contacts are being notified.\nEvent: ${result.eventId}`);
    } catch (err) {
      Alert.alert('SOS Failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.email}>{user?.email}</Text>
        <View style={styles.headerButtons}>
          <Text style={styles.headerLink} onPress={() => navigation.navigate('Contacts')}>
            Contacts
          </Text>
          <Text style={styles.headerLink} onPress={signOut}>
            Sign Out
          </Text>
        </View>
      </View>

      <View style={styles.center}>
        <Text style={styles.title}>Project Guardian</Text>
        <Text style={styles.subtitle}>Press the button in an emergency</Text>
        <SOSButton onPress={handleSOS} disabled={isTriggered || sending} />
        {isTriggered && <Text style={styles.status}>Help is on the way</Text>}
        {sending && <Text style={styles.sending}>Sending SOS...</Text>}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 60,
  },
  email: {
    color: '#9CA3AF',
    fontSize: 14,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 16,
  },
  headerLink: {
    color: '#60A5FA',
    fontSize: 14,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    color: '#9CA3AF',
    fontSize: 16,
    marginBottom: 48,
  },
  status: {
    color: '#34D399',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 32,
  },
  sending: {
    color: '#FBBF24',
    fontSize: 16,
    marginTop: 16,
  },
});
```

- [ ] **Step 3: Commit**

```bash
git add mobile/src/hooks/ mobile/src/screens/HomeScreen.tsx
git commit -m "feat(mobile): add GPS location capture and wire SOS button to backend API"
```

---

## Task 5: Backend — Twilio SMS Dispatch

**Files:**
- Modify: `backend/app/services/twilio_service.py`
- Modify: `backend/app/routers/sos.py`
- Create: `backend/tests/test_twilio.py`

- [ ] **Step 1: Install twilio**

```bash
cd backend && .venv/Scripts/python.exe -m pip install twilio
```

- [ ] **Step 2: Implement Twilio service**

Replace `backend/app/services/twilio_service.py`:

```python
from twilio.rest import Client

from app.config import settings
from app.models.sos_event import SOSTriggerRequest
from app.services.location_service import LocationService


class TwilioService:
    """Twilio SMS operations."""

    @staticmethod
    def _client() -> Client:
        return Client(settings.twilio_account_sid, settings.twilio_auth_token)

    @staticmethod
    async def send_emergency_sms(
        payload: SOSTriggerRequest,
        contacts: list[dict],
    ) -> int:
        """Send emergency SMS to all contacts. Returns number of messages sent."""
        if not settings.twilio_account_sid or not settings.twilio_from_phone:
            return 0

        maps_url = await LocationService.get_maps_url(
            payload.location.latitude, payload.location.longitude
        )
        body = f"🚨 SOS ALERT! Emergency triggered. Location: {maps_url}"
        if payload.message:
            body += f"\nMessage: {payload.message}"

        client = TwilioService._client()
        sent = 0
        for contact in contacts:
            phone = contact.get("phone")
            if not phone:
                continue
            try:
                client.messages.create(
                    body=body,
                    from_=settings.twilio_from_phone,
                    to=phone,
                )
                sent += 1
            except Exception:
                pass  # Log and continue — don't fail the SOS
        return sent
```

- [ ] **Step 3: Wire Twilio into SOS router**

Update `backend/app/routers/sos.py`:

```python
import uuid

from fastapi import APIRouter, Depends

from app.middleware.auth import verify_firebase_token
from app.models.sos_event import SOSStatus, SOSTriggerRequest, SOSTriggerResponse
from app.services.firebase_service import FirebaseService
from app.services.location_service import LocationService
from app.services.twilio_service import TwilioService

router = APIRouter()


@router.post("/trigger", response_model=SOSTriggerResponse)
async def trigger_sos(
    payload: SOSTriggerRequest,
    user: dict = Depends(verify_firebase_token),
) -> SOSTriggerResponse:
    """SOS Flow: Trigger -> Firestore -> Twilio SMS -> FCM push."""
    event_id = str(uuid.uuid4())
    user_id = user["uid"]

    # 1. Store event in Firestore
    await FirebaseService.create_sos_event(payload, event_id)

    # 2. Get emergency contacts
    contacts = await FirebaseService.get_user_contacts(user_id)

    # 3. Get maps URL
    maps_url = await LocationService.get_maps_url(
        payload.location.latitude, payload.location.longitude
    )

    # 4. Send SMS to contacts
    await TwilioService.send_emergency_sms(payload, contacts)

    # 5. Send FCM push to contacts with app installed
    await FirebaseService.notify_contacts(user_id, event_id, maps_url)

    return SOSTriggerResponse(event_id=event_id, status=SOSStatus.DISPATCHED)
```

- [ ] **Step 4: Write Twilio tests**

Create `backend/tests/test_twilio.py`:

```python
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.twilio_service import TwilioService
from app.models.sos_event import GeoLocation, SOSTriggerRequest


@pytest.fixture
def sos_payload() -> SOSTriggerRequest:
    return SOSTriggerRequest(
        user_id="test-user",
        location=GeoLocation(latitude=28.6139, longitude=77.2090),
        message="Help!",
    )


@pytest.fixture
def contacts() -> list[dict]:
    return [
        {"name": "Mom", "phone": "+1111111111", "relationship": "Mother"},
        {"name": "Dad", "phone": "+2222222222", "relationship": "Father"},
    ]


def test_send_sms_to_contacts(sos_payload: SOSTriggerRequest, contacts: list[dict]) -> None:
    mock_client = MagicMock()
    with (
        patch.object(TwilioService, "_client", return_value=mock_client),
        patch("app.services.twilio_service.settings") as mock_settings,
    ):
        mock_settings.twilio_account_sid = "test-sid"
        mock_settings.twilio_auth_token = "test-token"
        mock_settings.twilio_from_phone = "+0000000000"

        import asyncio
        sent = asyncio.get_event_loop().run_until_complete(
            TwilioService.send_emergency_sms(sos_payload, contacts)
        )

    assert sent == 2
    assert mock_client.messages.create.call_count == 2


def test_send_sms_skips_missing_phone(sos_payload: SOSTriggerRequest) -> None:
    contacts = [{"name": "No Phone", "relationship": "Friend"}]
    mock_client = MagicMock()
    with (
        patch.object(TwilioService, "_client", return_value=mock_client),
        patch("app.services.twilio_service.settings") as mock_settings,
    ):
        mock_settings.twilio_account_sid = "test-sid"
        mock_settings.twilio_auth_token = "test-token"
        mock_settings.twilio_from_phone = "+0000000000"

        import asyncio
        sent = asyncio.get_event_loop().run_until_complete(
            TwilioService.send_emergency_sms(sos_payload, contacts)
        )

    assert sent == 0
    mock_client.messages.create.assert_not_called()
```

- [ ] **Step 5: Run tests**

```bash
cd backend && .venv/Scripts/python.exe -m pytest tests/ -v
```

Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add backend/
git commit -m "feat(backend): implement Twilio SMS dispatch for emergency contacts"
```

---

## Task 6: FCM Push Notifications

**Files:**
- Modify: `mobile/package.json`
- Modify: `mobile/app.json`
- Create: `mobile/src/hooks/usePushNotifications.ts`
- Modify: `mobile/src/services/api.ts`
- Modify: `mobile/src/contexts/AuthContext.tsx`
- Backend: `firebase_service.py` notify_contacts already implemented in Task 3

- [ ] **Step 1: Install expo-notifications**

```bash
cd d:/Projects/SOS_app && npx expo install expo-notifications --workspace=mobile
```

- [ ] **Step 2: Add expo-notifications plugin to app.json**

Add to the `plugins` array in `mobile/app.json`:

```json
"plugins": [
  [
    "expo-location",
    {
      "locationAlwaysAndWhenInUsePermission": "Project Guardian needs your location to send emergency alerts."
    }
  ],
  [
    "expo-notifications",
    {
      "icon": "./assets/notification-icon.png",
      "color": "#DC2626"
    }
  ]
]
```

- [ ] **Step 3: Create push notifications hook**

Create `mobile/src/hooks/usePushNotifications.ts`:

```typescript
import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export function usePushNotifications(): {
  expoPushToken: string | null;
  notification: Notifications.Notification | null;
} {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [notification, setNotification] = useState<Notifications.Notification | null>(null);
  const notificationListener = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    registerForPushNotifications().then(setExpoPushToken);

    notificationListener.current = Notifications.addNotificationReceivedListener(
      (notif) => setNotification(notif),
    );

    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
    };
  }, []);

  return { expoPushToken, notification };
}

async function registerForPushNotifications(): Promise<string | null> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    return null;
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  const tokenData = await Notifications.getExpoPushTokenAsync({
    projectId,
  });

  return tokenData.data;
}
```

- [ ] **Step 4: Add FCM token registration endpoint to backend**

Add to `backend/app/routers/users.py`:

```python
from pydantic import BaseModel


class FcmTokenRequest(BaseModel):
    token: str


@router.put("/me/fcm-token")
async def register_fcm_token(
    body: FcmTokenRequest,
    user: dict = Depends(verify_firebase_token),
) -> dict[str, str]:
    """Register or update FCM push token for the current user."""
    db = FirebaseService._db()
    db.collection("users").document(user["uid"]).set(
        {"fcm_token": body.token},
        merge=True,
    )
    return {"status": "registered"}
```

- [ ] **Step 5: Add registerFcmToken to mobile api.ts**

Add to `mobile/src/services/api.ts`:

```typescript
export async function registerFcmToken(token: string): Promise<void> {
  const headers = await getAuthHeaders();
  await fetch(`${API_URL}/users/me/fcm-token`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ token }),
  });
}
```

- [ ] **Step 6: Wire push token registration in AuthContext**

Add to the `AuthProvider` in `mobile/src/contexts/AuthContext.tsx`, inside the `onAuthStateChanged` callback:

```typescript
import { usePushNotifications } from '../hooks/usePushNotifications';
import { registerFcmToken } from '../services/api';

// Inside AuthProvider component, after user state is set:
const { expoPushToken } = usePushNotifications();

useEffect(() => {
  if (user && expoPushToken) {
    registerFcmToken(expoPushToken).catch(() => {
      // Silent fail — will retry on next app launch
    });
  }
}, [user, expoPushToken]);
```

- [ ] **Step 7: Commit**

```bash
git add backend/ mobile/
git commit -m "feat: add FCM push notifications with expo-notifications and token registration"
```

---

## Task 7: Mobile — Emergency Contact Management UI

**Files:**
- Modify: `mobile/src/screens/ContactsScreen.tsx` (replace placeholder)
- Modify: `mobile/src/services/api.ts` (add contacts API functions)

- [ ] **Step 1: Add contacts API functions**

Add to `mobile/src/services/api.ts`:

```typescript
import type { EmergencyContact } from '@guardian/shared-schemas';

export async function getContacts(): Promise<EmergencyContact[]> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_URL}/users/me/contacts`, { headers });
  if (!response.ok) throw new Error(`Failed to get contacts: ${response.status}`);
  const data = await response.json() as { contacts: EmergencyContact[] };
  return data.contacts;
}

export async function setContacts(contacts: EmergencyContact[]): Promise<void> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_URL}/users/me/contacts`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ contacts }),
  });
  if (!response.ok) throw new Error(`Failed to save contacts: ${response.status}`);
}
```

- [ ] **Step 2: Implement ContactsScreen**

Replace `mobile/src/screens/ContactsScreen.tsx`:

```tsx
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import type { EmergencyContact } from '@guardian/shared-schemas';
import { getContacts, setContacts } from '../services/api';

export const ContactsScreen: React.FC = () => {
  const [contacts, setLocalContacts] = useState<EmergencyContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [relationship, setRelationship] = useState('');

  const loadContacts = useCallback(async () => {
    try {
      const data = await getContacts();
      setLocalContacts(data);
    } catch {
      Alert.alert('Error', 'Failed to load contacts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadContacts();
  }, [loadContacts]);

  const handleAdd = async (): Promise<void> => {
    if (!name || !phone || !relationship) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    const updated = [...contacts, { name, phone, relationship }];
    try {
      await setContacts(updated);
      setLocalContacts(updated);
      setName('');
      setPhone('');
      setRelationship('');
    } catch {
      Alert.alert('Error', 'Failed to save contact');
    }
  };

  const handleDelete = async (index: number): Promise<void> => {
    const updated = contacts.filter((_, i) => i !== index);
    try {
      await setContacts(updated);
      setLocalContacts(updated);
    } catch {
      Alert.alert('Error', 'Failed to delete contact');
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#DC2626" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={contacts}
        keyExtractor={(_, i) => i.toString()}
        ListEmptyComponent={<Text style={styles.empty}>No emergency contacts yet</Text>}
        renderItem={({ item, index }) => (
          <View style={styles.contactRow}>
            <View style={styles.contactInfo}>
              <Text style={styles.contactName}>{item.name}</Text>
              <Text style={styles.contactDetail}>{item.phone} · {item.relationship}</Text>
            </View>
            <TouchableOpacity onPress={() => handleDelete(index)}>
              <Text style={styles.deleteBtn}>Remove</Text>
            </TouchableOpacity>
          </View>
        )}
      />

      <View style={styles.form}>
        <Text style={styles.formTitle}>Add Contact</Text>
        <TextInput
          style={styles.input}
          placeholder="Name"
          placeholderTextColor="#6B7280"
          value={name}
          onChangeText={setName}
        />
        <TextInput
          style={styles.input}
          placeholder="Phone (+1234567890)"
          placeholderTextColor="#6B7280"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
        />
        <TextInput
          style={styles.input}
          placeholder="Relationship"
          placeholderTextColor="#6B7280"
          value={relationship}
          onChangeText={setRelationship}
        />
        <TouchableOpacity style={styles.addBtn} onPress={handleAdd}>
          <Text style={styles.addBtnText}>Add Contact</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
    padding: 16,
  },
  empty: {
    color: '#9CA3AF',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 32,
  },
  contactRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1F2937',
    borderRadius: 8,
    padding: 16,
    marginBottom: 8,
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  contactDetail: {
    color: '#9CA3AF',
    fontSize: 14,
    marginTop: 4,
  },
  deleteBtn: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '600',
  },
  form: {
    borderTopWidth: 1,
    borderTopColor: '#374151',
    paddingTop: 16,
    marginTop: 16,
  },
  formTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  input: {
    backgroundColor: '#1F2937',
    color: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    fontSize: 16,
  },
  addBtn: {
    backgroundColor: '#059669',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  addBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
```

- [ ] **Step 3: Commit**

```bash
git add mobile/src/screens/ContactsScreen.tsx mobile/src/services/api.ts
git commit -m "feat(mobile): implement emergency contact management UI with add/delete"
```

---

## Task 8: Mobile — Google Maps Live Location Tracking

**Files:**
- Modify: `mobile/package.json`
- Modify: `mobile/app.json`
- Create: `mobile/src/screens/TrackingScreen.tsx`
- Modify: `mobile/src/navigation/RootNavigator.tsx`
- Modify: `mobile/src/screens/HomeScreen.tsx`

- [ ] **Step 1: Install react-native-maps**

```bash
cd d:/Projects/SOS_app && npx expo install react-native-maps --workspace=mobile
```

- [ ] **Step 2: Create TrackingScreen**

Create `mobile/src/screens/TrackingScreen.tsx`:

```tsx
import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import type { GeoLocation } from '@guardian/shared-schemas';

interface TrackingScreenProps {
  route: {
    params: {
      initialLocation: GeoLocation;
      eventId: string;
    };
  };
}

export const TrackingScreen: React.FC<TrackingScreenProps> = ({ route }) => {
  const { initialLocation, eventId } = route.params;
  const [currentLocation, setCurrentLocation] = useState<GeoLocation>(initialLocation);
  const mapRef = useRef<MapView | null>(null);

  useEffect(() => {
    let subscription: Location.LocationSubscription | null = null;

    const startTracking = async (): Promise<void> => {
      subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          distanceInterval: 10,
          timeInterval: 5000,
        },
        (position) => {
          const updated: GeoLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracyMeters: position.coords.accuracy ?? undefined,
          };
          setCurrentLocation(updated);

          mapRef.current?.animateToRegion({
            latitude: updated.latitude,
            longitude: updated.longitude,
            latitudeDelta: 0.005,
            longitudeDelta: 0.005,
          });
        },
      );
    };

    void startTracking();

    return () => {
      subscription?.remove();
    };
  }, []);

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={{
          latitude: initialLocation.latitude,
          longitude: initialLocation.longitude,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        }}
      >
        <Marker
          coordinate={{
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude,
          }}
          title="Your Location"
          pinColor="#DC2626"
        />
      </MapView>
      <View style={styles.overlay}>
        <Text style={styles.eventId}>Event: {eventId}</Text>
        <Text style={styles.coords}>
          {currentLocation.latitude.toFixed(6)}, {currentLocation.longitude.toFixed(6)}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  overlay: {
    position: 'absolute',
    bottom: 40,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(17, 24, 39, 0.9)',
    borderRadius: 12,
    padding: 16,
  },
  eventId: {
    color: '#9CA3AF',
    fontSize: 12,
  },
  coords: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 4,
  },
});
```

- [ ] **Step 3: Add TrackingScreen to navigation**

Update `RootNavigator.tsx` — add to `AppStackParamList` and `AppNavigator`:

```typescript
type AppStackParamList = {
  Home: undefined;
  Status: undefined;
  Contacts: undefined;
  Tracking: { initialLocation: GeoLocation; eventId: string };
};

// In AppNavigator, add:
<AppStack.Screen name="Tracking" component={TrackingScreen} options={{ title: 'Live Tracking' }} />
```

Import `TrackingScreen` and `GeoLocation` at the top.

- [ ] **Step 4: Navigate to TrackingScreen after SOS**

In `mobile/src/screens/HomeScreen.tsx`, after a successful SOS trigger, navigate to tracking:

```typescript
// After the triggerSOS call succeeds:
if (currentLocation) {
  navigation.navigate('Tracking', {
    initialLocation: currentLocation,
    eventId: result.eventId,
  });
}
```

- [ ] **Step 5: Commit**

```bash
git add mobile/
git commit -m "feat(mobile): add Google Maps live location tracking screen after SOS trigger"
```

---

## Verification Plan

After all 8 tasks are complete, verify end-to-end:

1. **Backend tests pass:**
   ```bash
   cd backend && .venv/Scripts/python.exe -m pytest tests/ -v
   ```

2. **Backend starts:**
   ```bash
   cd backend && .venv/Scripts/python.exe -m uvicorn app.main:app --reload
   ```

3. **API docs available:**
   Open `http://localhost:8000/docs` — should show /health, /sos/trigger, /users/* endpoints.

4. **Mobile starts:**
   ```bash
   cd mobile && npx expo start
   ```

5. **Auth flow:** Register → Login → See HomeScreen with SOS button.

6. **Contacts flow:** Navigate to Contacts → Add emergency contacts → Verify they appear.

7. **SOS flow:** Press SOS button → Location captured → API call succeeds → SMS sent (check Twilio logs) → FCM notification received → TrackingScreen shows map.

8. **Simulate from CLI:**
   ```bash
   bash scripts/simulate-sos.sh
   ```
   Note: This will fail with 401 now (auth required). Update the script to accept a Bearer token or keep it for unauthenticated testing by temporarily removing auth from the endpoint.
