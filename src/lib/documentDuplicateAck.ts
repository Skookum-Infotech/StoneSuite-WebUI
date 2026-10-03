// Which existing orders the reviewer already chose "Create anyway" past on the
// upload dialog, keyed by extraction id, so Save doesn't ask the same question
// again. Only a record the server named (uuid) can be acknowledged: when the
// save-time 409 points at any other order (e.g. a second clerk saved one since)
// the reviewer is asked again. The key shares the draft prefix so
// clearAllDrafts() drops it on logout / workspace switch.
import { draftKey } from './documentReviewDraft';

function ackKey(extractionId: string): string {
  return `${draftKey(extractionId)}:dup-ack`;
}

/** Remembers that the reviewer accepted these existing records as duplicates. */
export function acknowledgeDuplicates(extractionId: string, recordUuids: string[]): void {
  if (recordUuids.length === 0) return;
  try {
    window.sessionStorage.setItem(ackKey(extractionId), JSON.stringify(recordUuids));
  } catch {
    // Without storage the reviewer is simply asked again at Save.
  }
}

/** Reports whether the save-time duplicate is one the reviewer already accepted. */
export function isDuplicateAcknowledged(extractionId: string, recordUuid: string | undefined): boolean {
  if (!recordUuid) return false;
  try {
    const raw = window.sessionStorage.getItem(ackKey(extractionId));
    const uuids: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(uuids) && uuids.includes(recordUuid);
  } catch {
    return false;
  }
}

/** Forgets the acknowledgement (after save or discard). */
export function clearDuplicateAck(extractionId: string): void {
  try {
    window.sessionStorage.removeItem(ackKey(extractionId));
  } catch {
    // Nothing to clean up when storage is unavailable.
  }
}
