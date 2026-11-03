import { SO_STATUS_CODES } from '@/lib/salesOrderForm';
import { PO_STATUS_CODES } from '@/lib/purchaseOrderForm';

export const CANCELLED_STATUS_CODE = 'CANC';

/** The forward path a sales order walks (Cancelled is a branch, not a step). */
export const SO_PROGRESS_CODES = ['DRFT', 'PAPV', 'APPV', 'OPEN', 'PART', 'FILL'];

/** The forward path a purchase order walks (Cancelled is a branch, not a step). */
export const PO_PROGRESS_CODES = ['DRFT', 'PAPV', 'APPV', 'SENT', 'PART', 'RCVD', 'CLSD'];

export type ProgressStepState = 'done' | 'current' | 'upcoming';

export interface ProgressStep {
  code: string;
  label: string;
  state: ProgressStepState;
}

/** Marks every step before the current status done, the current one current,
 *  and the rest upcoming. A status outside the path (e.g. Cancelled) leaves
 *  every step upcoming. A terminal status's step reads as current rather than
 *  done, so the last dot is never an unexplained checkmark. */
export function buildProgressSteps(
  pathCodes: string[],
  catalog: { code: string; label: string }[],
  statusCode: string,
): ProgressStep[] {
  const currentIdx = pathCodes.indexOf(statusCode);
  return pathCodes.map((code, idx) => {
    let state: ProgressStepState = 'upcoming';
    if (currentIdx >= 0) {
      if (idx < currentIdx) state = 'done';
      else if (idx === currentIdx) state = 'current';
    }
    return { code, label: catalog.find((s) => s.code === code)?.label ?? code, state };
  });
}

export const buildSalesOrderProgress = (statusCode: string): ProgressStep[] =>
  buildProgressSteps(SO_PROGRESS_CODES, SO_STATUS_CODES, statusCode);

export const buildPurchaseOrderProgress = (statusCode: string): ProgressStep[] =>
  buildProgressSteps(PO_PROGRESS_CODES, PO_STATUS_CODES, statusCode);
