import {
  UNIT_KIND_REMNANT,
  UNIT_STATUS_AVAILABLE,
  UNIT_STATUS_CONSUMED,
  UNIT_STATUS_IN_TRANSIT,
  UNIT_STATUS_RESERVED,
  UNIT_STATUS_SCRAPPED,
} from '@/types/inventory';
import type { InventoryUnit, UnitUsage } from '@/types/inventory';
import { unitLabel } from '@/lib/unitLabels';

// How a slab or remnant has been used up, for the Inventory list and detail.
//
// A unit is never partly used: it is cut whole. Its area leaves stock in full,
// the offcuts kept come back as new units (`recoveredArea`), and whatever did not
// come back (`usedArea`) went into finished product and saw kerf. So "how much of
// this has been consumed" is one of five states, and only a consumed unit has a
// used / recovered split to draw.

const PERCENT = 100;
const AREA_DECIMALS = 2;

export const EMPTY_USAGE: UnitUsage = { offcutCount: 0, recoveredArea: 0, usedArea: 0 };

/** A unit's usage, or an all-zero one if the API did not send it. */
export function usageOf(unit: Pick<InventoryUnit, 'usage'>): UnitUsage {
  return unit.usage ?? EMPTY_USAGE;
}

/** "45.21 sq ft" — an area with what it is measured in. Just the number when the
 *  unit is unknown, never a bare quantity next to a wrong unit. */
export function formatUnitArea(value: number, unitCode?: string): string {
  const number = value.toFixed(AREA_DECIMALS);
  const unit = unitLabel(unitCode).toLowerCase();
  return unit ? `${number} ${unit}` : number;
}

function percentOf(part: number, whole: number): number {
  return whole > 0 ? (part / whole) * PERCENT : 0;
}

// ── Bars ─────────────────────────────────────────────────────────────────────

export type BarTone = 'stock' | 'reserved' | 'transit' | 'used' | 'recovered' | 'scrapped';

// Full class strings, so Tailwind can see them.
export const BAR_TONE_CLASS: Record<BarTone, string> = {
  stock: 'bg-emerald-500',
  reserved: 'bg-amber-400',
  transit: 'bg-indigo-400',
  used: 'bg-slate-500',
  recovered: 'bg-teal-400',
  scrapped: 'bg-red-400',
};

export interface BarSegment {
  tone: BarTone;
  label: string;
  area: number;
  /** Share of the bar's whole, 0–100 (not rounded — it sets a width). */
  pct: number;
}

function whole(unit: InventoryUnit, tone: BarTone, label: string): BarSegment[] {
  return [{ tone, label, area: unit.area, pct: PERCENT }];
}

/** The segments of one unit's own bar: the unit is one colour unless it has been
 *  cut, in which case it is split into what was used and what came back. */
export function unitSegments(unit: InventoryUnit): BarSegment[] {
  switch (unit.status) {
    case UNIT_STATUS_CONSUMED: {
      const { usedArea, recoveredArea } = usageOf(unit);
      const parts: BarSegment[] = [];
      if (usedArea > 0) parts.push({ tone: 'used', label: 'Used', area: usedArea, pct: percentOf(usedArea, unit.area) });
      if (recoveredArea > 0) {
        parts.push({ tone: 'recovered', label: 'Back as offcuts', area: recoveredArea, pct: percentOf(recoveredArea, unit.area) });
      }
      // Consumed with nothing accounted for either way — an older record. The
      // stone did leave stock, so it reads as used rather than as an empty bar.
      return parts.length > 0 ? parts : whole(unit, 'used', 'Used');
    }
    case UNIT_STATUS_RESERVED:
      return whole(unit, 'reserved', 'Reserved');
    case UNIT_STATUS_IN_TRANSIT:
      return whole(unit, 'transit', 'In transit');
    case UNIT_STATUS_SCRAPPED:
      return whole(unit, 'scrapped', 'Scrapped');
    default:
      return whole(unit, 'stock', 'In stock');
  }
}

// ── One unit, in words ───────────────────────────────────────────────────────

