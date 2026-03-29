import * as FileSystem from 'expo-file-system';
import type { EvidenceItem, EvidenceManifest, EvidenceType, EvidenceUploadStatus } from '@guardian/shared-schemas';

const EVIDENCE_DIR = `${FileSystem.documentDirectory}evidence/`;

function eventDir(eventId: string): string {
  return `${EVIDENCE_DIR}${eventId}/`;
}

function manifestPath(eventId: string): string {
  return `${eventDir(eventId)}manifest.json`;
}

export async function ensureEventDir(eventId: string): Promise<string> {
  const dir = eventDir(eventId);
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
  return dir;
}

export async function readManifest(eventId: string): Promise<EvidenceManifest | null> {
  const path = manifestPath(eventId);
  const info = await FileSystem.getInfoAsync(path);
  if (!info.exists) return null;
  const content = await FileSystem.readAsStringAsync(path);
  return JSON.parse(content) as EvidenceManifest;
}

export async function writeManifest(manifest: EvidenceManifest): Promise<void> {
  await ensureEventDir(manifest.eventId);
  const path = manifestPath(manifest.eventId);
  await FileSystem.writeAsStringAsync(path, JSON.stringify(manifest));
}

export async function addEvidenceItem(
  eventId: string,
  userId: string,
  type: EvidenceType,
  sourceUri: string,
): Promise<EvidenceItem> {
  const dir = await ensureEventDir(eventId);
  const timestamp = Date.now();
  const ext = type === 'audio' ? 'm4a' : type === 'video' ? 'mp4' : 'jpg';
  const filename = `${type}-${timestamp}.${ext}`;
  const destUri = `${dir}${filename}`;

  await FileSystem.copyAsync({ from: sourceUri, to: destUri });

  const item: EvidenceItem = {
    type,
    filename,
    localUri: destUri,
    uploadStatus: 'pending',
    createdAt: timestamp,
  };

  // Update manifest
  let manifest = await readManifest(eventId);
  if (!manifest) {
    manifest = { eventId, userId, items: [] };
  }
  manifest.items.push(item);
  await writeManifest(manifest);

  return item;
}

export async function updateItemStatus(
  eventId: string,
  filename: string,
  status: EvidenceUploadStatus,
  url?: string,
): Promise<void> {
  const manifest = await readManifest(eventId);
  if (!manifest) return;

  const item = manifest.items.find((i) => i.filename === filename);
  if (!item) return;

  item.uploadStatus = status;
  if (url) item.url = url;

  await writeManifest(manifest);
}

export async function getAllPendingManifests(): Promise<EvidenceManifest[]> {
  const info = await FileSystem.getInfoAsync(EVIDENCE_DIR);
  if (!info.exists) return [];

  const dirs = await FileSystem.readDirectoryAsync(EVIDENCE_DIR);
  const manifests: EvidenceManifest[] = [];

  for (const dir of dirs) {
    const manifest = await readManifest(dir);
    if (manifest) {
      const hasPending = manifest.items.some(
        (i) => i.uploadStatus === 'pending' || i.uploadStatus === 'failed',
      );
      if (hasPending) manifests.push(manifest);
    }
  }

  return manifests;
}
