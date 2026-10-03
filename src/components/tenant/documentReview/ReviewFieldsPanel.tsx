import * as React from 'react';
import { FieldProvenance } from './FieldProvenance';
import { ReviewFieldFrame } from './ReviewFieldFrame';
import { HEADER_KEYS, HEADER_LABELS } from '@/lib/salesOrderDocumentHandoff';
import type { SalesOrderReviewMode } from '@/hooks/useSalesOrderReviewMode';

interface ReviewFieldsPanelProps {
  review: SalesOrderReviewMode;
}

const ORDER = [
  HEADER_KEYS.customer, HEADER_KEYS.poNumber, HEADER_KEYS.orderDate, HEADER_KEYS.expectedDelivery,
  HEADER_KEYS.paymentTerms, HEADER_KEYS.billTo, HEADER_KEYS.shipTo, HEADER_KEYS.shippingCharge, HEADER_KEYS.adjustment,
];
const CUSTOMER_SEARCH_SELECTOR = 'input[aria-label="Search billing customer"], button[aria-label="Change billing customer"]';

function signedUsd(n: number): string {
  return `${n < 0 ? '-' : ''}$${Math.abs(n).toFixed(2)}`;
}

/** What the form currently holds for a header key (shown beside the document's text). */
function formValue(review: SalesOrderReviewMode, key: string): string {
  const { data, customer } = review.form;
  switch (key) {
    case HEADER_KEYS.customer: return customer?.name ?? '';
    case HEADER_KEYS.poNumber: return String(data.purchase_doc_num ?? '');
    case HEADER_KEYS.orderDate: return String(data.date_created ?? '');
    case HEADER_KEYS.expectedDelivery: return review.extras.expectedDelivery;
    case HEADER_KEYS.shippingCharge: return signedUsd(review.extras.shippingCharge);
    case HEADER_KEYS.adjustment: return signedUsd(review.extras.adjustment);
    default: return '';
  }
}

function CustomerChoices({ review }: ReviewFieldsPanelProps): React.JSX.Element | null {
  const handoff = review.handoff;
  if (!handoff || review.form.customer) return null;
  const { candidates, extractedText } = handoff.customer;
  return (
    <div className="space-y-1">
      {extractedText && <p className="text-stone-500 dark:text-stone-400">The document says {'“'}{extractedText}{'”'}.</p>}
      <div className="flex flex-wrap gap-1.5">
        {candidates.filter((c) => c.active).map((c) => (
          <button
            key={c.uuid}
            type="button"
            onClick={() => review.pickCustomer({ id: c.uuid, name: c.name })}
            aria-label={`Use customer ${c.name}`}
            className="rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 px-2.5 py-1 text-xs font-medium text-stone-700 dark:text-stone-300 transition-colors hover:bg-stone-50 dark:hover:bg-white/10"
          >
            Use {c.name}
          </button>
        ))}
        <button
          type="button"
          onClick={() => document.querySelector<HTMLElement>(CUSTOMER_SEARCH_SELECTOR)?.focus()}
          aria-label="Search customers in the form below"
          className="rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 px-2.5 py-1 text-xs font-medium text-stone-700 dark:text-stone-300 transition-colors hover:bg-stone-50 dark:hover:bg-white/10"
        >
          Search customers
        </button>
      </div>
    </div>
  );
}

/** The header values read from the document, one row each: provenance marker,
 *  what the document said vs what the form holds, and a "Mark reviewed" toggle.
 *  An unmatched customer offers the server's candidates inline. */
export function ReviewFieldsPanel({ review }: ReviewFieldsPanelProps): React.JSX.Element | null {
  const handoff = review.handoff;
  if (!handoff) return null;
  const pendingKeys = new Set(review.pending.map((p) => p.key));
  const rows = ORDER.filter((k) => handoff.provenance[k] || k === HEADER_KEYS.customer);
  return (
    <section aria-label="Fields read from the document" className="grid gap-2 sm:grid-cols-2">
      {rows.map((key) => {
        const prov = handoff.provenance[key];
        const needs = pendingKeys.has(key);
        const reviewed = review.reviewed.has(key);
        const label = HEADER_LABELS[key];
        const current = formValue(review, key);
        return (
          <ReviewFieldFrame key={key} reviewKey={key} needsReview={needs} onFieldFocus={() => review.focusField(prov?.page, prov?.row)}>
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-stone-900 dark:text-stone-100">{label}</span>
              <FieldProvenance label={label} provenance={prov} needsReview={needs} onShowInDocument={review.showInDocument} />
            </div>
            {prov?.value && <p className="text-stone-600 dark:text-stone-300">Document: {prov.value}</p>}
            {current && current !== prov?.value && <p className="text-stone-800 dark:text-stone-200">Form: {current}</p>}
            {key === HEADER_KEYS.customer && <CustomerChoices review={review} />}
            <button
              type="button"
              aria-pressed={reviewed}
              aria-label={`${reviewed ? 'Reviewed' : 'Mark reviewed'}, ${label}`}
              onClick={() => review.toggleReviewed(key)}
              className="rounded-md border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 px-2 py-0.5 text-2xs font-medium text-stone-600 dark:text-stone-300 transition-colors hover:bg-stone-50 dark:hover:bg-white/10 aria-pressed:border-accent-foreground/30 aria-pressed:bg-accent aria-pressed:text-accent-foreground"
            >
              {reviewed ? 'Reviewed' : 'Mark reviewed'}
            </button>
          </ReviewFieldFrame>
        );
      })}
    </section>
  );
}
