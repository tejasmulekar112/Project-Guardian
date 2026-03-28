import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export const ContactsScreen: React.FC = () => (
  <View style={styles.container}>
    <Text style={styles.title}>Emergency Contacts</Text>
    <Text style={styles.placeholder}>Contact management coming soon</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#111827' },
  title: { color: '#FFFFFF', fontSize: 24, fontWeight: 'bold', marginBottom: 16 },
  placeholder: { color: '#9CA3AF', fontSize: 16 },
});
