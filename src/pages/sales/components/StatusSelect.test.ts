import { describe, it, expect } from 'vitest';
import { resolveStatusOptions } from '@/lib/statusTransitions';
import { SO_STATUS_CODES, SO_ALLOWED_TRANSITIONS } from '@/lib/salesOrderForm';
import { INVOICE_STATUS_CODES, INVOICE_ALLOWED_TRANSITIONS } from '@/lib/invoiceForm';
import { ESTIMATE_STATUS_CODES, ESTIMATE_ALLOWED_TRANSITIONS } from '@/lib/estimateForm';
import { QUOTE_STATUS_CODES, QUOTE_ALLOWED_TRANSITIONS } from '@/lib/quoteForm';
import { PAYMENT_STATUS_CODES, PAYMENT_ALLOWED_TRANSITIONS } from '@/lib/paymentForm';
import { REFUND_STATUS_CODES, REFUND_ALLOWED_TRANSITIONS } from '@/lib/refundForm';

const codes = (list: { code: string }[]) => list.map((s) => s.code);

describe('resolveStatusOptions', () => {
  it('offers the whole catalog and is never terminal when no transition map is given', () => {
    const { options, isTerminal } = resolveStatusOptions(SO_STATUS_CODES, 'DRFT');
    expect(codes(options)).toEqual(codes(SO_STATUS_CODES));
    expect(isTerminal).toBe(false);
  });

  it('offers only the current status plus its legal next-moves when a map is given', () => {
    const { options, isTerminal } = resolveStatusOptions(SO_STATUS_CODES, 'DRFT', SO_ALLOWED_TRANSITIONS);
    // DRFT -> PAPV|CANC; the current status is always included, in catalog order.
    expect(codes(options)).toEqual(['DRFT', 'PAPV', 'CANC']);
    expect(isTerminal).toBe(false);
  });

  it('marks a status with no legal moves as terminal', () => {
    const { options, isTerminal } = resolveStatusOptions(SO_STATUS_CODES, 'FILL', SO_ALLOWED_TRANSITIONS);
    expect(codes(options)).toEqual(['FILL']);
    expect(isTerminal).toBe(true);
  });

  it('treats an unknown status as terminal with no options', () => {
    const { options, isTerminal } = resolveStatusOptions(SO_STATUS_CODES, 'NOPE', SO_ALLOWED_TRANSITIONS);
    expect(options).toEqual([]);
    expect(isTerminal).toBe(true);
  });
});

// Drift guard: every transition map mirrors a backend `<doc>/transitions.go`,
// so a typo'd or stale code would silently offer an illegal move (or hide a
// legal one). Assert each map only references codes the document declares.
describe('transition maps reference only declared status codes', () => {
  const docs: [string, { code: string }[], Record<string, string[]>][] = [
    ['SalesOrder', SO_STATUS_CODES, SO_ALLOWED_TRANSITIONS],
    ['Invoice', INVOICE_STATUS_CODES, INVOICE_ALLOWED_TRANSITIONS],
    ['Estimate', ESTIMATE_STATUS_CODES, ESTIMATE_ALLOWED_TRANSITIONS],
    ['Quote', QUOTE_STATUS_CODES, QUOTE_ALLOWED_TRANSITIONS],
    ['Payment', PAYMENT_STATUS_CODES, PAYMENT_ALLOWED_TRANSITIONS],
    ['Refund', REFUND_STATUS_CODES, REFUND_ALLOWED_TRANSITIONS],
  ];

  it.each(docs)('%s', (_name, statusCodes, map) => {
    const known = new Set(codes(statusCodes));
    expect(Object.keys(map).length).toBeGreaterThan(0);
    for (const [from, targets] of Object.entries(map)) {
      expect(known.has(from)).toBe(true);
      for (const to of targets) expect(known.has(to)).toBe(true);
    }
  });
});
