import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { SOSEvent } from '@guardian/shared-schemas';
import { StatusBadge } from './StatusBadge';
import { exportEventsToCSV } from '../lib/csv-export';
import { exportEventsToPDF } from '../lib/pdf-export';

interface EventsTableProps {
  events: SOSEvent[];
  userEmails: Map<string, string>;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

export function EventsTable({ events, userEmails }: EventsTableProps) {
  const navigate = useNavigate();
  const [filter, setFilter] = useState('');

  const filtered = filter
    ? events.filter((e) => {
        const email = userEmails.get(e.userId) ?? e.userId;
        return email.toLowerCase().includes(filter.toLowerCase());
      })
    : events;

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-white">SOS Events</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => exportEventsToPDF(filtered, userEmails)}
            className="px-3 py-1.5 bg-red-700 hover:bg-red-600 text-white text-sm rounded-md transition-colors"
          >
            Export PDF
          </button>
          <button
            onClick={() => exportEventsToCSV(filtered, userEmails)}
            className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-md transition-colors"
          >
            Export CSV
          </button>
          <input
            type="text"
            placeholder="Filter by email..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-3 py-1.5 bg-gray-700 border border-gray-600 rounded-md text-sm text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-gray-400 uppercase border-b border-gray-700">
            <tr>
              <th className="px-3 py-2">Timestamp</th>
              <th className="px-3 py-2">User</th>
              <th className="px-3 py-2">Trigger</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Location</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((event) => (
              <tr
                key={event.id}
                onClick={() => navigate(`/events/${event.id}`)}
                className="border-b border-gray-700 hover:bg-gray-700/50 cursor-pointer transition-colors"
              >
                <td className="px-3 py-2 text-gray-300 whitespace-nowrap">
                  {formatDate(event.createdAt)}
                </td>
                <td className="px-3 py-2 text-white">
                  {userEmails.get(event.userId) ?? event.userId}
                </td>
                <td className="px-3 py-2 text-gray-300">{event.triggerType}</td>
                <td className="px-3 py-2">
                  <StatusBadge status={event.status} />
                </td>
                <td className="px-3 py-2 text-gray-400 text-xs">
                  {event.location.latitude.toFixed(4)}, {event.location.longitude.toFixed(4)}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-center text-gray-400">
                  No events found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
