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
