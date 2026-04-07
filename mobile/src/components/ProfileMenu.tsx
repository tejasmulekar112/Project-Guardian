import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Pressable,
  StyleSheet,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';

interface ProfileMenuProps {
  email: string;
  onContacts: () => void;
  onSettings: () => void;
  onSignOut: () => void;
}

export function ProfileMenu({ email, onContacts, onSettings, onSignOut }: ProfileMenuProps) {
  const { colors, toggleTheme, isDark } = useTheme();
  const [visible, setVisible] = useState(false);

  const initial = (email.charAt(0) ?? '?').toUpperCase();

  const menuItems = [
    {
      label: email,
      subtitle: 'Signed in',
      onPress: () => setVisible(false),
      isHeader: true,
    },
    {
      label: isDark ? 'Light Mode' : 'Dark Mode',
      icon: isDark ? '\u2600' : '\u263D',
      onPress: () => {
        toggleTheme();
        setVisible(false);
      },
    },
    {
      label: 'Contacts',
      icon: '\u260E',
      onPress: () => {
        setVisible(false);
        onContacts();
      },
    },
    {
      label: 'Settings',
      icon: '\u2699',
      onPress: () => {
        setVisible(false);
        onSettings();
      },
    },
    {
      label: 'Sign Out',
      icon: '\u2192',
      onPress: () => {
        setVisible(false);
        onSignOut();
      },
      danger: true,
    },
  ];

  return (
    <View>
      {/* Avatar button */}
      <TouchableOpacity
        style={[styles.avatar, { backgroundColor: '#DC2626' }]}
        onPress={() => setVisible(true)}
        activeOpacity={0.8}
      >
        <Text style={styles.avatarText}>{initial}</Text>
      </TouchableOpacity>

      {/* Dropdown modal */}
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => setVisible(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setVisible(false)}>
          <View style={[styles.menu, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {menuItems.map((item, i) => (
              <React.Fragment key={i}>
                {item.isHeader ? (
                  <View style={[styles.menuHeader, { borderBottomColor: colors.border }]}>
                    <View style={[styles.menuAvatar, { backgroundColor: '#DC2626' }]}>
                      <Text style={styles.menuAvatarText}>{initial}</Text>
                    </View>
                    <View style={styles.menuHeaderInfo}>
                      <Text style={[styles.menuEmail, { color: colors.text }]} numberOfLines={1}>
                        {item.label}
                      </Text>
                      <Text style={[styles.menuSubtitle, { color: colors.textSecondary }]}>
                        {item.subtitle}
                      </Text>
                    </View>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.menuItem}
                    onPress={item.onPress}
                    activeOpacity={0.6}
                  >
                    <Text style={[styles.menuIcon, { color: item.danger ? '#EF4444' : colors.textSecondary }]}>
                      {item.icon}
                    </Text>
                    <Text
                      style={[
                        styles.menuLabel,
                        { color: item.danger ? '#EF4444' : colors.text },
                      ]}
                    >
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                )}
              </React.Fragment>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 56,
    paddingRight: 16,
  },
  menu: {
    borderRadius: 12,
    borderWidth: 1,
    width: 260,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  menuHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  menuAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuAvatarText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  menuHeaderInfo: {
    marginLeft: 12,
    flex: 1,
  },
  menuEmail: {
    fontSize: 14,
    fontWeight: '600',
  },
  menuSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  menuIcon: {
    fontSize: 18,
    width: 28,
  },
  menuLabel: {
    fontSize: 15,
  },
});
