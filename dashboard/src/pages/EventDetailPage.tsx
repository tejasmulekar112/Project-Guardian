import { useParams, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import { NavLayout } from '../components/NavLayout';
import { StatusBadge } from '../components/StatusBadge';
import { EvidencePlayer } from '../components/EvidencePlayer';
import { EventMap } from '../components/EventMap';
import { updateEventStatus } from '../lib/firestore';
import type { SOSStatus, TriggerType, GeoLocation } from '@guardian/shared-schemas';

interface EventDetail {
  id: string;
  userId: string;
  location: GeoLocation;
  triggerType: TriggerType;
  status: SOSStatus;
  message?: string;
  createdAt: number;
  evidence?: Array<{
    type: string;
    url: string;
    filename: string;
    createdAt: number;
  }>;
}

export function EventDetailPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  useEffect(() => {
    if (!eventId) return;
    const unsubscribe = onSnapshot(doc(db, 'sos_events', eventId), (snapshot) => {
      if (snapshot.exists()) {
        const d = snapshot.data();
        setEvent({
          id: snapshot.id,
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
          evidence: d.evidence,
        } as EventDetail);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, [eventId]);

  const handleStatusChange = async (newStatus: SOSStatus) => {
    if (!eventId) return;
    if (!window.confirm(`Change status to "${newStatus}"?`)) return;
    setUpdating(true);
    setStatusError(null);
    try {
      await updateEventStatus(eventId, newStatus);
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : 'Failed to update status');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <NavLayout>
        <p className="text-gray-400">Loading event...</p>
      </NavLayout>
    );
  }

  if (!event) {
    return (
      <NavLayout>
        <p className="text-gray-400">Event not found.</p>
        <Link to="/" className="text-blue-400 hover:underline text-sm">
          Back to dashboard
        </Link>
      </NavLayout>
    );
  }

  return (
    <NavLayout>
      <div className="space-y-6">
        <Link to="/" className="text-blue-400 hover:underline text-sm">
          &larr; Back to dashboard
        </Link>

        <div className="bg-gray-800 rounded-lg p-6">
          <h1 className="text-xl font-bold text-white mb-4">Event Details</h1>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <dt className="text-sm text-gray-400">Event ID</dt>
              <dd className="text-white font-mono text-sm">{event.id}</dd>
            </div>
            <div>
              <dt className="text-sm text-gray-400">Timestamp</dt>
              <dd className="text-white">{new Date(event.createdAt).toLocaleString()}</dd>
            </div>
            <div>
              <dt className="text-sm text-gray-400">User ID</dt>
              <dd className="text-white font-mono text-sm">{event.userId}</dd>
            </div>
            <div>
              <dt className="text-sm text-gray-400">Trigger Type</dt>
              <dd className="text-white">{event.triggerType}</dd>
            </div>
            <div>
              <dt className="text-sm text-gray-400">Status</dt>
              <dd><StatusBadge status={event.status} /></dd>
            </div>
            <div>
              <dt className="text-sm text-gray-400">Location</dt>
              <dd className="text-white">
                {event.location.latitude.toFixed(6)}, {event.location.longitude.toFixed(6)}
              </dd>
            </div>
            {event.message && (
              <div className="sm:col-span-2">
                <dt className="text-sm text-gray-400">Message</dt>
                <dd className="text-white">{event.message}</dd>
              </div>
            )}
          </dl>
        </div>

        {event.status !== 'resolved' && (
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Actions</h2>
            <div className="flex gap-3">
              {(event.status === 'triggered' || event.status === 'dispatched') && (
                <button
                  onClick={() => handleStatusChange('acknowledged')}
                  disabled={updating}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-md transition-colors"
                >
                  {updating ? 'Updating...' : 'Acknowledge'}
                </button>
              )}
              <button
                onClick={() => handleStatusChange('resolved')}
                disabled={updating}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-medium rounded-md transition-colors"
              >
                {updating ? 'Updating...' : 'Resolve'}
              </button>
            </div>
            {statusError && (
              <p className="text-red-400 text-sm mt-2">{statusError}</p>
            )}
          </div>
        )}

        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Location</h2>
          <EventMap
            latitude={event.location.latitude}
            longitude={event.location.longitude}
          />
        </div>

        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Evidence</h2>
          <EvidencePlayer evidence={event.evidence ?? []} />
        </div>
      </div>
    </NavLayout>
  );
}
