// Pure helpers for the "payment amount exceeds the invoice balance" check on
// the New Payment page. The backend rejects (400) an application larger than
// its invoice's balance rather than clamping it (payment.Apply), so anything
// over the balance has to be capped here before the payment is sent.

import type { ApplicationInput } from '@/types/payment';

const CENTS_PER_UNIT = 100;

/** One "Apply to Invoices" row plus the invoice balance it was added against. */
export interface AppliedInvoiceLine {
  invoiceUuid: string;
  invoiceNumber: string;
  balanceDue: number;
  amount: number;
}

export interface PaymentCheck {
  /** The larger of the Payment Amount and the total applied — whichever the
   *  user raised. It is what the payment is saved as if they confirm. */
  enteredAmount: number;
  /** enteredAmount minus the summed balances of the invoices — the part no
   *  invoice can absorb. 0 when not over. */
  excessAmount: number;
  balanceTotal: number;
  /** Rows whose own amount is above their invoice's balance. */
  overBalanceLines: AppliedInvoiceLine[];
}

function toCents(value: number): number {
  return Math.round(value * CENTS_PER_UNIT);
}

function fromCents(cents: number): number {
  return cents / CENTS_PER_UNIT;
}

/** Compares what was entered — the payment's Amount or the applied total,
 *  whichever is larger — with the balances of the invoices. With no invoice
 *  lines there is nothing to compare against, so the payment is a plain
 *  prepayment and nothing is flagged. */
export function checkPaymentAgainstInvoices(
  paymentAmount: number,
  lines: AppliedInvoiceLine[],
): PaymentCheck {
  const balanceCents = lines.reduce((total, item) => total + toCents(item.balanceDue), 0);
  const appliedCents = lines.reduce((total, item) => total + toCents(item.amount), 0);
  const paymentValid = Number.isFinite(paymentAmount);
  const enteredCents = paymentValid ? Math.max(toCents(paymentAmount), appliedCents) : appliedCents;
  const excessCents = paymentValid && lines.length > 0 ? Math.max(0, enteredCents - balanceCents) : 0;

  return {
    enteredAmount: fromCents(enteredCents),
    excessAmount: fromCents(excessCents),
    balanceTotal: fromCents(balanceCents),
    overBalanceLines: lines.filter((item) => toCents(item.amount) > toCents(item.balanceDue)),
  };
}

/** Caps each application to its invoice's balance; applications for invoices
 *  without a known balance pass through untouched. */
export function capApplicationsToBalance(
  applications: ApplicationInput[],
  lines: Array<Pick<AppliedInvoiceLine, 'invoiceUuid' | 'balanceDue'>>,
): ApplicationInput[] {
  return applications.map((application) => {
    const limit = lines.find((item) => item.invoiceUuid === application.invoiceUuid);
    return limit && application.amount > limit.balanceDue
      ? { ...application, amount: limit.balanceDue }
      : application;
  });
}

/** The amount to hand to the Credit Memo form: the excess, but never more than
 *  the server says is actually left unapplied on the saved payment. */
export function creditMemoExcessAmount(excessAmount: number, serverUnapplied: number | undefined): number {
  if (serverUnapplied === undefined || !Number.isFinite(serverUnapplied) || serverUnapplied <= 0) return 0;
  return Math.min(excessAmount, serverUnapplied);
}

/** The invoice selected in the picker but not yet added with "Add", as a line
 *  for the check — so a payment opened from an invoice is compared with it
 *  even before an application row exists. Its amount is what was typed, else
 *  what the payment would apply to it (the payment amount, up to the balance). */
export function pendingInvoiceLine(
  pending: { id: string; number: string; balanceDue: number } | null,
  typedAmount: number,
  paymentAmount: number,
  lines: Array<Pick<AppliedInvoiceLine, 'invoiceUuid'>>,
): AppliedInvoiceLine | null {
  if (!pending || lines.some((item) => item.invoiceUuid === pending.id)) return null;
  const paymentUsable = Number.isFinite(paymentAmount) && paymentAmount > 0;
  const amount = Number.isFinite(typedAmount) && typedAmount > 0
    ? typedAmount
    : paymentUsable ? Math.min(paymentAmount, pending.balanceDue) : pending.balanceDue;
  return { invoiceUuid: pending.id, invoiceNumber: pending.number, balanceDue: pending.balanceDue, amount };
}

/** The applications to send once the excess is confirmed: existing rows capped
 *  to their balance, plus any checked invoice that was never added as a row. */
export function applicationsForConfirmedExcess(
  applications: ApplicationInput[],
  lines: AppliedInvoiceLine[],
): ApplicationInput[] {
  const notYetAdded = lines
    .filter((item) => !applications.some((application) => application.invoiceUuid === item.invoiceUuid))
    .map((item) => ({ invoiceUuid: item.invoiceUuid, amount: Math.min(item.amount, item.balanceDue) }));
  return [...capApplicationsToBalance(applications, lines), ...notYetAdded];
}
