import React, { useCallback, useState } from 'react';
import { View, StyleSheet, Text, Alert, TouchableOpacity } from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SOSButton } from '../components/SOSButton';
import { CountdownOverlay } from '../components/CountdownOverlay';
import { VoiceIndicator } from '../components/VoiceIndicator';
import { useLocation } from '../hooks/useLocation';
import { useAuth } from '../contexts/AuthContext';
import { useVoiceDetection } from '../hooks/useVoiceDetection';
import { triggerSOS } from '../services/api';
import type { GeoLocation, TriggerType } from '@guardian/shared-schemas';

interface HomeScreenProps {
  navigation: NativeStackNavigationProp<{
    Home: undefined;
    Status: undefined;
    Contacts: undefined;
    Tracking: { initialLocation: GeoLocation; eventId: string };
  }>;
}

export const HomeScreen = ({ navigation }: HomeScreenProps) => {
  const { user, signOut } = useAuth();
  const { location, refresh: refreshLocation } = useLocation();
  const [isTriggered, setIsTriggered] = useState(false);
  const [sending, setSending] = useState(false);
  const [showCountdown, setShowCountdown] = useState(false);

  const {
    isListening,
    detection,
    error: voiceError,
    startListening,
    stopListening,
    clearDetection,
  } = useVoiceDetection();

  const handleSOS = useCallback(async (triggerType: TriggerType = 'manual', message?: string): Promise<void> => {
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
        userId: user.uid,
        location: currentLocation ?? { latitude: 0, longitude: 0 },
        triggerType,
        message: message ?? 'Emergency SOS triggered',
      });

      setIsTriggered(true);
      Alert.alert('SOS Sent', `Emergency contacts are being notified.\nEvent: ${result.eventId}`);
    } catch (err) {
      Alert.alert('SOS Failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSending(false);
    }
  }, [user, location, refreshLocation]);

  // When voice detection finds distress, show countdown
  React.useEffect(() => {
    if (detection?.detected) {
      setShowCountdown(true);
    }
  }, [detection]);

  const handleCountdownConfirm = useCallback(() => {
    setShowCountdown(false);
    const transcript = detection?.transcript ?? '';
    void handleSOS('voice', `Voice detected: "${transcript}"`);
    clearDetection();
  }, [detection, handleSOS, clearDetection]);

  const handleCountdownCancel = useCallback(() => {
    setShowCountdown(false);
    clearDetection();
    // Resume listening
    void startListening();
  }, [clearDetection, startListening]);

  const toggleListening = useCallback(async () => {
    if (isListening) {
      await stopListening();
    } else {
      await startListening();
    }
  }, [isListening, startListening, stopListening]);

  return (
    <View style={styles.container}>
      {showCountdown && detection?.keyword && (
        <CountdownOverlay
          keyword={detection.keyword}
          onConfirm={handleCountdownConfirm}
          onCancel={handleCountdownCancel}
        />
      )}

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
        <SOSButton onPress={() => handleSOS('manual')} disabled={isTriggered || sending} />
        {isTriggered && <Text style={styles.status}>Help is on the way</Text>}
        {sending && <Text style={styles.sending}>Sending SOS...</Text>}

        {/* Voice Detection Toggle */}
        <TouchableOpacity
          style={[styles.voiceBtn, isListening && styles.voiceBtnActive]}
          onPress={toggleListening}
          disabled={isTriggered || sending}
        >
          <Text style={styles.voiceBtnText}>
            {isListening ? 'Stop Listening' : 'Start Voice Detection'}
          </Text>
        </TouchableOpacity>

        {isListening && <VoiceIndicator />}
        {voiceError && <Text style={styles.errorText}>{voiceError}</Text>}
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
  voiceBtn: {
    marginTop: 24,
    backgroundColor: '#1F2937',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderWidth: 2,
    borderColor: '#374151',
  },
  voiceBtnActive: {
    borderColor: '#EF4444',
    backgroundColor: '#291111',
  },
  voiceBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 14,
    marginTop: 8,
  },
});
