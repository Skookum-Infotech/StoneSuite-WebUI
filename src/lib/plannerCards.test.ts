import { describe, it, expect } from 'vitest';
import { cardNoun, countLabel, invoiceCard, orderSchedulePath, scheduleEventCard } from './plannerCards';
import type { InvoiceSummary } from '@/types/invoice';
import type { ScheduleFeedEvent } from '@/types/salesOrder';

// Wall-clock "now" for the overdue rule: 2026-10-14 at noon, local.
const NOW = new Date(2026, 9, 14, 12, 0, 0);

function event(over: Partial<ScheduleFeedEvent> = {}): ScheduleFeedEvent {
  return {
    code: 'template_in_progress',
    sequence: 3,
    group: 'Template',
    name: 'Template In Progress',
    status: 'scheduled',
    scheduledAt: '2026-10-15T09:00:00',
    notes: '',
    order: {
      id: 'so-uuid-1',
      number: 'SO-1042',
      customerName: 'Acme Builders',
      status: 'Open',
      statusCode: 'OPEN',
      scheduledInstallDate: '2026-11-10',
      poNumber: 'PO-5531',
    },
    ...over,
  };
}

describe('scheduleEventCard', () => {
  it('shows the time, order, customer, stage and install details', () => {
    const card = scheduleEventCard(event(), NOW);

    expect(card).toMatchObject({
      id: 'so-uuid-1:template_in_progress',
      kind: 'schedule',
      at: '2026-10-15T09:00:00',
      allDay: false,
      timeLabel: '9:00 AM',
      title: 'SO-1042',
      customer: 'Acme Builders',
      stage: 'Template In Progress',
      statusLabel: 'Scheduled',
      meta: 'Installs Nov 10, 2026 · PO PO-5531',
      done: false,
      overdue: false,
    });
  });

  it('links to the order opened on its Scheduling tab', () => {
    expect(scheduleEventCard(event(), NOW).href).toBe('/sales/sales_order/so-uuid-1?tab=scheduling');
    expect(orderSchedulePath('abc')).toBe('/sales/sales_order/abc?tab=scheduling');
  });

  it('flags a scheduled activity whose time has passed as overdue', () => {
    const card = scheduleEventCard(event({ scheduledAt: '2026-10-13T09:00:00' }), NOW);

    expect(card.overdue).toBe(true);
    expect(card.statusLabel).toBe('Overdue');
    expect(card.done).toBe(false);
  });

  it('marks a completed activity done and says when', () => {
    const card = scheduleEventCard(
      event({ status: 'completed', scheduledAt: '2026-10-13T09:00:00', completedAt: '2026-10-13T10:30:00' }),
      NOW,
    );

    expect(card).toMatchObject({ done: true, overdue: false, statusLabel: 'Completed' });
    expect(card.doneLabel).toBe('Done Oct 13, 2026, 10:30 AM');
  });

  it('carries the planner notes', () => {
    expect(scheduleEventCard(event({ notes: 'Customer on site' }), NOW).notes).toBe('Customer on site');
  });

  it('flags an order still awaiting approval, but not a firm one', () => {
    const draft = scheduleEventCard(
      event({ order: { ...event().order, status: 'Draft', statusCode: 'DRFT' } }),
      NOW,
    );
    const pending = scheduleEventCard(
      event({ order: { ...event().order, status: 'Pending Approval', statusCode: 'PAPV' } }),
      NOW,
    );

    expect(draft.meta).toBe('Installs Nov 10, 2026 · PO PO-5531 · Draft');
    expect(pending.meta).toContain('Pending Approval');
    expect(scheduleEventCard(event(), NOW).meta).not.toContain('Open');
  });

  it('leaves out install date and PO when the order has neither', () => {
    const card = scheduleEventCard(
      event({ order: { ...event().order, scheduledInstallDate: undefined, poNumber: undefined } }),
      NOW,
    );

    expect(card.meta).toBe('');
  });

  it('sorts cards of one order in plan order', () => {
    const a = scheduleEventCard(event({ sequence: 3 }), NOW);
    const b = scheduleEventCard(event({ sequence: 12 }), NOW);

    expect(a.sortKey < b.sortKey).toBe(true);
  });
});

describe('cardNoun / countLabel', () => {
  it.each([
    ['schedule', 0, '0 jobs'],
    ['schedule', 1, '1 job'],
    ['schedule', 12, '12 jobs'],
    ['invoice', 1, '1 invoice'],
    ['invoice', 2, '2 invoices'],
  ] as const)('counts %s cards: %i → "%s"', (kind, count, expected) => {
    expect(countLabel(kind, count)).toBe(expected);
  });

  it('gives the bare noun, singular only for exactly one', () => {
    expect(cardNoun('schedule', 1)).toBe('job');
    expect(cardNoun('schedule', 3)).toBe('jobs');
    expect(cardNoun('invoice', 3)).toBe('invoices');
  });
});

function invoice(over: Partial<InvoiceSummary> = {}): InvoiceSummary {
  return {
    id: 'inv-uuid-1',
    invoiceNumber: 'INV-2077',
    status: 'Sent',
    statusCode: 'SENT',
    approvalStatus: 'approved',
    customer: { id: 'c1', name: 'Acme Builders' },
    salesOrder: { id: 'so-uuid-1', number: 'SO-1042' },
    invoiceDate: '2026-10-05',
    dueDate: '2026-10-20',
    grandTotal: 1500,
    balanceDue: 1250,
    ...over,
  };
}

describe('invoiceCard', () => {
  it('is placed on the due date as a date-only card', () => {
    const card = invoiceCard(invoice());

    expect(card).toMatchObject({
      id: 'invoice:inv-uuid-1',
      kind: 'invoice',
      at: '2026-10-20T00:00',
      allDay: true,
      timeLabel: 'Due',
      title: 'INV-2077',
      customer: 'Acme Builders',
      statusLabel: 'Sent',
      done: false,
      overdue: false,
    });
  });

  it('links to the invoice and, separately, to the order it came from', () => {
    const card = invoiceCard(invoice());

    expect(card?.href).toBe('/sales/invoice/inv-uuid-1');
    expect(card?.origin).toEqual({ label: 'SO-1042', href: '/sales/sales_order/so-uuid-1?tab=scheduling' });
  });

  it('shows the balance still due', () => {
    expect(invoiceCard(invoice())?.meta).toBe('$1,250.00 due');
  });

  it('shows a paid invoice as paid in full, and done', () => {
    const card = invoiceCard(invoice({ status: 'Paid', statusCode: 'PAID', balanceDue: 0 }));

    expect(card).toMatchObject({ done: true, meta: '$1,500.00 paid', statusLabel: 'Paid' });
  });

  it('flags an overdue invoice', () => {
    expect(invoiceCard(invoice({ status: 'Overdue', statusCode: 'ODUE' }))?.overdue).toBe(true);
  });

  it('falls back to the invoice date when there is no due date', () => {
    expect(invoiceCard(invoice({ dueDate: undefined }))?.at).toBe('2026-10-05T00:00');
  });

  it('reads a due date the API sent as a timestamp', () => {
    expect(invoiceCard(invoice({ dueDate: '2026-10-20T00:00:00Z' }))?.at).toBe('2026-10-20T00:00');
  });

  it('skips an invoice with no order, and a void one', () => {
    expect(invoiceCard(invoice({ salesOrder: null }))).toBeNull();
    expect(invoiceCard(invoice({ salesOrder: undefined }))).toBeNull();
    expect(invoiceCard(invoice({ status: 'Void', statusCode: 'VOID' }))).toBeNull();
  });
});
