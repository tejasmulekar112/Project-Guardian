import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import type { EmergencyContact } from '@guardian/shared-schemas';
import { getContacts, setContacts } from '../services/api';

export const ContactsScreen: React.FC = () => {
  const [contacts, setLocalContacts] = useState<EmergencyContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [relationship, setRelationship] = useState('');

  const loadContacts = useCallback(async () => {
    try {
      const data = await getContacts();
      setLocalContacts(data);
    } catch {
      Alert.alert('Error', 'Failed to load contacts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadContacts();
  }, [loadContacts]);

  const handleAdd = async (): Promise<void> => {
    if (!name || !phone || !relationship) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    const updated = [...contacts, { name, phone, relationship }];
    try {
      await setContacts(updated);
      setLocalContacts(updated);
      setName('');
      setPhone('');
      setRelationship('');
    } catch {
      Alert.alert('Error', 'Failed to save contact');
    }
  };

  const handleDelete = async (index: number): Promise<void> => {
    const updated = contacts.filter((_, i) => i !== index);
    try {
      await setContacts(updated);
      setLocalContacts(updated);
    } catch {
      Alert.alert('Error', 'Failed to delete contact');
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#DC2626" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={contacts}
        keyExtractor={(_, i) => i.toString()}
        ListEmptyComponent={<Text style={styles.empty}>No emergency contacts yet</Text>}
        renderItem={({ item, index }) => (
          <View style={styles.contactRow}>
            <View style={styles.contactInfo}>
              <Text style={styles.contactName}>{item.name}</Text>
              <Text style={styles.contactDetail}>{item.phone} · {item.relationship}</Text>
            </View>
            <TouchableOpacity onPress={() => handleDelete(index)}>
              <Text style={styles.deleteBtn}>Remove</Text>
            </TouchableOpacity>
          </View>
        )}
      />

      <View style={styles.form}>
        <Text style={styles.formTitle}>Add Contact</Text>
        <TextInput
          style={styles.input}
          placeholder="Name"
          placeholderTextColor="#6B7280"
          value={name}
          onChangeText={setName}
        />
        <TextInput
          style={styles.input}
          placeholder="Phone (+1234567890)"
          placeholderTextColor="#6B7280"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
        />
        <TextInput
          style={styles.input}
          placeholder="Relationship"
          placeholderTextColor="#6B7280"
          value={relationship}
          onChangeText={setRelationship}
        />
        <TouchableOpacity style={styles.addBtn} onPress={handleAdd}>
          <Text style={styles.addBtnText}>Add Contact</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
    padding: 16,
  },
  empty: {
    color: '#9CA3AF',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 32,
  },
  contactRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1F2937',
    borderRadius: 8,
    padding: 16,
    marginBottom: 8,
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  contactDetail: {
    color: '#9CA3AF',
    fontSize: 14,
    marginTop: 4,
  },
  deleteBtn: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '600',
  },
  form: {
    borderTopWidth: 1,
    borderTopColor: '#374151',
    paddingTop: 16,
    marginTop: 16,
  },
  formTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  input: {
    backgroundColor: '#1F2937',
    color: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    fontSize: 16,
  },
  addBtn: {
    backgroundColor: '#059669',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  addBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
