import { creditMemoDefaults } from './creditMemoForm';
import type { Payment } from '@/types/payment';

export const CREDIT_MEMO_FROM_PAYMENT_STATE = 'creditMemoFromPayment' as const;

const CENTS_PER_UNIT = 100;

/** Stands in for an invoice number the payment's application did not carry, so
 *  the handoff still passes isHandoff (which needs every invoice named). */
const UNNUMBERED_INVOICE_LABEL = 'Invoice';

export interface CreditMemoFromPayment {
  customer: { id: string; name: string };
  invoices: Array<{ id: string; number: string }>;
  payment: { id: string; number?: string };
  currencyId: number | null;
  currencyCode: string;
  unappliedAmount: number;
}

export interface CreditMemoFromPaymentPrefill {
  data: Record<string, unknown>;
  invoice: { id: string; number: string; balanceDue: number } | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isInvoiceRef(value: unknown): value is { id: string; number: string } {
  return isRecord(value) && isNonEmptyString(value.id) && isNonEmptyString(value.number);
}

function isHandoff(value: unknown): value is CreditMemoFromPayment {
  if (!isRecord(value) || !isRecord(value.customer) || !isRecord(value.payment)) return false;
  if (!Array.isArray(value.invoices) || value.invoices.length === 0 || !value.invoices.every(isInvoiceRef)) return false;
  return (
    isNonEmptyString(value.customer.id)
    && isNonEmptyString(value.customer.name)
    && isNonEmptyString(value.payment.id)
    && (value.payment.number === undefined || isNonEmptyString(value.payment.number))
    && (value.currencyId === null || (Number.isInteger(value.currencyId) && (value.currencyId as number) > 0))
    && isNonEmptyString(value.currencyCode)
    && typeof value.unappliedAmount === 'number'
    && Number.isFinite(value.unappliedAmount)
    && value.unappliedAmount > 0
  );
}

/** What of a payment a credit memo can still take: its unapplied balance less
 *  what earlier credit memos issued from it already took. (The backend also
 *  nets off refunds, which the payment API does not expose — it enforces the
 *  true limit when the memo is saved.) */
export function creditableFromPayment(payment: Pick<Payment, 'unappliedAmount' | 'creditedTotal'>): number {
  const cents = Math.round(payment.unappliedAmount * CENTS_PER_UNIT)
    - Math.round((payment.creditedTotal ?? 0) * CENTS_PER_UNIT);
  return Math.max(0, cents) / CENTS_PER_UNIT;
}

/** The handoff for raising the credit memo from an already-saved payment — the
 *  same one the New Payment page sends after an excess is confirmed, so the memo
 *  opens prefilled and linked to the payment either way. Null when there is
 *  nothing left to credit, or the payment was applied to no invoice (the memo
 *  form is prefilled from the invoices it was applied to). */
export function creditMemoHandoffFromPayment(payment: Payment, currencyCode: string): CreditMemoFromPayment | null {
  const unappliedAmount = creditableFromPayment(payment);
  if (unappliedAmount <= 0 || payment.applications.length === 0) return null;
  return {
    customer: { id: payment.customer.id, name: payment.customer.name },
    invoices: payment.applications.map((application) => ({
      id: application.invoiceId,
      number: application.invoiceNumber || UNNUMBERED_INVOICE_LABEL,
    })),
    payment: { id: payment.id, number: payment.paymentNumber || undefined },
    currencyId: payment.currencyId ?? null,
    currencyCode,
    unappliedAmount,
  };
}

export function creditMemoFromPaymentState(value: unknown): CreditMemoFromPayment | null {
  if (!isRecord(value)) return null;
  const handoff = value[CREDIT_MEMO_FROM_PAYMENT_STATE];
  return isHandoff(handoff) ? handoff : null;
}

export function creditMemoFromPaymentPrefill(handoff: CreditMemoFromPayment): CreditMemoFromPaymentPrefill {
  const amount = handoff.unappliedAmount.toFixed(2);
  const paymentLabel = handoff.payment.number
    ? `payment ${handoff.payment.number}`
    : 'an over-applied payment';
  const invoiceNumbers = handoff.invoices.map((invoice) => invoice.number);
  const invoiceLabel = invoiceNumbers.length === 1
    ? `invoice ${invoiceNumbers[0]}`
    : `invoices ${invoiceNumbers.join(', ')}`;

  return {
    data: {
      ...creditMemoDefaults(),
      amount,
      currency_id: handoff.currencyId === null ? '' : String(handoff.currencyId),
      reference_number: handoff.payment.number ?? '',
      reason: 'Excess payment',
      memo: `Created from ${paymentLabel} for ${invoiceLabel}.`,
    },
    invoice: handoff.invoices.length === 1
      ? { ...handoff.invoices[0], balanceDue: 0 }
      : null,
  };
}
