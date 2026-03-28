import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';

interface SOSButtonProps {
  onPress: () => void;
  disabled?: boolean;
}

export const SOSButton: React.FC<SOSButtonProps> = ({ onPress, disabled = false }) => (
  <TouchableOpacity
    style={[styles.button, disabled && styles.disabled]}
    onPress={onPress}
    disabled={disabled}
    accessibilityLabel="Emergency SOS Button"
    accessibilityRole="button"
  >
    <Text style={styles.text}>SOS</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  button: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#DC2626',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  disabled: {
    backgroundColor: '#9CA3AF',
  },
  text: {
    color: '#FFFFFF',
    fontSize: 48,
    fontWeight: 'bold',
    letterSpacing: 4,
  },
});
