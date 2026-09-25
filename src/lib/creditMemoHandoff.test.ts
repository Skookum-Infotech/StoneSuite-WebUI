import { describe, expect, it } from 'vitest';
import {
  CREDIT_MEMO_FROM_PAYMENT_STATE,
  creditMemoFromPaymentPrefill,
  creditMemoFromPaymentState,
  type CreditMemoFromPayment,
} from './creditMemoHandoff';

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
