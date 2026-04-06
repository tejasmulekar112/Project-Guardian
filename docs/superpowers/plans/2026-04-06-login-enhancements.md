# Login Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enhance the existing Firebase email/password auth with forgot password, input validation, error translation, and keyboard UX improvements.

**Architecture:** Add a `ForgotPasswordScreen` to the auth stack, extract Firebase error translation into a shared utility, add inline validation to Login/Register screens, and wrap all auth screens with `KeyboardAvoidingView` + `ScrollView` for proper keyboard handling.

**Tech Stack:** React Native, Expo, Firebase Auth, TypeScript, Jest

---

### Task 1: Firebase Error Translation Utility

**Files:**
- Create: `mobile/src/utils/authErrors.ts`
- Create: `mobile/src/utils/__tests__/authErrors.test.ts`

- [ ] **Step 1: Write the failing test**

Create `mobile/src/utils/__tests__/authErrors.test.ts`:

```typescript
import { getAuthErrorMessage } from '../authErrors';

describe('getAuthErrorMessage', () => {
  it('returns friendly message for auth/user-not-found', () => {
    const error = { code: 'auth/user-not-found' };
    expect(getAuthErrorMessage(error)).toBe('No account found with this email');
  });

  it('returns friendly message for auth/wrong-password', () => {
    const error = { code: 'auth/wrong-password' };
    expect(getAuthErrorMessage(error)).toBe('Incorrect password');
  });

  it('returns friendly message for auth/invalid-credential', () => {
    const error = { code: 'auth/invalid-credential' };
    expect(getAuthErrorMessage(error)).toBe('Invalid email or password');
  });

  it('returns friendly message for auth/email-already-in-use', () => {
    const error = { code: 'auth/email-already-in-use' };
    expect(getAuthErrorMessage(error)).toBe('An account with this email already exists');
  });

  it('returns friendly message for auth/weak-password', () => {
    const error = { code: 'auth/weak-password' };
    expect(getAuthErrorMessage(error)).toBe('Password must be at least 6 characters');
  });

  it('returns friendly message for auth/invalid-email', () => {
    const error = { code: 'auth/invalid-email' };
    expect(getAuthErrorMessage(error)).toBe('Please enter a valid email address');
  });

  it('returns friendly message for auth/too-many-requests', () => {
    const error = { code: 'auth/too-many-requests' };
    expect(getAuthErrorMessage(error)).toBe('Too many attempts. Please try again later');
  });

  it('returns friendly message for auth/network-request-failed', () => {
    const error = { code: 'auth/network-request-failed' };
    expect(getAuthErrorMessage(error)).toBe('Network error. Check your connection');
  });

  it('returns default message for unknown error code', () => {
    const error = { code: 'auth/unknown-code' };
    expect(getAuthErrorMessage(error)).toBe('Something went wrong. Please try again');
  });

  it('returns default message for non-Firebase error', () => {
    expect(getAuthErrorMessage(new Error('random'))).toBe('Something went wrong. Please try again');
  });

  it('returns default message for null/undefined', () => {
    expect(getAuthErrorMessage(null)).toBe('Something went wrong. Please try again');
    expect(getAuthErrorMessage(undefined)).toBe('Something went wrong. Please try again');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd mobile && npx jest src/utils/__tests__/authErrors.test.ts --no-cache`
Expected: FAIL — module `../authErrors` not found

- [ ] **Step 3: Write the implementation**

Create `mobile/src/utils/authErrors.ts`:

```typescript
const ERROR_MESSAGES: Record<string, string> = {
  'auth/user-not-found': 'No account found with this email',
  'auth/wrong-password': 'Incorrect password',
  'auth/invalid-credential': 'Invalid email or password',
  'auth/email-already-in-use': 'An account with this email already exists',
  'auth/weak-password': 'Password must be at least 6 characters',
  'auth/invalid-email': 'Please enter a valid email address',
  'auth/too-many-requests': 'Too many attempts. Please try again later',
  'auth/network-request-failed': 'Network error. Check your connection',
};

const DEFAULT_MESSAGE = 'Something went wrong. Please try again';

export const getAuthErrorMessage = (error: unknown): string => {
  if (
    error != null &&
    typeof error === 'object' &&
    'code' in error &&
    typeof (error as { code: unknown }).code === 'string'
  ) {
    return ERROR_MESSAGES[(error as { code: string }).code] ?? DEFAULT_MESSAGE;
  }
  return DEFAULT_MESSAGE;
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd mobile && npx jest src/utils/__tests__/authErrors.test.ts --no-cache`
Expected: PASS — all 11 tests pass

- [ ] **Step 5: Commit**

```bash
git add mobile/src/utils/authErrors.ts mobile/src/utils/__tests__/authErrors.test.ts
git commit -m "feat: add Firebase auth error translation utility"
```

