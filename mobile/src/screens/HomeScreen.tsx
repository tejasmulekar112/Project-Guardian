import React, { useState } from 'react';
import { View, StyleSheet, Text, Alert } from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SOSButton } from '../components/SOSButton';
import { useLocation } from '../hooks/useLocation';
import { useAuth } from '../contexts/AuthContext';
import { triggerSOS } from '../services/api';
import type { GeoLocation } from '@guardian/shared-schemas';

interface HomeScreenProps {
  navigation: NativeStackNavigationProp<{
    Home: undefined;
    Status: undefined;
    Contacts: undefined;
    Tracking: { initialLocation: GeoLocation; eventId: string };
  }>;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ navigation }) => {
  const { user, signOut } = useAuth();
  const { location, refresh: refreshLocation } = useLocation();
  const [isTriggered, setIsTriggered] = useState(false);
  const [sending, setSending] = useState(false);

  const handleSOS = async (): Promise<void> => {
    if (!user) {
      Alert.alert('Not Signed In', 'Please sign in before triggering SOS.');
      return;
    }
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
        triggerType: 'manual',
        message: 'Emergency SOS triggered',
      });

      setIsTriggered(true);
      Alert.alert('SOS Sent', `Emergency contacts are being notified.\nEvent: ${result.eventId}`);

      if (currentLocation) {
        navigation.navigate('Tracking', {
          initialLocation: currentLocation,
          eventId: result.eventId,
        });
      }
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
