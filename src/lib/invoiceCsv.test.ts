import { describe, it, expect } from 'vitest';
import { INVOICE_CSV_HEADERS, invoiceCsvRow } from './invoiceCsv';
import type { InvoiceSummary } from '@/types/invoice';

function makeInvoice(o: Partial<InvoiceSummary> = {}): InvoiceSummary {
  return {
    id: 'inv-1', invoiceNumber: 'INV-1001', status: 'Draft', statusCode: 'DRFT', approvalStatus: 'none',
    customer: { id: 'c-1', name: 'Fontaine Builders' }, invoiceDate: '2026-09-01', grandTotal: 1200, balanceDue: 450.5,
    ...o,
  };
}

describe('invoiceCsvRow', () => {
  it('has one cell per header, in the same order', () => {
    expect(invoiceCsvRow(makeInvoice())).toHaveLength(INVOICE_CSV_HEADERS.length);
    expect(INVOICE_CSV_HEADERS).toEqual(['Invoice #', 'Customer', 'Status', 'Invoice Date', 'Amount', 'Balance Due']);
  });

  it('writes the invoice as shown on the list', () => {
    const [number, customer, status, , amount, balance] = invoiceCsvRow(makeInvoice());
    expect([number, customer, status, amount, balance]).toEqual(['INV-1001', 'Fontaine Builders', 'Draft', '1200', '450.5']);
  });

  it.each([
    { name: 'no customer', patch: { customer: undefined }, index: 1, want: '' },
    { name: 'no number', patch: { invoiceNumber: '' }, index: 0, want: '' },
    { name: 'no totals reads as zero', patch: { grandTotal: undefined, balanceDue: undefined }, index: 4, want: '0' },
  ] as const)('$name', ({ patch, index, want }) => {
    expect(invoiceCsvRow(makeInvoice(patch as Partial<InvoiceSummary>))[index]).toBe(want);
  });
});
