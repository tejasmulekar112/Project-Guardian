import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { getFirestore } from 'firebase/firestore';
import * as FileSystem from 'expo-file-system';
import { storage, firebaseApp } from './firebase';
import { updateItemStatus, getAllPendingManifests, readManifest } from './evidenceStorage';
import type { EvidenceItem } from '@guardian/shared-schemas';

const db = getFirestore(firebaseApp);

export async function uploadEvidenceFile(
  userId: string,
  eventId: string,
  item: EvidenceItem,
): Promise<string> {
  await updateItemStatus(eventId, item.filename, 'uploading');

  try {
    const storagePath = `evidence/${userId}/${eventId}/${item.filename}`;
    const storageRef = ref(storage, storagePath);

    // Read local file as base64, convert to blob
    const base64 = await FileSystem.readAsStringAsync(item.localUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const response = await fetch(`data:application/octet-stream;base64,${base64}`);
    const blob = await response.blob();

    // Upload with resumable upload
    await new Promise<void>((resolve, reject) => {
      const task = uploadBytesResumable(storageRef, blob);
      task.on(
        'state_changed',
        null,
        (error) => reject(error),
        () => resolve(),
      );
    });

    const downloadUrl = await getDownloadURL(storageRef);

    // Update local manifest
    await updateItemStatus(eventId, item.filename, 'uploaded', downloadUrl);

    // Write metadata to Firestore
    const eventRef = doc(db, 'sos_events', eventId);
    await updateDoc(eventRef, {
      evidence: arrayUnion({
        type: item.type,
        url: downloadUrl,
        filename: item.filename,
        createdAt: item.createdAt,
      }),
    });

    return downloadUrl;
  } catch (error) {
    await updateItemStatus(eventId, item.filename, 'failed');
    throw error;
  }
}

export async function uploadAllPending(): Promise<void> {
  const manifests = await getAllPendingManifests();

  for (const manifest of manifests) {
    const pendingItems = manifest.items.filter(
      (i) => i.uploadStatus === 'pending' || i.uploadStatus === 'failed',
    );

    for (const item of pendingItems) {
      try {
        await uploadEvidenceFile(manifest.userId, manifest.eventId, item);
      } catch {
        // Continue with next item — already marked as failed
      }
    }
  }
}

export async function uploadEventEvidence(eventId: string): Promise<void> {
  const manifest = await readManifest(eventId);
  if (!manifest) return;

  const pendingItems = manifest.items.filter(
    (i) => i.uploadStatus === 'pending' || i.uploadStatus === 'failed',
  );

  for (const item of pendingItems) {
    try {
      await uploadEvidenceFile(manifest.userId, manifest.eventId, item);
    } catch {
      // Continue with next item
    }
  }
}
