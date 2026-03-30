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
import { getContacts, setContacts } from '../services/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../theme/ThemeContext';

export const ContactsScreen = () => {
  const { user } = useAuth();
  const { colors } = useTheme();
  const [contacts, setLocalContacts] = useState<EmergencyContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [relationship, setRelationship] = useState('');

  const loadContacts = useCallback(async () => {
    if (!user) return;
    try {
      const data = await getContacts(user.uid);
      setLocalContacts(data);
    } catch {
      Alert.alert('Error', 'Failed to load contacts');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void loadContacts();
  }, [loadContacts]);

  const handleAdd = async (): Promise<void> => {
    if (!user || !name || !phone || !relationship) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    const updated = [...contacts, { name, phone, relationship }];
    try {
      await setContacts(user.uid, updated);
      setLocalContacts(updated);
      setName('');
      setPhone('');
      setRelationship('');
    } catch {
      Alert.alert('Error', 'Failed to save contact');
    }
  };

  const handleDelete = async (index: number): Promise<void> => {
    if (!user) return;
    const updated = contacts.filter((_, i) => i !== index);
    try {
      await setContacts(user.uid, updated);
      setLocalContacts(updated);
    } catch {
      Alert.alert('Error', 'Failed to delete contact');
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.danger} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={contacts}
        keyExtractor={(_, i) => i.toString()}
        ListEmptyComponent={<Text style={[styles.empty, { color: colors.textSecondary }]}>No emergency contacts yet</Text>}
        renderItem={({ item, index }) => (
          <View style={[styles.contactRow, { backgroundColor: colors.surface }]}>
            <View style={styles.contactInfo}>
              <Text style={[styles.contactName, { color: colors.text }]}>{item.name}</Text>
              <Text style={[styles.contactDetail, { color: colors.textSecondary }]}>{item.phone} · {item.relationship}</Text>
            </View>
            <TouchableOpacity onPress={() => handleDelete(index)}>
              <Text style={styles.deleteBtn}>Remove</Text>
            </TouchableOpacity>
          </View>
        )}
      />

      <View style={[styles.form, { borderTopColor: colors.border }]}>
        <Text style={[styles.formTitle, { color: colors.text }]}>Add Contact</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.inputBg, color: colors.inputText }]}
          placeholder="Name"
          placeholderTextColor={colors.placeholder}
          value={name}
          onChangeText={setName}
        />
        <TextInput
          style={[styles.input, { backgroundColor: colors.inputBg, color: colors.inputText }]}
          placeholder="Phone (+1234567890)"
          placeholderTextColor={colors.placeholder}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
        />
        <TextInput
          style={[styles.input, { backgroundColor: colors.inputBg, color: colors.inputText }]}
          placeholder="Relationship"
          placeholderTextColor={colors.placeholder}
          value={relationship}
          onChangeText={setRelationship}
        />
        <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.successBg }]} onPress={handleAdd}>
          <Text style={styles.addBtnText}>Add Contact</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  empty: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 32,
  },
  contactRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 8,
    padding: 16,
    marginBottom: 8,
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '600',
  },
  contactDetail: {
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
    paddingTop: 16,
    marginTop: 16,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  input: {
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    fontSize: 16,
  },
  addBtn: {
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
