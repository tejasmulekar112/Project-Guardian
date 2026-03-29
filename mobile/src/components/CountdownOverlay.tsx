import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Vibration } from 'react-native';

interface CountdownOverlayProps {
  keyword: string;
  seconds?: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export const CountdownOverlay = ({
  keyword,
  seconds = 10,
  onConfirm,
  onCancel,
}: CountdownOverlayProps) => {
  const [remaining, setRemaining] = useState(seconds);

  useEffect(() => {
    Vibration.vibrate([0, 500, 200, 500]);

    const interval = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onConfirm();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(interval);
      Vibration.cancel();
    };
  }, [onConfirm]);

  return (
    <View style={styles.overlay}>
      <View style={styles.content}>
        <Text style={styles.title}>Distress Detected!</Text>
        <Text style={styles.keyword}>"{keyword}"</Text>

        <View style={styles.countdownCircle}>
          <Text style={styles.countdownNumber}>{remaining}</Text>
        </View>

        <Text style={styles.subtitle}>
          SOS will trigger in {remaining} seconds
        </Text>

        <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
          <Text style={styles.cancelBtnText}>CANCEL</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  content: {
    alignItems: 'center',
    padding: 32,
  },
  title: {
    color: '#EF4444',
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  keyword: {
    color: '#FBBF24',
    fontSize: 20,
    fontStyle: 'italic',
    marginBottom: 32,
  },
  countdownCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  countdownNumber: {
    color: '#FFFFFF',
    fontSize: 48,
    fontWeight: 'bold',
  },
  subtitle: {
    color: '#9CA3AF',
    fontSize: 16,
    marginBottom: 40,
  },
  cancelBtn: {
    backgroundColor: '#374151',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderWidth: 2,
    borderColor: '#6B7280',
  },
  cancelBtnText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
});
