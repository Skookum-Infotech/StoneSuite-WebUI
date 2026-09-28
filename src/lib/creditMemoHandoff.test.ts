import { describe, expect, it } from 'vitest';
import {
  CREDIT_MEMO_FROM_PAYMENT_STATE,
  creditMemoFromPaymentPrefill,
  creditMemoFromPaymentState,
  creditMemoHandoffFromPayment,
  creditableFromPayment,
  type CreditMemoFromPayment,
} from './creditMemoHandoff';
import type { Payment } from '@/types/payment';

const handoff: CreditMemoFromPayment = {
  customer: { id: 'cust-1', name: 'Acme Stoneworks' },
  invoices: [{ id: 'inv-1', number: 'INV-000001' }],
  payment: { id: 'pay-1', number: 'PAY-000001' },
  currencyId: 2,
  currencyCode: 'CAD',
  unappliedAmount: 24.5,
};

describe('creditMemoHandoff', () => {
  it('reads a validated payment handoff from router state', () => {
    expect(creditMemoFromPaymentState({
      [CREDIT_MEMO_FROM_PAYMENT_STATE]: handoff,
    })).toEqual(handoff);
  });

  it.each([
    null,
    {},
    { ...handoff, customer: { id: ' ', name: 'Acme Stoneworks' } },
    { ...handoff, invoices: [] },
    { ...handoff, invoices: [{ id: '', number: 'INV-000001' }] },
    { ...handoff, payment: { id: '', number: 'PAY-000001' } },
    { ...handoff, currencyId: 0 },
    { ...handoff, currencyCode: '' },
    { ...handoff, unappliedAmount: 0 },
  ])('rejects malformed router state', (state) => {
    expect(creditMemoFromPaymentState({ [CREDIT_MEMO_FROM_PAYMENT_STATE]: state })).toBeNull();
  });

  it('builds a currency-aware, amount-only credit memo draft', () => {
    const prefill = creditMemoFromPaymentPrefill(handoff);

    expect(prefill.data).toMatchObject({
      amount: '24.50',
      currency_id: '2',
      reference_number: 'PAY-000001',
      reason: 'Excess payment',
      sales_tax_pct: '0',
    });
    expect(prefill.invoice).toEqual({ id: 'inv-1', number: 'INV-000001', balanceDue: 0 });
    expect(prefill).not.toHaveProperty('lineItems');
  });

  it('keeps all invoice lineage without selecting one when several invoices are affected', () => {
    const prefill = creditMemoFromPaymentPrefill({
      ...handoff,
      invoices: [
        { id: 'inv-1', number: 'INV-000001' },
        { id: 'inv-2', number: 'INV-000002' },
      ],
    });

    expect(prefill.invoice).toBeNull();
    expect(prefill.data.memo).toBe('Created from payment PAY-000001 for invoices INV-000001, INV-000002.');
  });
});

// A payment saved with an excess, then a credit memo that was never created —
// the payment page rebuilds the same handoff from what the payment itself says.
function payment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: 'pay-1',
    paymentNumber: 'PAY-000001',
    customer: { id: 'cust-1', name: 'Acme Stoneworks' },
    currencyId: 2,
    amount: 1000,
    appliedTotal: 700,
    unappliedAmount: 300,
    creditedTotal: 0,
    applications: [
      { id: 'app-1', invoiceId: 'inv-1', invoiceNumber: 'INV-000006', amount: 700, createdAt: '2026-09-01T00:00:00Z' },
    ],
    ...overrides,
  } as Payment;
}

describe('creditableFromPayment', () => {
  it.each([
    { unapplied: 300, credited: undefined, expected: 300 },
    { unapplied: 300, credited: 0, expected: 300 },
    { unapplied: 300, credited: 100, expected: 200 },
    { unapplied: 300, credited: 300, expected: 0 },
    { unapplied: 300, credited: 450, expected: 0 },
    { unapplied: 0, credited: 0, expected: 0 },
    { unapplied: 300.3, credited: 0.1, expected: 300.2 },
  ])('is $expected when $unapplied is unapplied and $credited is credited', ({ unapplied, credited, expected }) => {
    expect(creditableFromPayment({ unappliedAmount: unapplied, creditedTotal: credited })).toBe(expected);
  });
});

describe('creditMemoHandoffFromPayment', () => {
  it("describes the payment's own customer, invoices, currency and remaining credit", () => {
    expect(creditMemoHandoffFromPayment(payment(), 'CAD')).toEqual({
      customer: { id: 'cust-1', name: 'Acme Stoneworks' },
      invoices: [{ id: 'inv-1', number: 'INV-000006' }],
      payment: { id: 'pay-1', number: 'PAY-000001' },
      currencyId: 2,
      currencyCode: 'CAD',
      unappliedAmount: 300,
    });
  });

  it('only offers what earlier credit memos have not already taken', () => {
    expect(creditMemoHandoffFromPayment(payment({ creditedTotal: 277.24 }), 'CAD')?.unappliedAmount).toBe(22.76);
  });

  it('lists every invoice the payment was applied to', () => {
    const handoff = creditMemoHandoffFromPayment(payment({
      applications: [
        { id: 'a', invoiceId: 'inv-1', invoiceNumber: 'INV-000001', amount: 100, createdAt: '' },
        { id: 'b', invoiceId: 'inv-2', invoiceNumber: 'INV-000002', amount: 200, createdAt: '' },
      ],
    }), 'CAD');
    expect(handoff?.invoices).toEqual([
      { id: 'inv-1', number: 'INV-000001' },
      { id: 'inv-2', number: 'INV-000002' },
    ]);
  });

  it('has no currency id when the payment has none', () => {
    expect(creditMemoHandoffFromPayment(payment({ currencyId: undefined }), 'USD')?.currencyId).toBeNull();
  });

  it.each([
    ['everything is already credited', { creditedTotal: 300 }],
    ['nothing is unapplied', { unappliedAmount: 0 }],
    ['it was applied to no invoice', { applications: [] }],
  ])('offers nothing when %s', (_label, overrides) => {
    expect(creditMemoHandoffFromPayment(payment(overrides), 'CAD')).toBeNull();
  });

  it('never produces a handoff the credit memo page would refuse to read', () => {
    const handoff = creditMemoHandoffFromPayment(payment({
      paymentNumber: '',
      applications: [{ id: 'a', invoiceId: 'inv-1', invoiceNumber: '', amount: 700, createdAt: '' }],
    }), 'CAD');
    expect(creditMemoFromPaymentState({ [CREDIT_MEMO_FROM_PAYMENT_STATE]: handoff })).toEqual(handoff);
  });
});
