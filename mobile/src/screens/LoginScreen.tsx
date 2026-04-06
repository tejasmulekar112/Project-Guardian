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