---

### Task 2: Add `resetPassword` to AuthContext

**Files:**
- Modify: `mobile/src/contexts/AuthContext.tsx`

- [ ] **Step 1: Add import for `sendPasswordResetEmail`**

In `mobile/src/contexts/AuthContext.tsx`, update the firebase/auth import (line 2-7):

```typescript
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
```

- [ ] **Step 2: Add `resetPassword` to the interface**

Update `AuthContextType` (line 15-21):

```typescript
interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}
```

- [ ] **Step 3: Add the `resetPassword` function**

Add after the `signOut` function (after line 88):

```typescript
const resetPassword = async (email: string): Promise<void> => {
  await sendPasswordResetEmail(auth, email);
};
```

- [ ] **Step 4: Add `resetPassword` to the Provider value**

Update the Provider value (line 91):

```typescript
<AuthContext.Provider value={{ user, loading, signIn, signUp, signOut, resetPassword }}>
```

- [ ] **Step 5: Run typecheck**

Run: `npm run typecheck --workspace=mobile`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add mobile/src/contexts/AuthContext.tsx
git commit -m "feat: add resetPassword method to AuthContext"
```

---

### Task 3: Create ForgotPasswordScreen

**Files:**
- Create: `mobile/src/screens/ForgotPasswordScreen.tsx`
- Modify: `mobile/src/navigation/RootNavigator.tsx`

- [ ] **Step 1: Create the ForgotPasswordScreen**

Create `mobile/src/screens/ForgotPasswordScreen.tsx`:

```typescript
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../theme/ThemeContext';
import { getAuthErrorMessage } from '../utils/authErrors';

export const ForgotPasswordScreen = () => {
  const { resetPassword } = useAuth();
  const { colors } = useTheme();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleReset = async (): Promise<void> => {
    setError('');
    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }
    setLoading(true);
    try {
      await resetPassword(email.trim());
      setSuccess(true);
    } catch (e) {
      setError(getAuthErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={[styles.container, { backgroundColor: colors.background }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.title, { color: colors.text }]}>Reset Password</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {success
            ? 'Check your email for a password reset link.'
            : "Enter your email and we'll send you a reset link."}
        </Text>

        {!success && (
          <>
            {error !== '' && (
              <Text style={[styles.errorBanner, { color: colors.danger }]}>{error}</Text>
            )}
            <TextInput
              style={[styles.input, { backgroundColor: colors.inputBg, color: colors.inputText }]}
              placeholder="Email"
              placeholderTextColor={colors.placeholder}
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                setError('');
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleReset}
            />
            <TouchableOpacity
              style={[styles.button, { backgroundColor: colors.danger }]}
              onPress={handleReset}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.buttonText}>Send Reset Link</Text>
              )}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 8 },
  subtitle: { fontSize: 16, marginBottom: 24, textAlign: 'center' },
  errorBanner: { fontSize: 14, marginBottom: 12, textAlign: 'center' },
  input: { width: '100%', borderRadius: 8, padding: 16, marginBottom: 16, fontSize: 16 },
  button: { width: '100%', borderRadius: 8, padding: 16, alignItems: 'center', marginBottom: 16 },
  buttonText: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
});
```

- [ ] **Step 2: Add ForgotPassword to navigation**

In `mobile/src/navigation/RootNavigator.tsx`, add the import (after line 10):

```typescript
import { ForgotPasswordScreen } from '../screens/ForgotPasswordScreen';
```

Update `AuthStackParamList` (line 15-18):

```typescript
type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
};
```

Add the screen to `AuthNavigator` (after line 41, inside the `AuthStack.Navigator`):

```typescript
<AuthStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} options={{ title: 'Forgot Password' }} />
```

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck --workspace=mobile`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add mobile/src/screens/ForgotPasswordScreen.tsx mobile/src/navigation/RootNavigator.tsx
git commit -m "feat: add ForgotPasswordScreen with Firebase reset"
```

---

### Task 4: Update LoginScreen — Forgot Password Link, Validation, Keyboard UX

**Files:**
- Modify: `mobile/src/screens/LoginScreen.tsx`

- [ ] **Step 1: Rewrite LoginScreen with all enhancements**

Replace the entire content of `mobile/src/screens/LoginScreen.tsx`:

```typescript
import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
} from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../theme/ThemeContext';
import { getAuthErrorMessage } from '../utils/authErrors';

