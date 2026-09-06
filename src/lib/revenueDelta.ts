// Pure helper for the Top customers dashboard widget (TopCustomers).
// Mirrors KpiStrip's existing 3-tone delta convention (▲/▼ arrow + up/warn/
// neutral) rather than inventing a separate red/green scheme -- see
// KpiStrip.tsx's formatDelta.

export type RevenueDeltaTone = 'up' | 'warn' | 'neutral';

/**
 * Formats a customer's period-over-period billed-revenue change. Returns
 * null when priorValue is null -- the selected range has no applicable
 * prior period ("all" time) -- so the caller renders no indicator at all,
 * rather than a misleading one. A zero priorValue with a positive current
 * value reads as "new" (the customer billed nothing last period, not
 * missing data -- see dashboardData.ts's TopCustomer).
 */
export function formatRevenueDelta(value: number, priorValue: number | null): { text: string; tone: RevenueDeltaTone } | null {
  if (priorValue === null) return null;
  if (priorValue === 0) {
    return value > 0 ? { text: 'new', tone: 'up' } : { text: '—', tone: 'neutral' };
  }
  const pct = Math.round(((value - priorValue) / priorValue) * 100);
  if (pct > 0) return { text: `▲ ${pct}%`, tone: 'up' };
  if (pct < 0) return { text: `▼ ${Math.abs(pct)}%`, tone: 'warn' };
  return { text: '—', tone: 'neutral' };
}
