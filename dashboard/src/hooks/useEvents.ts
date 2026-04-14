import { useState, useEffect } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../config/firebase';
import type { SOSEvent } from '@guardian/shared-schemas';

export function useEvents() {
  const [events, setEvents] = useState<SOSEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'sos_events'), orderBy('created_at', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => {
          const d = doc.data();
          return {
            id: doc.id,
            userId: d.user_id,
            location: {
              latitude: d.latitude,
              longitude: d.longitude,
              accuracyMeters: d.accuracy_meters,
            },
            triggerType: d.trigger_type,
            status: d.status,
            message: d.message,
            createdAt: d.created_at,
            updatedAt: d.updated_at,
            evidence: d.evidence,
          };
        }) as SOSEvent[];
        setEvents(data);
        setLoading(false);
      },
      (error) => {
        console.error('Events subscription error:', error);
        setLoading(false);
      },
    );
    return unsubscribe;
  }, []);

  return { events, loading };
}
