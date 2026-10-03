import { AxiosError } from 'axios';

const HTTP_CONFLICT = 409;
const CODE_DUPLICATE = 'duplicate_document';

/** A 409 duplicate_document from create. */
export interface DuplicateConflict {
  message: string;
  existingUuid?: string;
  existingNumber?: string;
}

/** Parses a create error into a duplicate-document conflict, or null when it is not one. */
export function duplicateFrom(err: unknown): DuplicateConflict | null {
  if (!(err instanceof AxiosError) || err.response?.status !== HTTP_CONFLICT) return null;
  const d = err.response.data as { code?: string; message?: string; existingUuid?: string; existingNumber?: string } | undefined;
  if (d?.code !== CODE_DUPLICATE) return null;
  return {
    message: d.message ?? 'A sales order with this PO number already exists for this customer.',
    existingUuid: d.existingUuid,
    existingNumber: d.existingNumber,
  };
}
