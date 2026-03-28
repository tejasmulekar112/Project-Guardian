import React, { useState } from 'react';
import { View, StyleSheet, Text, Alert } from 'react-native';
import { SOSButton } from '../components/SOSButton';

export const HomeScreen: React.FC = () => {
  const [isTriggered, setIsTriggered] = useState(false);

  const handleSOS = async (): Promise<void> => {
    setIsTriggered(true);
    Alert.alert('SOS Triggered', 'Emergency contacts are being notified.');
    // TODO: Call backend POST /sos/trigger via api service
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Project Guardian</Text>
      <Text style={styles.subtitle}>Press the button in an emergency</Text>
      <SOSButton onPress={handleSOS} disabled={isTriggered} />
      {isTriggered && (
        <Text style={styles.status}>Help is on the way</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#111827',
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
});
