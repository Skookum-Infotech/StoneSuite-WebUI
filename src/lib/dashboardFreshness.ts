// Formats the dashboard's "how current is this data" line shown in the console
// header. Takes React Query's `dataUpdatedAt` (epoch ms, or null before the
// first resolve) and whether any dashboard query is currently refetching.

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const JUST_NOW_MS = 10 * SECOND;

export function formatFreshness(
  updatedAt: number | null,
  isRefreshing: boolean,
  now: number = Date.now(),
): string {
  if (isRefreshing) return 'Updating…';
  if (updatedAt === null) return 'Not loaded';

  const age = Math.max(0, now - updatedAt);
  if (age < JUST_NOW_MS) return 'Updated just now';
  if (age < MINUTE) return `Updated ${Math.floor(age / SECOND)}s ago`;
  if (age < HOUR) return `Updated ${Math.floor(age / MINUTE)}m ago`;
  return `Updated ${Math.floor(age / HOUR)}h ago`;
}
