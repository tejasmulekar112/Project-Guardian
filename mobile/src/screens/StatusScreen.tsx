import React, { useState, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { GeoLocation } from '@guardian/shared-schemas';
import { RecordingIndicator } from '../components/RecordingIndicator';
import { EvidenceList } from '../components/EvidenceList';
import { useEvidenceUpload } from '../hooks/useEvidenceUpload';
import { useEvidenceRecorder } from '../hooks/useEvidenceRecorder';
import { addEvidenceItem } from '../services/evidenceStorage';
import { uploadEventEvidence } from '../services/evidenceUpload';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../theme/ThemeContext';

type StatusScreenProps = NativeStackScreenProps<{
  Home: undefined;
  Status: { eventId: string } | undefined;
  Contacts: undefined;
  Tracking: { initialLocation: GeoLocation; eventId: string };
}, 'Status'>;

export const StatusScreen = ({ route }: StatusScreenProps) => {
  const eventId = route.params?.eventId ?? null;
  const { user } = useAuth();
  const { colors } = useTheme();
  const { state: recorderState } = useEvidenceRecorder();
  const { items, uploadedCount, totalCount, retryAll } = useEvidenceUpload(eventId);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [showCamera, setShowCamera] = useState(false);
  const photoCameraRef = useRef<CameraView | null>(null);

  const takePhoto = useCallback(async () => {
    if (!photoCameraRef.current || !eventId || !user) return;

    try {
      const photo = await photoCameraRef.current.takePictureAsync({ quality: 0.8 });
      if (photo?.uri) {
        await addEvidenceItem(eventId, user.uid, 'photo', photo.uri);
        void uploadEventEvidence(eventId);
        setShowCamera(false);
      }
    } catch {
      Alert.alert('Error', 'Failed to take photo');
    }
  }, [eventId, user]);

  const handleOpenCamera = useCallback(async () => {
    if (!cameraPermission?.granted) {
      const result = await requestCameraPermission();
      if (!result.granted) {
        Alert.alert('Permission Denied', 'Camera permission is required to take photos.');
        return;
      }
    }
    setShowCamera(true);
  }, [cameraPermission, requestCameraPermission]);

  if (showCamera) {
    return (
      <View style={styles.cameraContainer}>
        <CameraView
          ref={photoCameraRef}
          style={styles.camera}
          facing="back"
        />
        <View style={styles.cameraControls}>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowCamera(false)}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.captureBtn} onPress={takePhoto}>
            <View style={styles.captureBtnInner} />
          </TouchableOpacity>
          <View style={styles.spacer} />
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      <Text style={styles.title}>SOS Triggered</Text>
      <Text style={[styles.subtitle, { color: colors.success }]}>Help is on the way</Text>

      {eventId && <Text style={[styles.eventId, { color: colors.textTertiary }]}>Event: {eventId}</Text>}

      {/* Recording indicator */}
      {recorderState.isRecording && (
        <RecordingIndicator
          audioRemaining={recorderState.audioRemaining}
          videoRemaining={recorderState.videoRemaining}
        />
      )}

      {/* Take Photo button — shown after recording completes */}
      {eventId && recorderState.recordingComplete && (
        <TouchableOpacity style={[styles.photoBtn, { backgroundColor: colors.surface, borderColor: colors.info }]} onPress={handleOpenCamera}>
          <Text style={[styles.photoBtnText, { color: colors.info }]}>Take Photo</Text>
        </TouchableOpacity>
      )}

      {/* Evidence list */}
      {eventId && (
        <EvidenceList
          items={items}
          uploadedCount={uploadedCount}
          totalCount={totalCount}
          onRetry={retryAll}
        />
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  title: {
    color: '#EF4444',
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  eventId: {
    fontSize: 12,
    marginBottom: 24,
    fontFamily: 'monospace',
  },
  photoBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderWidth: 2,
    alignItems: 'center',
    marginBottom: 16,
  },
  photoBtnText: {
    fontSize: 16,
    fontWeight: '600',
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  camera: {
    flex: 1,
  },
  cameraControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 40,
    backgroundColor: '#000000',
  },
  cancelBtn: {
    padding: 12,
  },
  cancelBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  captureBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureBtnInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
  },
  spacer: {
    width: 60,
  },
});