const STATE_LABEL: Record<string, string> = {
  [UNIT_STATUS_AVAILABLE]: 'Untouched',
  [UNIT_STATUS_RESERVED]: 'Held for a job',
  [UNIT_STATUS_IN_TRANSIT]: 'In transit',
  [UNIT_STATUS_CONSUMED]: 'Cut',
  [UNIT_STATUS_SCRAPPED]: 'Scrapped',
};

/** The unit's consumption state as a short label ("Untouched", "Cut"…). */
export function consumptionState(unit: Pick<InventoryUnit, 'status'>): string {
  return STATE_LABEL[unit.status] ?? unit.status;
}

/** Whole-number share of a consumed unit that was used (0 for any other unit). */
export function usedPercent(unit: InventoryUnit): number {
  if (unit.status !== UNIT_STATUS_CONSUMED) return 0;
  const { usedArea, recoveredArea } = usageOf(unit);
  // Nothing accounted for either way reads as fully used, matching the bar.
  if (usedArea <= 0 && recoveredArea <= 0) return PERCENT;
  return Math.round(percentOf(usedArea, unit.area));
}

function offcutsPhrase(count: number): string {
  return `${count} ${count === 1 ? 'offcut' : 'offcuts'}`;
}

/** The one line under a list row's bar. */
export function consumptionLine(unit: InventoryUnit): string {
  const use = usageOf(unit);
  switch (unit.status) {
    case UNIT_STATUS_CONSUMED:
      return use.recoveredArea > 0
        ? `${usedPercent(unit)}% used · ${formatUnitArea(use.recoveredArea, unit.areaUnitCode)} back`
        : 'Fully used';
    case UNIT_STATUS_RESERVED:
      return use.jobNumber ? `Held for ${use.jobNumber}` : 'Held for a job';
    case UNIT_STATUS_AVAILABLE:
      if (unit.kind === UNIT_KIND_REMNANT && unit.parentSerial) return `Offcut of ${unit.parentSerial}`;
      return 'Untouched';
    default:
      return consumptionState(unit);
  }
}

/** A full sentence for the row's tooltip and screen readers. */
export function consumptionSentence(unit: InventoryUnit): string {
  const use = usageOf(unit);
  const area = (v: number) => formatUnitArea(v, unit.areaUnitCode);
  if (unit.status === UNIT_STATUS_CONSUMED) {
    const used = `${area(use.usedArea)} used in product and saw kerf`;
    return use.offcutCount > 0
      ? `Cut: ${used}; ${area(use.recoveredArea)} came back as ${offcutsPhrase(use.offcutCount)}.`
      : `Cut: all ${area(unit.area)} used in product and saw kerf; nothing came back.`;
  }
  if (unit.status === UNIT_STATUS_RESERVED) {
    return use.jobNumber ? `Whole slab, ${area(unit.area)}, held for job ${use.jobNumber}.` : `Whole slab, ${area(unit.area)}, held for a job.`;
  }
  if (unit.status === UNIT_STATUS_SCRAPPED) return `Scrapped: ${area(unit.area)} written off.`;
  if (unit.status === UNIT_STATUS_IN_TRANSIT) return `${area(unit.area)} in transit between warehouses.`;
  return `Untouched: ${area(unit.area)} still whole.`;
}

// ── The detail page ──────────────────────────────────────────────────────────

/** How much of a consumed unit was used. The API always sends it; if it did not,
 *  a consumed unit with nothing accounted for either way reads as wholly used,
 *  matching its bar. */
function usedAreaOf(unit: InventoryUnit): number {
  const { usedArea, recoveredArea } = usageOf(unit);
  return usedArea > 0 || recoveredArea > 0 ? usedArea : unit.area;
}

/** The big word at the top of a unit's usage: how used-up it is. */
export function usageHeadline(unit: InventoryUnit): string {
  if (unit.status !== UNIT_STATUS_CONSUMED) return consumptionState(unit);
  const pct = usedPercent(unit);
  return pct >= PERCENT ? 'Fully used' : `${pct}% used`;
}

export interface UsageTile {
  label: string;
  value: string;
  note?: string;
  /** Matches the bar's colour for this part, when it is a part of the bar. */
  tone?: BarTone;
}

