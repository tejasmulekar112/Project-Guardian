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
import { TrackingScreen } from '../screens/TrackingScreen';
import type { GeoLocation } from '@guardian/shared-schemas';

type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

type AppStackParamList = {
  Home: undefined;
  Status: undefined;
  Contacts: undefined;
  Tracking: { initialLocation: GeoLocation; eventId: string };
};

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const AppStack = createNativeStackNavigator<AppStackParamList>();

const headerOptions = {
  headerStyle: { backgroundColor: '#111827' },
  headerTintColor: '#FFFFFF',
  headerTitleStyle: { fontWeight: 'bold' as const },
};

const AuthNavigator = () => (
  <AuthStack.Navigator screenOptions={headerOptions}>
    <AuthStack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
    <AuthStack.Screen name="Register" component={RegisterScreen} options={{ title: 'Register' }} />
  </AuthStack.Navigator>
);

const AppNavigator = () => (
  <AppStack.Navigator screenOptions={headerOptions}>
    <AppStack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
    <AppStack.Screen name="Status" component={StatusScreen} options={{ title: 'SOS Status' }} />
    <AppStack.Screen name="Contacts" component={ContactsScreen} options={{ title: 'Emergency Contacts' }} />
    <AppStack.Screen name="Tracking" component={TrackingScreen} options={{ title: 'Live Tracking' }} />
  </AppStack.Navigator>
);

const NavigationContent = () => {
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

export const RootNavigator = () => (
  <AuthProvider>
    <NavigationContent />
  </AuthProvider>
);
