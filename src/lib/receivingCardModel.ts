import type { ItemReceipt } from '@/types/itemReceipt';
import type { PurchaseOrder, PurchaseOrderLine } from '@/types/purchaseOrder';
import { formatDateValue, LIST_DATE_OPTIONS } from '@/lib/dateUtils';
import { slabProgressText } from '@/lib/itemReceiptSlabs';
import { unitLabel } from '@/lib/unitLabels';
import {
  billedPercent, formatQuantity, isOverdue, lineCounts, linePercent, receivedPercent, toWholePercent,
} from '@/lib/receivingProgress';

// What the receiving progress card shows, built from API data by pure
// functions so the wording and numbers are testable without rendering.

/** One bar in the card's right-hand box. `valueLabel` replaces the % beside it. */
export interface ReceivingCardRow {
  label: string;
  percent: number;
  valueLabel?: string;
}

/** One line of the order, in the card's breakdown list. */
export interface ReceivingBreakdownRow {
  id: string;
  name: string;
  detail: string;
  percent: number;
}

export interface ReceivingCardModel {
  title: string;
  subtitle: string;
  percent: number;
  /** Small print under the big %. */
  caption: string[];
  /** Pill text; absent unless goods are late. */
  overdue?: string;
  rows: ReceivingCardRow[];
  breakdown: ReceivingBreakdownRow[];
}

export type OrderCardSource = Pick<
  PurchaseOrder,
  'purchaseOrderNumber' | 'statusCode' | 'vendor' | 'expectedDate' | 'items'
>;

export type ReceiptDates = Pick<ItemReceipt, 'receiptDate' | 'postedAt' | 'voidedAt'>;

export interface ReceiptsSummary {
  count: number;
  /** Receipt date of the latest live receipt, yyyy-mm-dd. */
  lastReceivedOn?: string;
}

function fmtDate(iso: string): string {
  return formatDateValue(iso, undefined, LIST_DATE_OPTIONS);
}

function plural(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? '' : 's'}`;
}

export function lineName(line: Pick<PurchaseOrderLine, 'itemName' | 'description' | 'sku' | 'lineNumber'>): string {
  return line.itemName || line.description || line.sku || `Line ${line.lineNumber}`;
}

/** Receipts that actually brought goods in: posted and not voided. A draft
 *  receipt has not moved the order's received quantity yet. */
export function summarizeReceipts(receipts: readonly ReceiptDates[]): ReceiptsSummary {
  const live = receipts.filter((r) => r.postedAt && !r.voidedAt);
  const lastReceivedOn = live.reduce<string | undefined>(
    (latest, r) => (r.receiptDate && (!latest || r.receiptDate > latest) ? r.receiptDate : latest),
    undefined,
  );
  return { count: live.length, lastReceivedOn };
}

function receiptsCaption(summary: ReceiptsSummary): string {
  if (summary.count === 0) return 'No receipts posted yet';
  const last = summary.lastReceivedOn ? ` · last received ${fmtDate(summary.lastReceivedOn)}` : '';
  return `${plural(summary.count, 'receipt')}${last}`;
}

/** The whole-order card: opened from a list row's bar. `receipts` is
 *  undefined while unknown (still loading, or failed to load); the card then
 *  leaves the receipts line out rather than claiming there are none. */
export function buildOrderCardModel(
  order: OrderCardSource,
  receipts: readonly ReceiptDates[] | undefined,
  today: string,
): ReceivingCardModel {
  const lines = order.items;
  const percent = receivedPercent(lines);
  const counts = lineCounts(lines);
  const caption = counts.total === 0
    ? ['No lines with a quantity yet']
    : [`${counts.received} of ${plural(counts.total, 'line')} fully received`];
  if (counts.total > 0 && receipts) caption.push(receiptsCaption(summarizeReceipts(receipts)));
  const overdue = order.expectedDate && isOverdue(order, percent, today)
    ? `Overdue · expected ${fmtDate(order.expectedDate)}`
    : undefined;

  return {
    title: `${order.purchaseOrderNumber} receiving`,
    subtitle: order.vendor.name,
    percent,
    caption,
    overdue,
    rows: [
      {
        label: 'Lines received',
        percent: counts.total > 0 ? toWholePercent(counts.received / counts.total) : 0,
        valueLabel: `${counts.received} of ${counts.total}`,
      },
      { label: 'Billed', percent: billedPercent(lines) },
    ],
    breakdown: lines.filter((l) => l.quantity > 0).map((l) => ({
      id: l.id,
      name: lineName(l),
      detail: `${formatQuantity(l.qtyReceived)} / ${formatQuantity(l.quantity)} ${unitLabel(l.unitCode)}`.trim(),
      percent: linePercent(l.qtyReceived, l.quantity),
    })),
  };
}

/** The single-line card: opened from a line's bar on the Items tab. */
export function buildLineCardModel(line: PurchaseOrderLine): ReceivingCardModel {
  const unit = unitLabel(line.unitCode);
  const withUnit = (n: number) => `${formatQuantity(n)} ${unit}`.trim();
  const remaining = line.quantity - line.qtyReceived;
  const caption = [
    `${withUnit(line.qtyReceived)} of ${withUnit(line.quantity)} received`,
    remaining > 0 ? `${withUnit(remaining)} still to come` : 'Fully received',
  ];
  if (line.expectedSlabs || line.slabsReceived) {
    caption.push(slabProgressText(line.slabsReceived ?? 0, line.expectedSlabs));
  }

  return {
    title: lineName(line),
    subtitle: line.sku ? `Line ${line.lineNumber} · ${line.sku}` : `Line ${line.lineNumber}`,
    percent: linePercent(line.qtyReceived, line.quantity),
    caption,
    rows: [
      {
        label: 'Billed',
        percent: linePercent(line.qtyBilled, line.quantity),
        valueLabel: `${formatQuantity(line.qtyBilled)} of ${formatQuantity(line.quantity)}`,
      },
    ],
    breakdown: [],
  };
}