/** The few numbers that answer "how much of this piece is gone". */
export function usageTiles(unit: InventoryUnit): UsageTile[] {
  const use = usageOf(unit);
  const area = (v: number) => formatUnitArea(v, unit.areaUnitCode);
  if (unit.status === UNIT_STATUS_CONSUMED) {
    return [
      { label: 'Size before cutting', value: area(unit.area) },
      { label: 'Used', value: area(usedAreaOf(unit)), note: 'Finished product and saw kerf', tone: 'used' },
      use.offcutCount > 0
        ? { label: 'Back as offcuts', value: area(use.recoveredArea), note: offcutsPhrase(use.offcutCount), tone: 'recovered' }
        : { label: 'Back as offcuts', value: 'None', note: 'Nothing was kept from the cut' },
    ];
  }
  return [{
    label: unit.kind === UNIT_KIND_REMNANT ? 'Offcut size' : 'Slab size',
    value: area(unit.area),
    note: unit.status === UNIT_STATUS_AVAILABLE ? 'Still whole' : undefined,
    tone: unitSegments(unit)[0].tone,
  }];
}

export interface LifecycleLink {
  label: string;
  to: string;
}

export interface LifecycleStep {
  key: 'arrived' | 'reserved' | 'cut' | 'scrapped' | 'stock' | 'transit';
  title: string;
  /** A record this step points at (the receipt, the job, the parent slab). */
  link?: LifecycleLink;
  detail?: string;
  at?: string | null;
  /** The last step — where the unit is now. */
  current: boolean;
}

/** A unit's life so far, oldest first: how it arrived, whether a job took it,
 *  what became of it — ending at where it is now. Built from what the unit
 *  already carries, so it needs no extra request. */
export function lifecycleSteps(unit: InventoryUnit): LifecycleStep[] {
  const use = usageOf(unit);
  const area = (v: number) => formatUnitArea(v, unit.areaUnitCode);
  const steps: Omit<LifecycleStep, 'current'>[] = [];

  if (unit.parentUnitId) {
    steps.push({
      key: 'arrived',
      title: 'Cut from',
      link: { label: unit.parentSerial || 'the original slab', to: `/inventory/unit/${unit.parentUnitId}` },
      at: unit.createdAt,
    });
  } else if (unit.receiptId) {
    steps.push({
      key: 'arrived',
      title: 'Received on',
      link: { label: unit.receiptNumber || 'item receipt', to: `/purchases/item_receipt/${unit.receiptId}` },
      at: unit.createdAt,
    });
  } else {
    steps.push({ key: 'arrived', title: 'Added to inventory', at: unit.createdAt });
  }

  if (use.reservedAt || unit.status === UNIT_STATUS_RESERVED) {
    steps.push({
      key: 'reserved',
      title: use.jobId ? 'Held for job' : 'Held for a job',
      link: use.jobId ? { label: use.jobNumber || 'fabrication job', to: `/sales/installation/${use.jobId}` } : undefined,
      at: use.reservedAt,
    });
  }

  switch (unit.status) {
    case UNIT_STATUS_CONSUMED:
      steps.push({
        key: 'cut',
        title: 'Cut',
        detail: use.offcutCount > 0
          ? `${area(usedAreaOf(unit))} used · ${area(use.recoveredArea)} came back as ${offcutsPhrase(use.offcutCount)}`
          : `All ${area(unit.area)} used`,
        at: use.consumedAt,
      });
      break;
    case UNIT_STATUS_SCRAPPED:
      steps.push({ key: 'scrapped', title: 'Scrapped', detail: `${area(unit.area)} written off`, at: use.scrappedAt });
      break;
    case UNIT_STATUS_IN_TRANSIT:
      steps.push({ key: 'transit', title: 'In transit', detail: 'Between warehouses' });
      break;
    case UNIT_STATUS_AVAILABLE:
      steps.push({
        key: 'stock',
        title: 'In stock',
        detail: [unit.warehouseName, unit.binPath].filter(Boolean).join(' · ') || undefined,
      });
      break;
    default:
      break; // reserved: the "Held for job" step above is where it is now
  }

  return steps.map((step, i) => ({ ...step, current: i === steps.length - 1 }));
}