interface LoginScreenProps {
  navigation: NativeStackNavigationProp<{
    Login: undefined;
    Register: undefined;
    ForgotPassword: undefined;
  }>;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const LoginScreen = ({ navigation }: LoginScreenProps) => {
  const { signIn } = useAuth();
  const { colors } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});

  const passwordRef = useRef<TextInput>(null);

  const validateEmail = (value: string): string | undefined => {
    if (!value.trim()) return 'Email is required';
    if (!EMAIL_REGEX.test(value.trim())) return 'Please enter a valid email';
    return undefined;
  };

  const handleLogin = async (): Promise<void> => {
    setFormError('');
    const emailError = validateEmail(email);
    const passwordError = !password ? 'Password is required' : undefined;
    setFieldErrors({ email: emailError, password: passwordError });

    if (emailError || passwordError) return;

    setLoading(true);
    try {
      await signIn(email.trim(), password);
    } catch (error) {
      setFormError(getAuthErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const isDisabled = !email.trim() || !password || loading;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={[styles.container, { backgroundColor: colors.background }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.title, { color: colors.text }]}>Guardian</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Sign in to continue</Text>

        {formError !== '' && (
          <Text style={[styles.errorBanner, { color: colors.danger }]}>{formError}</Text>
        )}

        <TextInput
          style={[styles.input, { backgroundColor: colors.inputBg, color: colors.inputText }]}
          placeholder="Email"
          placeholderTextColor={colors.placeholder}
          value={email}
          onChangeText={(text) => {
            setEmail(text);
            setFieldErrors((prev) => ({ ...prev, email: undefined }));
            setFormError('');
          }}
          onBlur={() => {
            if (email) setFieldErrors((prev) => ({ ...prev, email: validateEmail(email) }));
          }}
          keyboardType="email-address"
          autoCapitalize="none"
          autoFocus
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
        />
        {fieldErrors.email && (
          <Text style={[styles.fieldError, { color: colors.danger }]}>{fieldErrors.email}</Text>
        )}

        <TextInput
          ref={passwordRef}
          style={[styles.input, { backgroundColor: colors.inputBg, color: colors.inputText }]}
          placeholder="Password"
          placeholderTextColor={colors.placeholder}
          value={password}
          onChangeText={(text) => {
            setPassword(text);
            setFieldErrors((prev) => ({ ...prev, password: undefined }));
            setFormError('');
          }}
          secureTextEntry
          returnKeyType="done"
          onSubmitEditing={handleLogin}
        />
        {fieldErrors.password && (
          <Text style={[styles.fieldError, { color: colors.danger }]}>{fieldErrors.password}</Text>
        )}

        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.danger }, isDisabled && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={isDisabled}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>Sign In</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')}>
          <Text style={[styles.link, { color: colors.info }]}>Forgot Password?</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate('Register')}>
          <Text style={[styles.link, { color: colors.info, marginTop: 12 }]}>
            Don't have an account? Register
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  title: { fontSize: 32, fontWeight: 'bold', marginBottom: 8 },
  subtitle: { fontSize: 16, marginBottom: 32 },
  errorBanner: { fontSize: 14, marginBottom: 12, textAlign: 'center' },
  input: { width: '100%', borderRadius: 8, padding: 16, marginBottom: 16, fontSize: 16 },
  fieldError: { fontSize: 12, alignSelf: 'flex-start', marginTop: -12, marginBottom: 8 },
  button: { width: '100%', borderRadius: 8, padding: 16, alignItems: 'center', marginBottom: 16 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
  link: { fontSize: 14 },
});
```

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck --workspace=mobile`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add mobile/src/screens/LoginScreen.tsx
git commit -m "feat: add validation, forgot password link, keyboard UX to LoginScreen"
```

---

### Task 5: Update RegisterScreen — Validation, Keyboard UX

**Files:**
- Modify: `mobile/src/screens/RegisterScreen.tsx`

- [ ] **Step 1: Rewrite RegisterScreen with all enhancements**

Replace the entire content of `mobile/src/screens/RegisterScreen.tsx`:

```typescript
import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../theme/ThemeContext';
import { getAuthErrorMessage } from '../utils/authErrors';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const RegisterScreen = () => {
  const { signUp } = useAuth();
  const { colors } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{
    email?: string;
    password?: string;
    confirmPassword?: string;
  }>({});

  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  const validateEmail = (value: string): string | undefined => {
    if (!value.trim()) return 'Email is required';
    if (!EMAIL_REGEX.test(value.trim())) return 'Please enter a valid email';
    return undefined;
  };

  const handleRegister = async (): Promise<void> => {
    setFormError('');
    const emailError = validateEmail(email);
    const passwordError = password.length < 6 ? 'Password must be at least 6 characters' : undefined;
    const confirmError =
      !confirmPassword
        ? 'Please confirm your password'
        : password !== confirmPassword
          ? 'Passwords do not match'
          : undefined;

    setFieldErrors({ email: emailError, password: passwordError, confirmPassword: confirmError });

    if (emailError || passwordError || confirmError) return;

    setLoading(true);
    try {
      await signUp(email.trim(), password);
    } catch (error) {
      setFormError(getAuthErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const isDisabled =
    !email.trim() || password.length < 6 || !confirmPassword || loading;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={[styles.container, { backgroundColor: colors.background }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.title, { color: colors.text }]}>Create Account</Text>

        {formError !== '' && (
          <Text style={[styles.errorBanner, { color: colors.danger }]}>{formError}</Text>
        )}

        <TextInput
          style={[styles.input, { backgroundColor: colors.inputBg, color: colors.inputText }]}
          placeholder="Email"
          placeholderTextColor={colors.placeholder}
          value={email}
          onChangeText={(text) => {
            setEmail(text);
            setFieldErrors((prev) => ({ ...prev, email: undefined }));
            setFormError('');
          }}
          onBlur={() => {
            if (email) setFieldErrors((prev) => ({ ...prev, email: validateEmail(email) }));
          }}
          keyboardType="email-address"
          autoCapitalize="none"
          autoFocus
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
        />
        {fieldErrors.email && (
          <Text style={[styles.fieldError, { color: colors.danger }]}>{fieldErrors.email}</Text>
        )}

        <TextInput
          ref={passwordRef}
          style={[styles.input, { backgroundColor: colors.inputBg, color: colors.inputText }]}
          placeholder="Password"
          placeholderTextColor={colors.placeholder}
          value={password}
          onChangeText={(text) => {
            setPassword(text);
            setFieldErrors((prev) => ({ ...prev, password: undefined }));
            setFormError('');
          }}
          onBlur={() => {
            if (password && password.length < 6) {
              setFieldErrors((prev) => ({
                ...prev,
                password: 'Password must be at least 6 characters',
              }));
            }
          }}
          secureTextEntry
          returnKeyType="next"
          onSubmitEditing={() => confirmRef.current?.focus()}
        />
        {fieldErrors.password ? (
          <Text style={[styles.fieldError, { color: colors.danger }]}>{fieldErrors.password}</Text>
        ) : (
          password.length > 0 && password.length < 6 && (
            <Text style={[styles.fieldHint, { color: colors.textTertiary }]}>
              Must be at least 6 characters
            </Text>
          )
        )}

        <TextInput
          ref={confirmRef}
          style={[styles.input, { backgroundColor: colors.inputBg, color: colors.inputText }]}
          placeholder="Confirm Password"
          placeholderTextColor={colors.placeholder}
          value={confirmPassword}
          onChangeText={(text) => {
            setConfirmPassword(text);
            if (text && text !== password) {
              setFieldErrors((prev) => ({ ...prev, confirmPassword: 'Passwords do not match' }));
            } else {
              setFieldErrors((prev) => ({ ...prev, confirmPassword: undefined }));
            }
            setFormError('');
          }}
          secureTextEntry
          returnKeyType="done"
          onSubmitEditing={handleRegister}
        />
        {fieldErrors.confirmPassword && (
          <Text style={[styles.fieldError, { color: colors.danger }]}>
            {fieldErrors.confirmPassword}
          </Text>
        )}

        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.danger }, isDisabled && styles.buttonDisabled]}
          onPress={handleRegister}
          disabled={isDisabled}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>Register</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 32 },
  errorBanner: { fontSize: 14, marginBottom: 12, textAlign: 'center' },
  input: { width: '100%', borderRadius: 8, padding: 16, marginBottom: 16, fontSize: 16 },
  fieldError: { fontSize: 12, alignSelf: 'flex-start', marginTop: -12, marginBottom: 8 },
  fieldHint: { fontSize: 12, alignSelf: 'flex-start', marginTop: -12, marginBottom: 8 },
  button: { width: '100%', borderRadius: 8, padding: 16, alignItems: 'center', marginBottom: 16 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
});
```

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck --workspace=mobile`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add mobile/src/screens/RegisterScreen.tsx
git commit -m "feat: add validation, keyboard UX to RegisterScreen"
```

---

### Task 6: Final Verification

**Files:** None (verification only)

- [ ] **Step 1: Run typecheck**

Run: `npm run typecheck --workspace=mobile`
Expected: No errors

- [ ] **Step 2: Run lint**

Run: `npm run lint --workspace=mobile`
Expected: No errors (or only pre-existing warnings)

- [ ] **Step 3: Run tests**

Run: `npm run test --workspace=mobile`
Expected: All tests pass (including new authErrors tests)

- [ ] **Step 4: Final commit if any fixes needed**

If typecheck or lint required fixes, commit them:

```bash
git add -A
git commit -m "fix: resolve lint/typecheck issues from login enhancements"
```
