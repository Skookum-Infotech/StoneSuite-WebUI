import type { Requisition } from '@/types/requisition';
import { resetCopiedFields } from './recordCopy';
import { fromRequisition, requisitionDefaults } from './requisitionForm';

/** What a copied requisition must not inherit: its number and status, the
 *  requester (whoever saves the copy is asking) and a needed-by date that would
 *  be stale. */
const REQUISITION_COPY_RESET_FIELDS = ['reqn_status', 'reqn_doc_num', 'requested_by', 'needed_by_date'] as const;

/** The Add Requisition form's starting state for "Copy requisition". */
export function fromRequisitionForCopy(reqn: Requisition): ReturnType<typeof fromRequisition> {
  const mapped = fromRequisition(reqn);
  return { ...mapped, data: resetCopiedFields(mapped.data, requisitionDefaults(), REQUISITION_COPY_RESET_FIELDS) };
}
