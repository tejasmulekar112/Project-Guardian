import { useCallback, useEffect, useState } from 'react';
import { readManifest } from '../services/evidenceStorage';
import { uploadEventEvidence, uploadAllPending } from '../services/evidenceUpload';
import type { EvidenceItem } from '@guardian/shared-schemas';

interface UseEvidenceUploadReturn {
  items: EvidenceItem[];
  uploadedCount: number;
  totalCount: number;
  isUploading: boolean;
  refresh: () => Promise<void>;
  retryAll: () => Promise<void>;
}

export function useEvidenceUpload(eventId: string | null): UseEvidenceUploadReturn {
  const [items, setItems] = useState<EvidenceItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const refresh = useCallback(async () => {
    if (!eventId) {
      setItems([]);
      return;
    }
    const manifest = await readManifest(eventId);
    setItems(manifest?.items ?? []);
  }, [eventId]);

  // Poll for status updates while uploading
  useEffect(() => {
    if (!eventId) return;

    void refresh();

    const interval = setInterval(() => {
      void refresh();
    }, 2000);

    return () => clearInterval(interval);
  }, [eventId, refresh]);

  // Resume pending uploads on mount
  useEffect(() => {
    void uploadAllPending();
  }, []);

  const retryAll = useCallback(async () => {
    if (!eventId) return;
    setIsUploading(true);
    try {
      await uploadEventEvidence(eventId);
    } finally {
      setIsUploading(false);
      await refresh();
    }
  }, [eventId, refresh]);

  const uploadedCount = items.filter((i) => i.uploadStatus === 'uploaded').length;
  const totalCount = items.length;

  return { items, uploadedCount, totalCount, isUploading, refresh, retryAll };
}
