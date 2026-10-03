import type { CustomerRef } from '@/pages/sales/components/CustomerPicker';
import type { HandoffExtras } from '@/lib/salesOrderDocumentHandoff';
import type { SOLineItem } from '@/lib/salesOrderForm';

/** The Add Sales Order page's form state that review mode reads and writes. */
export interface ReviewForm {
  data: Record<string, unknown>;
  lineItems: SOLineItem[];
  customer: CustomerRef | null;
  customFieldValues: Record<string, unknown>;
}

/** What review mode keeps in the sessionStorage draft. */
export interface DraftSnapshot {
  form: ReviewForm;
  reviewed: string[];
  extras: HandoffExtras;
}

/** Which document row the focused field came from. `nonce` bumps only on an
 *  explicit "Show in document" so the pane can expand and switch page. */
export interface DocFocus {
  page?: number;
  row?: number;
  nonce: number;
}

/** A write to the page's form state; `data` may be an updater so it composes
 *  with the customer-change handler's own functional update. */
export type ReviewPatch = Omit<Partial<ReviewForm>, 'data'> & {
  data?: Record<string, unknown> | ((prev: Record<string, unknown>) => Record<string, unknown>);
};
