import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, Text, Alert, Platform, Switch } from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { SOSButton } from '../components/SOSButton';
import { CountdownOverlay } from '../components/CountdownOverlay';
import { VoiceIndicator } from '../components/VoiceIndicator';
import { useLocation } from '../hooks/useLocation';
import { useAuth } from '../contexts/AuthContext';
import { useVoiceDetection } from '../hooks/useVoiceDetection';
import { useShakeDetection } from '../hooks/useShakeDetection';
import { useEvidenceRecorder } from '../hooks/useEvidenceRecorder';
import { useTheme } from '../theme/ThemeContext';
import { ProfileMenu } from '../components/ProfileMenu';
import { useBackgroundProtection } from '../hooks/useBackgroundProtection';
import { triggerSOS } from '../services/api';
import type { GeoLocation, TriggerType } from '@guardian/shared-schemas';

interface HomeScreenProps {
  navigation: NativeStackNavigationProp<{
    Home: undefined;
    Status: { eventId: string } | undefined;
    Contacts: undefined;
    Tracking: { initialLocation: GeoLocation; eventId: string };
    Settings: undefined;
  }>;
}

export const HomeScreen = ({ navigation }: HomeScreenProps) => {
  const { user, signOut } = useAuth();
  const { colors } = useTheme();
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

  const {
    isActive: isShakeActive,
    shakeDetected,
    start: startShake,
    stop: stopShake,
    clearDetection: clearShake,
  } = useShakeDetection();

  const { state: recorderState, cameraRef, startRecording } = useEvidenceRecorder();
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  const {
    isRunning: bgRunning,
    isEnabled: bgEnabled,
    toggle: toggleBg,
    backgroundSOSEventId,
    clearBackgroundSOS,
  } = useBackgroundProtection();

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

  // When shake is detected, show countdown
  React.useEffect(() => {
    if (shakeDetected) {
      setShowCountdown(true);
    }
  }, [shakeDetected]);

  // Handle background SOS trigger — navigate to StatusScreen
  useEffect(() => {
    if (backgroundSOSEventId) {
      clearBackgroundSOS();
      navigation.navigate('Status', { eventId: backgroundSOSEventId });
    }
  }, [backgroundSOSEventId, clearBackgroundSOS, navigation]);

  const handleCountdownConfirm = useCallback(() => {
    setShowCountdown(false);
    if (shakeDetected) {
      clearShake();
      void handleSOS('shake', 'Shake detected');
    } else {
      const transcript = detection?.transcript ?? '';
      void handleSOS('voice', `Voice detected: "${transcript}"`);
      clearDetection();
    }
  }, [detection, shakeDetected, handleSOS, clearDetection, clearShake]);

  const handleCountdownCancel = useCallback(() => {
    setShowCountdown(false);
    if (shakeDetected) {
      clearShake();
    } else {
      clearDetection();
      void startListening();
    }
  }, [shakeDetected, clearDetection, clearShake, startListening]);

  // Auto-start voice and shake detection on mount
  useEffect(() => {
    if (!isTriggered && !sending) {
      void startListening();
      startShake();
    }
    return () => {
      void stopListening();
      stopShake();
    };
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {showCountdown && (detection?.keyword || shakeDetected) && (
        <CountdownOverlay
          keyword={shakeDetected ? 'Shake Detected' : detection?.keyword ?? ''}
          onConfirm={handleCountdownConfirm}
          onCancel={handleCountdownCancel}
        />
      )}

      <View style={styles.header}>
        <Text style={[styles.appName, { color: colors.text }]}>Guardian</Text>
        <ProfileMenu
          email={user?.email ?? ''}
          onContacts={() => navigation.navigate('Contacts')}
          onSettings={() => navigation.navigate('Settings')}
          onSignOut={signOut}
        />
      </View>

      <View style={styles.center}>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Press the button in an emergency</Text>
        <SOSButton onPress={() => handleSOS('manual')} disabled={isTriggered || sending} />
        {isTriggered && <Text style={[styles.status, { color: colors.success }]}>Help is on the way</Text>}
        {sending && <Text style={[styles.sending, { color: colors.warning }]}>Sending SOS...</Text>}

        {/* Voice & Shake Detection - always active */}
        {isListening && <VoiceIndicator />}
        {isShakeActive && (
          <View style={styles.shakeIndicator}>
            <Text style={styles.shakeIndicatorText}>Shake 3x to trigger SOS</Text>
          </View>
        )}
        {voiceError && <Text style={styles.errorText}>{voiceError}</Text>}

        {/* Background Protection Toggle (Android only) */}
        {Platform.OS === 'android' && (
          <View style={styles.bgProtectionContainer}>
            <View style={styles.bgProtectionRow}>
              <View>
                <Text style={[styles.bgProtectionTitle, { color: colors.text }]}>
                  Background Protection
                </Text>
                <Text style={[styles.bgProtectionStatus, { color: colors.textSecondary }]}>
                  {bgRunning ? 'Active — listening for distress calls' : 'Inactive'}
                </Text>
              </View>
              <Switch
                value={bgEnabled}
                onValueChange={toggleBg}
                trackColor={{ false: '#767577', true: '#22C55E' }}
                thumbColor={bgEnabled ? '#FFFFFF' : '#f4f3f4'}
              />
            </View>
          </View>
        )}
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
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 8,
  },
  appName: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  shakeIndicator: {
    marginTop: 12,
  },
  shakeIndicatorText: {
    color: '#F59E0B',
    fontSize: 14,
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
  bgProtectionContainer: {
    marginTop: 24,
    paddingHorizontal: 24,
    width: '100%',
  },
  bgProtectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 12,
    padding: 16,
  },
  bgProtectionTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  bgProtectionStatus: {
    fontSize: 12,
    marginTop: 2,
  },
});
