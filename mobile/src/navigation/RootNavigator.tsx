import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { ThemeProvider, useTheme } from '../theme/ThemeContext';
import { HomeScreen } from '../screens/HomeScreen';
import { StatusScreen } from '../screens/StatusScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
import { ForgotPasswordScreen } from '../screens/ForgotPasswordScreen';
import { ContactsScreen } from '../screens/ContactsScreen';
import { TrackingScreen } from '../screens/TrackingScreen';
import type { GeoLocation } from '@guardian/shared-schemas';

type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
};

type AppStackParamList = {
  Home: undefined;
  Status: { eventId: string } | undefined;
  Contacts: undefined;
  Tracking: { initialLocation: GeoLocation; eventId: string };
};

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const AppStack = createNativeStackNavigator<AppStackParamList>();

const AuthNavigator = () => {
  const { colors } = useTheme();
  const headerOptions = {
    headerStyle: { backgroundColor: colors.headerBg },
    headerTintColor: colors.headerText,
    headerTitleStyle: { fontWeight: 'bold' as const },
  };

  return (
    <AuthStack.Navigator screenOptions={headerOptions}>
      <AuthStack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
      <AuthStack.Screen name="Register" component={RegisterScreen} options={{ title: 'Register' }} />
      <AuthStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} options={{ title: 'Forgot Password' }} />
    </AuthStack.Navigator>
  );
};

const AppNavigator = () => {
  const { colors } = useTheme();
  const headerOptions = {
    headerStyle: { backgroundColor: colors.headerBg },
    headerTintColor: colors.headerText,
    headerTitleStyle: { fontWeight: 'bold' as const },
  };

  return (
    <AppStack.Navigator screenOptions={headerOptions}>
      <AppStack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
      <AppStack.Screen name="Status" component={StatusScreen} options={{ title: 'SOS Status' }} />
      <AppStack.Screen name="Contacts" component={ContactsScreen} options={{ title: 'Emergency Contacts' }} />
      <AppStack.Screen name="Tracking" component={TrackingScreen} options={{ title: 'Live Tracking' }} />
    </AppStack.Navigator>
  );
};

const NavigationContent = () => {
  const { user, loading } = useAuth();
  const { colors, isDark } = useTheme();

  const navTheme = isDark
    ? { ...DarkTheme, colors: { ...DarkTheme.colors, background: colors.background, card: colors.headerBg, text: colors.text, border: colors.border } }
    : { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: colors.background, card: colors.headerBg, text: colors.text, border: colors.border } };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.danger} />
      </View>
    );
  }

  return (
    <NavigationContainer theme={navTheme}>
      {user ? <AppNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
};

export const RootNavigator = () => (
  <ThemeProvider>
    <AuthProvider>
      <NavigationContent />
    </AuthProvider>
  </ThemeProvider>
);
