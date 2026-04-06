# Login Enhancements Design

**Date:** 2026-04-06
**Status:** Approved
**Scope:** Improve existing Firebase email/password auth with forgot password, input validation, error translation, and UX improvements.

## Context

The app has a working login system (Firebase email/password auth) with `LoginScreen`, `RegisterScreen`, `AuthContext`, and conditional navigation in `RootNavigator`. This spec adds the features expected from a production-quality auth flow.

## 1. Forgot Password Flow

### New Screen: `src/screens/ForgotPasswordScreen.tsx`

- Single email input field + "Send Reset Link" button
- Calls `sendPasswordResetEmail` from `firebase/auth`
- On success: display inline success message ("Check your email for a reset link"), with a "Back to Login" button
- On error: display inline error message using the error translation utility
- Themed using `useTheme()` consistent with Login/Register screens
- Functional component with `React.FC` typing, named export

### AuthContext Addition

Add `resetPassword(email: string) => Promise<void>` to `AuthContextType` and `AuthProvider`. Wraps `sendPasswordResetEmail(auth, email)`.

### Navigation Changes

- Add `ForgotPassword` to `AuthStackParamList` in `RootNavigator.tsx`
- Add `ForgotPassword` screen to `AuthStack.Navigator`
- Add "Forgot Password?" `TouchableOpacity` link on `LoginScreen` between the sign-in button and register link

## 2. Input Validation

### LoginScreen

- Email: validate format on blur using regex `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`
- Password: require non-empty (Firebase enforces min 6 chars)
- Show inline red error text below each field when validation fails
- Disable "Sign In" button when either field is empty

### RegisterScreen

- Email: same validation as LoginScreen
- Password: show strength hint — "Must be at least 6 characters"
- Confirm Password: real-time match check, show inline error "Passwords do not match" when fields differ and confirm field has been touched
- Disable "Register" button until all validations pass

### Validation State

Each screen manages validation state locally via `useState`:
```typescript
const [errors, setErrors] = useState<{ email?: string; password?: string; confirmPassword?: string }>({});
```

Inline error text rendered as `<Text>` below each `TextInput`, styled with `color: colors.danger, fontSize: 12, marginTop: -12, marginBottom: 8`.

## 3. Firebase Error Translation

### New Utility: `src/utils/authErrors.ts`

Named export `getAuthErrorMessage(error: unknown): string`

Maps Firebase Auth error codes to user-friendly messages:

| Firebase Code | User Message |
|---|---|
| `auth/user-not-found` | "No account found with this email" |
| `auth/wrong-password` | "Incorrect password" |
| `auth/invalid-credential` | "Invalid email or password" |
| `auth/email-already-in-use` | "An account with this email already exists" |
| `auth/weak-password` | "Password must be at least 6 characters" |
| `auth/invalid-email` | "Please enter a valid email address" |
| `auth/too-many-requests` | "Too many attempts. Please try again later" |
| `auth/network-request-failed` | "Network error. Check your connection" |
| Default | "Something went wrong. Please try again" |

Used by LoginScreen, RegisterScreen, and ForgotPasswordScreen instead of raw `error.message`.

Error display changes from `Alert.alert()` to inline error text at the top of the form (a general form-level error banner).

## 4. UX Improvements

### Keyboard Handling

Wrap each auth screen's content in `KeyboardAvoidingView` with:
- `behavior="padding"` on iOS
- `behavior="height"` on Android
- Nested `ScrollView` with `keyboardShouldPersistTaps="handled"`

### Auto-focus

Email `TextInput` gets `autoFocus={true}` on LoginScreen and ForgotPasswordScreen.

### Submit on Return Key

- Email field: `returnKeyType="next"`, on submit focus password field via `ref`
- Password field: `returnKeyType="done"` (Login) or `returnKeyType="next"` (Register), triggers form submit or focuses next field
- Confirm password field (Register): `returnKeyType="done"`, triggers submit

## Files Changed

| File | Change |
|---|---|
| `src/screens/ForgotPasswordScreen.tsx` | **New** — forgot password screen |
| `src/utils/authErrors.ts` | **New** — Firebase error code translator |
| `src/screens/LoginScreen.tsx` | Add validation, forgot password link, keyboard handling, error translation |
| `src/screens/RegisterScreen.tsx` | Add validation, keyboard handling, error translation |
| `src/contexts/AuthContext.tsx` | Add `resetPassword` method |
| `src/navigation/RootNavigator.tsx` | Add `ForgotPassword` to AuthStack |

## Out of Scope

- Social login (Google/Apple)
- Phone/OTP login
- Biometric unlock
- Onboarding flow
- "Remember me" toggle (Firebase already persists sessions)
