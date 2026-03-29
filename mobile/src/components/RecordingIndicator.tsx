import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';

interface RecordingIndicatorProps {
  audioRemaining: number;
  videoRemaining: number;
}

export const RecordingIndicator = ({ audioRemaining, videoRemaining }: RecordingIndicatorProps) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.3,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [pulseAnim]);

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Animated.View style={[styles.dot, { transform: [{ scale: pulseAnim }] }]} />
        <Text style={styles.label}>Recording Evidence</Text>
      </View>

      {audioRemaining > 0 && (
        <Text style={styles.timer}>Audio: {audioRemaining}s remaining</Text>
      )}
      {videoRemaining > 0 && (
        <Text style={styles.timer}>Video: {videoRemaining}s remaining</Text>
      )}
      {audioRemaining <= 0 && videoRemaining <= 0 && (
        <Text style={styles.complete}>Recording complete</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1F2937',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#EF4444',
  },
  label: {
    color: '#EF4444',
    fontSize: 16,
    fontWeight: '600',
  },
  timer: {
    color: '#FBBF24',
    fontSize: 14,
    marginLeft: 20,
    marginTop: 4,
  },
  complete: {
    color: '#34D399',
    fontSize: 14,
    marginLeft: 20,
  },
});
