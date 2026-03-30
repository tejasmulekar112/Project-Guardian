import type { SOSEvent } from '@guardian/shared-schemas';
import { StatusBadge } from './StatusBadge';

interface ActivityFeedProps {
  events: SOSEvent[];
  userEmails: Map<string, string>;
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ActivityFeed({ events, userEmails }: ActivityFeedProps) {
  const recent = events.slice(0, 10);

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h2 className="text-lg font-semibold text-white mb-3">Recent Activity</h2>
      {recent.length === 0 ? (
        <p className="text-gray-400 text-sm">No events yet.</p>
      ) : (
        <ul className="space-y-2">
          {recent.map((event) => (
            <li
              key={event.id}
              className="flex items-center justify-between py-2 border-b border-gray-700 last:border-0"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm text-white truncate">
                  {userEmails.get(event.userId) ?? event.userId}
                </p>
                <p className="text-xs text-gray-400">
                  {event.triggerType} &middot; {formatTime(event.createdAt)}
                </p>
              </div>
              <StatusBadge status={event.status} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
