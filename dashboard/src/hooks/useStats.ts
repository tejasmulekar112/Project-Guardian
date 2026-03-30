import { useMemo } from 'react';
import type { SOSEvent } from '@guardian/shared-schemas';

interface Stats {
  totalEvents: number;
  activeEvents: number;
  eventsToday: number;
  totalUsers: number;
}

export function useStats(events: SOSEvent[], userCount: number): Stats {
  return useMemo(() => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    return {
      totalEvents: events.length,
      activeEvents: events.filter(
        (e) => e.status === 'triggered' || e.status === 'dispatched',
      ).length,
      eventsToday: events.filter((e) => e.createdAt >= startOfDay).length,
      totalUsers: userCount,
    };
  }, [events, userCount]);
}
