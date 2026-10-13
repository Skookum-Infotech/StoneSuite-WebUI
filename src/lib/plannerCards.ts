// What a job card on the Activity Planner shows, and where it links, built from
// the two sources the calendar reads: an order's schedule rows and the invoices
// made from orders. The card component only renders a PlannerCard; every
// decision about wording, status and links is made here so it can be tested.

import { datePart, formatDisplayDate } from '@/lib/dateUtils';
import { formatMoney } from '@/lib/formatMoney';
import { INVOICE_STATUS_COLORS } from '@/lib/invoiceForm';
import { chipFillFor } from '@/lib/plannerChipColor';
import {
  SCHEDULE_STATUS_COLORS,
  SCHEDULE_STATUS_LABELS,
  displayStatus,
  formatWallClock,
  formatWallClockTime,
} from '@/lib/salesOrderSchedule';
import type { InvoiceSummary } from '@/types/invoice';
import type { ScheduleFeedEvent } from '@/types/salesOrder';

export interface PlannerCard {
  id: string;
  kind: 'schedule' | 'invoice';
  /** Where the card sits: wall-clock `yyyy-mm-ddThh:mm`. */
  at: string;
  /** Tiebreak for cards at the same minute. */
  sortKey: string;
  /** A date-only card (an invoice's due date) — no time of day. */
  allDay: boolean;
  /** Top-left label: "9:00 AM", or "Due" for a date-only card. */
  timeLabel: string;
  statusLabel: string;
  /** Hex colour of the status pill. */
  statusColor: string;
  /** Hex fill of the card's chip on the calendar: the status colour, darkened
   *  until white text on it is readable. */
  chipColor: string;
  /** Where and when, in full, for the detail card: "Oct 15, 2026, 9:00 AM", or
   *  "Due Oct 20, 2026" for a date-only card. */
  whenLabel: string;
  /** The main link's text: the Sales Order number, or the invoice number. */
  title: string;
  href: string;
  /** The detail card's button, which opens `href`: "Open sales order". */
  openLabel: string;
  /** A second link — an invoice card's order. */
  origin?: { label: string; href: string };
  customer: string;
  /** The activity this card is, when its name says more than the tab already
   *  does — "Installation Ready" on the Installation tab; empty for "Saw" on Saw. */
  stage: string;
  /** One muted line: install date and PO, or the amount due. */
  meta: string;
  notes: string;
  /** "Done Oct 13, 2026, 10:30 AM" once finished. */
  doneLabel: string;
  done: boolean;
  overdue: boolean;
  ariaLabel: string;
}

/** Orders still awaiting approval are flagged on their cards, so a planner can
 *  tell a firm job from a draft. */
const UNCONFIRMED_ORDER_CODES = new Set(['DRFT', 'PAPV']);
const SALES_ORDER_FALLBACK_TITLE = 'Sales order';
const INVOICE_FALLBACK_TITLE = 'Invoice';
const DUE_LABEL = 'Due';
const OPEN_ORDER_LABEL = 'Open sales order';
const OPEN_INVOICE_LABEL = 'Open invoice';
const PAID_STATUS_CODE = 'PAID';
const OVERDUE_STATUS_CODE = 'ODUE';
const VOID_STATUS_CODE = 'VOID';
const NEUTRAL_STATUS_COLOR = '#a8a29e';
const META_SEPARATOR = ' · ';
const JOB_NOUN = 'job';
const INVOICE_NOUN = 'invoice';

/** What a count of cards is a count of: "job"/"jobs", "invoice"/"invoices". */
export function cardNoun(kind: PlannerCard['kind'], count: number): string {
  const noun = kind === 'invoice' ? INVOICE_NOUN : JOB_NOUN;
  return count === 1 ? noun : `${noun}s`;
}

/** "1 job", "3 jobs", "2 invoices" — how a column or the page counts its cards. */
export function countLabel(kind: PlannerCard['kind'], count: number): string {
  return `${count} ${cardNoun(kind, count)}`;
}

/** How many of a stack's `count` cards to show, of the `max` the stack has room
 *  for. Past `max` the rest fold behind a toggle that takes the last slot — so a
 *  stack is never folded to hide just one card. `expanded` shows them all. */
