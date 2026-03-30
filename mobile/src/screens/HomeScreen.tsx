import React, { useCallback, useState } from 'react';
import { View, StyleSheet, Text, Alert, TouchableOpacity } from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { SOSButton } from '../components/SOSButton';
import { CountdownOverlay } from '../components/CountdownOverlay';
import { VoiceIndicator } from '../components/VoiceIndicator';
import { useLocation } from '../hooks/useLocation';
import { useAuth } from '../contexts/AuthContext';
import { useVoiceDetection } from '../hooks/useVoiceDetection';
import { useEvidenceRecorder } from '../hooks/useEvidenceRecorder';
import { useTheme } from '../theme/ThemeContext';
import { triggerSOS } from '../services/api';
import type { GeoLocation, TriggerType } from '@guardian/shared-schemas';

interface HomeScreenProps {
  navigation: NativeStackNavigationProp<{
    Home: undefined;
    Status: { eventId: string } | undefined;
    Contacts: undefined;
    Tracking: { initialLocation: GeoLocation; eventId: string };
  }>;
}

export const HomeScreen = ({ navigation }: HomeScreenProps) => {
  const { user, signOut } = useAuth();
  const { colors, toggleTheme, isDark } = useTheme();
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

  const { state: recorderState, cameraRef, startRecording } = useEvidenceRecorder();
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

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

      // Start evidence recording
      if (!cameraPermission?.granted) {
        await requestCameraPermission();
      }
      void startRecording(result.eventId, user.uid);

      Alert.alert('SOS Sent', `Emergency contacts are being notified.`, [
        {
          text: 'View Status',
          onPress: () => navigation.navigate('Status', { eventId: result.eventId }),
        },
      ]);
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
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {showCountdown && detection?.keyword && (
        <CountdownOverlay
          keyword={detection.keyword}
          onConfirm={handleCountdownConfirm}
          onCancel={handleCountdownCancel}
        />
      )}

      <View style={styles.header}>
        <Text style={[styles.email, { color: colors.textSecondary }]}>{user?.email}</Text>
        <View style={styles.headerButtons}>
          <Text style={[styles.headerLink, { color: colors.info }]} onPress={toggleTheme}>
            {isDark ? 'Light' : 'Dark'}
          </Text>
          <Text style={[styles.headerLink, { color: colors.info }]} onPress={() => navigation.navigate('Contacts')}>
            Contacts
          </Text>
          <Text style={[styles.headerLink, { color: colors.info }]} onPress={signOut}>
            Sign Out
          </Text>
        </View>
      </View>

      <View style={styles.center}>
        <Text style={[styles.title, { color: colors.text }]}>Guardian</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Press the button in an emergency</Text>
        <SOSButton onPress={() => handleSOS('manual')} disabled={isTriggered || sending} />
        {isTriggered && <Text style={[styles.status, { color: colors.success }]}>Help is on the way</Text>}
        {sending && <Text style={[styles.sending, { color: colors.warning }]}>Sending SOS...</Text>}

        {/* Voice Detection Toggle */}
        <TouchableOpacity
          style={[
            styles.voiceBtn,
            { backgroundColor: colors.surface, borderColor: colors.border },
            isListening && { borderColor: '#EF4444', backgroundColor: isDark ? '#291111' : '#FEE2E2' },
          ]}
          onPress={toggleListening}
          disabled={isTriggered || sending}
        >
          <Text style={[styles.voiceBtnText, { color: colors.text }]}>
            {isListening ? 'Stop Listening' : 'Start Voice Detection'}
          </Text>
        </TouchableOpacity>

        {isListening && <VoiceIndicator />}
        {voiceError && <Text style={styles.errorText}>{voiceError}</Text>}
      </View>

      {/* Hidden camera for evidence recording */}
      {isTriggered && recorderState.isRecording && (
        <CameraView
          ref={cameraRef}
          style={styles.hiddenCamera}
          facing="back"
          mode="video"
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 60,
  },
  email: {
    fontSize: 14,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 16,
  },
  headerLink: {
    fontSize: 14,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 48,
  },
  status: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 32,
  },
  sending: {
    fontSize: 16,
    marginTop: 16,
  },
  voiceBtn: {
    marginTop: 24,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderWidth: 2,
  },
  voiceBtnText: {
    fontSize: 16,
    fontWeight: '600',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 14,
    marginTop: 8,
  },
  hiddenCamera: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
});
