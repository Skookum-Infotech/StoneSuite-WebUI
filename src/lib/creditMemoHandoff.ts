import { creditMemoDefaults } from './creditMemoForm';

export const CREDIT_MEMO_FROM_PAYMENT_STATE = 'creditMemoFromPayment' as const;

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
