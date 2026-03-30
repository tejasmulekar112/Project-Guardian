import type { SOSStatus } from '@guardian/shared-schemas';

const STATUS_STYLES: Record<SOSStatus, string> = {
  triggered: 'bg-red-500/20 text-red-400',
  dispatched: 'bg-yellow-500/20 text-yellow-400',
  acknowledged: 'bg-blue-500/20 text-blue-400',
  resolved: 'bg-green-500/20 text-green-400',
};

export function StatusBadge({ status }: { status: SOSStatus }) {
  return (
    <span
      className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[status]}`}
    >
      {status}
    </span>
  );
}
