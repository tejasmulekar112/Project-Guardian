import type { SOSEvent } from '@guardian/shared-schemas';

function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function exportEventsToCSV(
  events: SOSEvent[],
  userEmails: Map<string, string>,
): void {
  const headers = ['Timestamp', 'User', 'Trigger Type', 'Status', 'Latitude', 'Longitude', 'Message'];
  const rows = events.map((e) => [
    new Date(e.createdAt).toLocaleString(),
    userEmails.get(e.userId) ?? e.userId,
    e.triggerType,
    e.status,
    e.location.latitude.toFixed(6),
    e.location.longitude.toFixed(6),
    e.message?.replace(/\n/g, ' ') ?? '',
  ]);

  const csv = [
    headers.map(escapeCsvField).join(','),
    ...rows.map((row) => row.map(escapeCsvField).join(',')),
  ].join('\n');

  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const date = new Date().toISOString().slice(0, 10);
  const a = document.createElement('a');
  a.href = url;
  a.download = `sos-events-${date}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
