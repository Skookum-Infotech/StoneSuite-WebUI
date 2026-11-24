import type { DigestPrefs } from '@/types/automationDigest';

/** First and last tenant-local hour a digest may be sent at (the 08:00-18:00 send window). */
export const DIGEST_FIRST_HOUR = 8;
export const DIGEST_LAST_HOUR = 17;

export const DIGEST_HOURS: number[] = Array.from(
  { length: DIGEST_LAST_HOUR - DIGEST_FIRST_HOUR + 1 },
  (_, i) => DIGEST_FIRST_HOUR + i,
);

/** "8:00 AM" / "1:00 PM" for a 24-hour clock hour. */
export function digestHourLabel(hour: number): string {
  const suffix = hour < 12 ? 'AM' : 'PM';
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${h}:00 ${suffix}`;
}

/** Whether the digest has at least one section to send: a digest that is on needs one. */
export function hasDigestSection(p: DigestPrefs): boolean {
  return p.includeInstalls || p.includeVendorBills || p.includeApprovals;
}

/** Whether two preference sets are identical (to know when Save has anything to do). */
export function sameDigestPrefs(a: DigestPrefs, b: DigestPrefs): boolean {
  return (
    a.enabled === b.enabled &&
    a.sendHour === b.sendHour &&
    a.includeInstalls === b.includeInstalls &&
    a.includeVendorBills === b.includeVendorBills &&
    a.includeApprovals === b.includeApprovals &&
    a.skipEmpty === b.skipEmpty
  );
}
