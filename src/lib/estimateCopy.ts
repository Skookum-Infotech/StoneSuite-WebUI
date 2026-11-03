import type { Estimate } from '@/types/estimate';
import { resetCopiedFields } from './recordCopy';
import { estimateDefaults, fromEstimate } from './estimateForm';

/** What a copied estimate must not inherit: its number and status, the
 *  customer's PO number, dates that would be stale, and the owner. */
const ESTIMATE_COPY_RESET_FIELDS = [
  'estimate_status', 'estimate_doc_num', 'purchase_doc_num', 'estimate_date', 'valid_until', 'customer_owner',
] as const;

/** The Add Estimate form's starting state for "Copy estimate". */
export function fromEstimateForCopy(estimate: Estimate): ReturnType<typeof fromEstimate> {
  const mapped = fromEstimate(estimate);
  return { ...mapped, data: resetCopiedFields(mapped.data, estimateDefaults(), ESTIMATE_COPY_RESET_FIELDS) };
}
