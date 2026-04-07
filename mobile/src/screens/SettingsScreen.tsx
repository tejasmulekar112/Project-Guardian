import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  TextInput,
  Alert,
  Platform,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../hooks/useSettings';
import { useBackgroundProtection } from '../hooks/useBackgroundProtection';

const COUNTDOWN_OPTIONS = [5, 10, 15, 20];

export const SettingsScreen = () => {
  const { colors, isDark, toggleTheme } = useTheme();
  const { user, signOut } = useAuth();
  const {
    keywords,
    countdownSeconds,
    loading,
    addKeyword,
    removeKeyword,
    resetKeywords,
    setCountdownSeconds,
  } = useSettings();
  const { isRunning: bgRunning, isEnabled: bgEnabled, toggle: toggleBg } = useBackgroundProtection();

  const [newKeyword, setNewKeyword] = useState('');

  const handleAddKeyword = async () => {
    const trimmed = newKeyword.trim().toLowerCase();
    if (!trimmed) return;
    if (keywords.includes(trimmed)) {
      Alert.alert('Duplicate', 'This keyword already exists.');
      return;
    }
    await addKeyword(trimmed);
    setNewKeyword('');
  };

  const handleRemoveKeyword = (keyword: string) => {
    if (keywords.length <= 1) {
      Alert.alert('Cannot Remove', 'You must have at least one trigger keyword.');
      return;
    }
    Alert.alert('Remove Keyword', `Remove "${keyword}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeKeyword(keyword) },
    ]);
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Voice Detection Section */}
      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>VOICE DETECTION</Text>
      <View style={[styles.section, { backgroundColor: colors.surface }]}>
        {/* Trigger Keywords */}
        <Text style={[styles.label, { color: colors.text }]}>Trigger Keywords</Text>
        <Text style={[styles.hint, { color: colors.textTertiary }]}>
          Words that activate SOS when detected
        </Text>
        <View style={styles.keywordsList}>
          {keywords.map((kw) => (
            <TouchableOpacity
              key={kw}
              style={[styles.keywordChip, { backgroundColor: colors.surfaceAlt }]}
              onLongPress={() => handleRemoveKeyword(kw)}
            >
              <Text style={[styles.keywordText, { color: colors.text }]}>{kw}</Text>
              <TouchableOpacity onPress={() => handleRemoveKeyword(kw)}>
                <Text style={[styles.keywordRemove, { color: colors.textTertiary }]}>x</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.addKeywordRow}>
          <TextInput
            style={[
              styles.keywordInput,
              {
                backgroundColor: colors.inputBg,
                borderColor: colors.inputBorder,
                color: colors.inputText,
              },
            ]}
            value={newKeyword}
            onChangeText={setNewKeyword}
            placeholder="Add keyword..."
            placeholderTextColor={colors.placeholder}
            onSubmitEditing={handleAddKeyword}
            returnKeyType="done"
          />
          <TouchableOpacity
            style={[styles.addButton, { backgroundColor: colors.info }]}
            onPress={handleAddKeyword}
          >
            <Text style={styles.addButtonText}>Add</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity onPress={resetKeywords}>
          <Text style={[styles.resetLink, { color: colors.info }]}>Reset to defaults</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.section, { backgroundColor: colors.surface }]}>
        {/* Countdown Duration */}
        <Text style={[styles.label, { color: colors.text }]}>Countdown Duration</Text>
        <Text style={[styles.hint, { color: colors.textTertiary }]}>
          Time to cancel before SOS fires
        </Text>
        <View style={styles.segmentedControl}>
          {COUNTDOWN_OPTIONS.map((seconds) => (
            <TouchableOpacity
              key={seconds}
              style={[
                styles.segmentButton,
                {
                  backgroundColor:
                    countdownSeconds === seconds ? colors.info : colors.surfaceAlt,
                },
              ]}
              onPress={() => setCountdownSeconds(seconds)}
            >
              <Text
                style={[
                  styles.segmentText,
                  {
                    color: countdownSeconds === seconds ? '#FFFFFF' : colors.text,
                    fontWeight: countdownSeconds === seconds ? 'bold' : 'normal',
                  },
                ]}
              >
                {seconds}s
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Background Protection */}
      {Platform.OS === 'android' && (
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text style={[styles.label, { color: colors.text }]}>Background Protection</Text>
              <Text style={[styles.hint, { color: colors.textTertiary }]}>
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

      {/* Appearance Section */}
      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>APPEARANCE</Text>
      <View style={[styles.section, { backgroundColor: colors.surface }]}>
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={[styles.label, { color: colors.text }]}>Dark Mode</Text>
          </View>
          <Switch
            value={isDark}
            onValueChange={toggleTheme}
            trackColor={{ false: '#767577', true: '#22C55E' }}
            thumbColor={isDark ? '#FFFFFF' : '#f4f3f4'}
          />
        </View>
      </View>

      {/* Account Section */}
      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>ACCOUNT</Text>
      <View style={[styles.section, { backgroundColor: colors.surface }]}>
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={[styles.label, { color: colors.text }]}>Email</Text>
            <Text style={[styles.hint, { color: colors.textTertiary }]}>{user?.email ?? '—'}</Text>
          </View>
        </View>
      </View>
      <TouchableOpacity
        style={[styles.signOutButton, { backgroundColor: colors.dangerBg }]}
        onPress={() =>
          Alert.alert('Sign Out', 'Are you sure?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Sign Out', style: 'destructive', onPress: signOut },
          ])
        }
      >
        <Text style={[styles.signOutText, { color: colors.danger }]}>Sign Out</Text>
      </TouchableOpacity>

      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingText: {
    textAlign: 'center',
    marginTop: 40,
    fontSize: 16,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
    marginTop: 24,
    marginBottom: 8,
    marginHorizontal: 16,
  },
  section: {
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
  },
  hint: {
    fontSize: 13,
    marginTop: 2,
  },
  keywordsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
    gap: 8,
  },
  keywordChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    gap: 6,
  },
  keywordText: {
    fontSize: 14,
  },
  keywordRemove: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  addKeywordRow: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 8,
  },
  keywordInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
  },
  addButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    justifyContent: 'center',
  },
  addButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  resetLink: {
    fontSize: 13,
    marginTop: 8,
  },
  segmentedControl: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 8,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  segmentText: {
    fontSize: 15,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowText: {
    flex: 1,
  },
  signOutButton: {
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  signOutText: {
    fontSize: 16,
    fontWeight: '600',
  },
  bottomSpacer: {
    height: 40,
  },
});
