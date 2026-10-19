import type { BinHistoryEntry } from '@/types/inventory';

// How a bin's movement history reads on screen. The server sends the raw unit
// action (bin_move, create, cut, …) and whether the unit arrived in the bin or
// left it; this turns the pair into the words a yard crew would use.

const IN_LABELS: Record<string, string> = {
  bin_move: 'Moved in',
  create: 'Received',
  remnant_created: 'Offcut added',
  warehouse_move: 'Arrived from another location',
};

const OUT_LABELS: Record<string, string> = {
  bin_move: 'Moved out',
  cut: 'Cut',
  scrap: 'Scrapped',
  warehouse_move: 'Sent to another location',
};

function humanise(action: string): string {
  const spaced = action.replace(/_/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function binEventLabel(e: BinHistoryEntry): string {
  const table = e.direction === 'in' ? IN_LABELS : e.direction === 'out' ? OUT_LABELS : null;
  return table?.[e.action] ?? humanise(e.action);
}

export type BinEventTone = 'in' | 'out' | 'loss' | 'neutral';

/** Arrivals and departures read as such; a scrap is a loss; a cut is just an
 *  event in the slab's life. */
export function binEventTone(e: BinHistoryEntry): BinEventTone {
  if (e.action === 'scrap') return 'loss';
  if (e.action === 'cut') return 'neutral';
  if (e.direction === 'in') return 'in';
  if (e.direction === 'out') return 'out';
  return 'neutral';
}

/** "from YARD/A1" / "to RACK/B2" for a move; empty for events that are not one. */
export function binEventCounterpart(e: BinHistoryEntry): string {
  if (e.action !== 'bin_move') return '';
  if (e.direction === 'in') return `from ${e.fromBinPath || 'no bin'}`;
  if (e.direction === 'out') return `to ${e.toBinPath || 'no bin'}`;
  return '';
}
