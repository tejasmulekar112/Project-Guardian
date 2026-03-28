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
