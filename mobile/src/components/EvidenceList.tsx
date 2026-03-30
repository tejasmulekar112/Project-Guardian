import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, ActivityIndicator, Modal } from 'react-native';
import { Audio } from 'expo-av';
import type { EvidenceItem } from '@guardian/shared-schemas';

interface EvidenceListProps {
  items: EvidenceItem[];
  uploadedCount: number;
  totalCount: number;
  onRetry: () => void;
}

export const EvidenceList = ({ items, uploadedCount, totalCount, onRetry }: EvidenceListProps) => {
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const [previewUri, setPreviewUri] = useState<string | null>(null);

  const playAudio = async (uri: string) => {
    try {
      setPlayingAudio(uri);
      const { sound } = await Audio.Sound.createAsync({ uri });
      sound.setOnPlaybackStatusUpdate((status) => {
        if ('didJustFinish' in status && status.didJustFinish) {
          setPlayingAudio(null);
          void sound.unloadAsync();
        }
      });
      await sound.playAsync();
    } catch {
      setPlayingAudio(null);
    }
  };

  const renderStatusIcon = (item: EvidenceItem) => {
    switch (item.uploadStatus) {
      case 'uploading':
        return <ActivityIndicator size="small" color="#60A5FA" />;
      case 'uploaded':
        return <Text style={styles.checkmark}>✓</Text>;
      case 'failed':
        return (
          <TouchableOpacity onPress={onRetry}>
            <Text style={styles.retryIcon}>↻</Text>
          </TouchableOpacity>
        );
      default:
        return <Text style={styles.pendingIcon}>⏳</Text>;
    }
  };

  const renderTypeIcon = (item: EvidenceItem) => {
    switch (item.type) {
      case 'audio':
        return '🎵';
      case 'video':
        return '🎬';
      case 'photo':
        return '📷';
    }
  };

  const handleItemPress = (item: EvidenceItem) => {
    if (item.type === 'audio') {
      void playAudio(item.localUri);
    } else {
      setPreviewUri(item.localUri);
    }
  };

  const hasFailed = items.some((i) => i.uploadStatus === 'failed');

  return (
    <View style={styles.container}>
      <View style={styles.summaryRow}>
        <Text style={styles.summaryText}>
          {totalCount === 0
            ? 'No evidence yet'
            : uploadedCount === totalCount
              ? 'All evidence uploaded'
              : `${uploadedCount}/${totalCount} files uploaded`}
        </Text>
        {hasFailed && (
          <TouchableOpacity onPress={onRetry}>
            <Text style={styles.retryAllText}>Retry All</Text>
          </TouchableOpacity>
        )}
      </View>

      {items.map((item) => (
        <TouchableOpacity
          key={item.filename}
          style={styles.itemRow}
          onPress={() => handleItemPress(item)}
        >
          <Text style={styles.typeIcon}>{renderTypeIcon(item)}</Text>
          <View style={styles.itemInfo}>
            <Text style={styles.itemFilename}>{item.filename}</Text>
            <Text style={styles.itemTime}>
              {new Date(item.createdAt).toLocaleTimeString()}
            </Text>
          </View>
          {playingAudio === item.localUri ? (
            <Text style={styles.playingText}>Playing...</Text>
          ) : (
            renderStatusIcon(item)
          )}
        </TouchableOpacity>
      ))}

      {/* Fullscreen preview modal for photos/videos */}
      <Modal visible={!!previewUri} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          onPress={() => setPreviewUri(null)}
          activeOpacity={1}
        >
          {previewUri && (
            <Image
              source={{ uri: previewUri }}
              style={styles.previewImage}
              resizeMode="contain"
            />
          )}
          <Text style={styles.closeText}>Tap to close</Text>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryText: {
    color: '#9CA3AF',
    fontSize: 14,
  },
  retryAllText: {
    color: '#60A5FA',
    fontSize: 14,
    fontWeight: '600',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F2937',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    gap: 12,
  },
  typeIcon: {
    fontSize: 20,
  },
  itemInfo: {
    flex: 1,
  },
  itemFilename: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  itemTime: {
    color: '#6B7280',
    fontSize: 12,
    marginTop: 2,
  },
  checkmark: {
    color: '#34D399',
    fontSize: 18,
    fontWeight: 'bold',
  },
  retryIcon: {
    color: '#EF4444',
    fontSize: 20,
    fontWeight: 'bold',
  },
  pendingIcon: {
    fontSize: 16,
  },
  playingText: {
    color: '#60A5FA',
    fontSize: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewImage: {
    width: '90%',
    height: '70%',
  },
  closeText: {
    color: '#9CA3AF',
    fontSize: 16,
    marginTop: 24,
  },
});