export function visibleCardCount(count: number, max: number, expanded: boolean): number {
  if (expanded || count <= max) return count;
  return max - 1;
}

/** An order's own page, opened on its Scheduling tab. */
export function orderSchedulePath(orderId: string): string {
  return `/sales/sales_order/${orderId}?tab=scheduling`;
}

export function invoicePath(invoiceId: string): string {
  return `/sales/invoice/${invoiceId}`;
}

/** The card for one planned activity of one order. */
export function scheduleEventCard(event: ScheduleFeedEvent, now: Date = new Date()): PlannerCard {
  const { order } = event;
  const status = displayStatus(event, now);
  const title = order.number || SALES_ORDER_FALLBACK_TITLE;
  const meta = [
    order.scheduledInstallDate ? `Installs ${formatDisplayDate(order.scheduledInstallDate)}` : '',
    order.poNumber ? `PO ${order.poNumber}` : '',
    UNCONFIRMED_ORDER_CODES.has(order.statusCode) ? order.status : '',
  ]
    .filter(Boolean)
    .join(META_SEPARATOR);
  const done = status === 'completed';

  return {
    id: `${order.id}:${event.code}`,
    kind: 'schedule',
    at: event.scheduledAt,
    sortKey: `${title}:${String(event.sequence).padStart(2, '0')}`,
    allDay: false,
    timeLabel: formatWallClockTime(event.scheduledAt),
    statusLabel: SCHEDULE_STATUS_LABELS[status],
    statusColor: SCHEDULE_STATUS_COLORS[status],
    chipColor: chipFillFor(SCHEDULE_STATUS_COLORS[status]),
    whenLabel: formatWallClock(event.scheduledAt),
    title,
    href: orderSchedulePath(order.id),
    openLabel: OPEN_ORDER_LABEL,
    customer: order.customerName,
    stage: event.name === event.group ? '' : event.name,
    meta,
    notes: event.notes,
    doneLabel: done && event.completedAt ? `Done ${formatWallClock(event.completedAt)}` : '',
    done,
    overdue: status === 'overdue',
    ariaLabel: `Open ${title}, ${event.name}, ${formatWallClock(event.scheduledAt)}, ${SCHEDULE_STATUS_LABELS[status]}`,
  };
}

/** The card for an invoice made from an order, placed on its due date. Null for
 *  an invoice that has no order (the calendar is order-centred) or is void. */
export function invoiceCard(invoice: InvoiceSummary, currencyCode?: string): PlannerCard | null {
  if (!invoice.salesOrder || invoice.statusCode === VOID_STATUS_CODE) return null;
  const day = datePart(invoice.dueDate || invoice.invoiceDate);
  if (!day) return null;

  const title = invoice.invoiceNumber || INVOICE_FALLBACK_TITLE;
  const paid = invoice.statusCode === PAID_STATUS_CODE;
  const order = invoice.salesOrder;
  const meta = paid
    ? `${formatMoney(invoice.grandTotal, currencyCode)} paid`
    : `${formatMoney(invoice.balanceDue, currencyCode)} due`;
  const statusColor = INVOICE_STATUS_COLORS[invoice.status] ?? NEUTRAL_STATUS_COLOR;

  return {
    id: `invoice:${invoice.id}`,
    kind: 'invoice',
    at: `${day}T00:00`,
    sortKey: title,
    allDay: true,
    timeLabel: DUE_LABEL,
    statusLabel: invoice.status,
    statusColor,
    chipColor: chipFillFor(statusColor),
    whenLabel: `${DUE_LABEL} ${formatDisplayDate(day)}`,
    title,
    href: invoicePath(invoice.id),
    openLabel: OPEN_INVOICE_LABEL,
    origin: { label: order.number, href: orderSchedulePath(order.id) },
    customer: invoice.customer.name,
    stage: '',
    meta,
    notes: '',
    doneLabel: '',
    done: paid,
    overdue: invoice.statusCode === OVERDUE_STATUS_CODE,
    ariaLabel: `Open invoice ${title} for ${order.number}, due ${formatDisplayDate(day)}, ${invoice.status}`,
  };
}
