import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../theme/ThemeContext';

interface LoginScreenProps {
  navigation: NativeStackNavigationProp<{ Login: undefined; Register: undefined }>;
}

export const LoginScreen = ({ navigation }: LoginScreenProps) => {
  const { signIn } = useAuth();
  const { colors } = useTheme();
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
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>Guardian</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Sign in to continue</Text>
      <TextInput style={[styles.input, { backgroundColor: colors.inputBg, color: colors.inputText }]} placeholder="Email" placeholderTextColor={colors.placeholder} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
      <TextInput style={[styles.input, { backgroundColor: colors.inputBg, color: colors.inputText }]} placeholder="Password" placeholderTextColor={colors.placeholder} value={password} onChangeText={setPassword} secureTextEntry />
      <TouchableOpacity style={[styles.button, { backgroundColor: colors.danger }]} onPress={handleLogin} disabled={loading}>
        {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Sign In</Text>}
      </TouchableOpacity>
      <TouchableOpacity onPress={() => navigation.navigate('Register')}>
        <Text style={[styles.link, { color: colors.info }]}>Don't have an account? Register</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  title: { fontSize: 32, fontWeight: 'bold', marginBottom: 8 },
  subtitle: { fontSize: 16, marginBottom: 32 },
  input: { width: '100%', borderRadius: 8, padding: 16, marginBottom: 16, fontSize: 16 },
  button: { width: '100%', borderRadius: 8, padding: 16, alignItems: 'center', marginBottom: 16 },
  buttonText: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
  link: { fontSize: 14 },
});
