// Journal Entry form field definitions + form-state <-> payload mapping —
// mirrors lib/itemReceiptForm.ts's shape, adapted to the Journal Entry
// backend contract (types/journalEntry.ts). From/To accounts are handled by
// the shared AccountPicker component, not this generic field grid — mirrors
// how AddPaymentPage keeps CustomerPicker outside PaymentSectionGrid.
import type { CrmLookups } from '@/services/lookupService';
import type {
  JournalEntry, JournalEntryAccountRef, JournalEntryCreatePayload, JournalEntryUpdatePayload,
  JournalEntryStatusCode,
} from '@/types/journalEntry';

export const PAGE_TABS = [
  { key: 'details', label: 'Details' },
  { key: 'audit', label: 'Audit' },
  { key: 'files', label: 'Files' },
] as const;
export type PageTab = (typeof PAGE_TABS)[number]['key'];

export interface JournalEntryFormField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'date' | 'number' | 'readonly';
  required?: boolean;
  lookupKey?: keyof CrmLookups;
  placeholder?: string;
  colSpanFull?: boolean;
  rows?: number;
  hint?: string;
}

// ── Header field definitions (everything except From/To account) ────────────

export const JOURNAL_ENTRY_FIELDS: JournalEntryFormField[] = [
  { key: 'je_status', label: 'Status', type: 'readonly', placeholder: 'Draft' },
  { key: 'je_doc_num', label: 'Journal Entry #', type: 'readonly', placeholder: 'Auto-generated' },
  { key: 'amount', label: 'Amount', type: 'number', required: true, placeholder: '0.00' },
  { key: 'transfer_date', label: 'Date', type: 'date', required: true },
  { key: 'reference', label: 'Reference', type: 'text', placeholder: 'e.g. a bank memo or check number' },
  { key: 'owner_employee', label: 'Owner', type: 'select', lookupKey: 'employees' },
  { key: 'notes', label: 'Notes', type: 'textarea', placeholder: 'Additional notes…', colSpanFull: true },
  { key: 'internal_notes', label: 'Internal Notes', type: 'textarea', placeholder: 'Notes visible to your team only…', colSpanFull: true },
];

/** Create-form field set: omits the two readonly fields that mean nothing
 *  before a record exists (status always starts at Draft; the number is
 *  server-assigned on save) — shown on Edit via the full JOURNAL_ENTRY_FIELDS,
 *  where they display the record's actual values. */
export const JOURNAL_ENTRY_CREATE_FIELDS: JournalEntryFormField[] = JOURNAL_ENTRY_FIELDS.filter(
  (f) => f.key !== 'je_status' && f.key !== 'je_doc_num',
);

// ── Status catalog ────────────────────────────────────────────────────────────

export const JE_STATUS_CODES: { code: JournalEntryStatusCode; label: string }[] = [
  { code: 'DRFT', label: 'Draft' },
  { code: 'APPR', label: 'Approved' },
  { code: 'POST', label: 'Posted' },
  { code: 'CANC', label: 'Cancelled' },
  { code: 'RVSD', label: 'Reversed' },
];

export const JE_STATUS_COLORS: Record<string, string> = {
  DRFT: '#a8a29e',
  APPR: '#3b82f6',
  POST: '#22c55e',
  CANC: '#ef4444',
  RVSD: '#f97316',
};

export function jeStatusLabel(code: string): string {
  return JE_STATUS_CODES.find((s) => s.code === code)?.label ?? code;
}

/** Editing is Draft-only (cashtransfer/store_update.go). */
export const JE_EDITABLE_STATUSES = new Set<string>(['DRFT']);
/** Approve is legal from Draft only (cashtransfer/transitions.go). */
export const JE_APPROVABLE_STATUSES = new Set<string>(['DRFT']);
/** Post is Approved-only (cashtransfer/store_post.go). */
export const JE_POSTABLE_STATUSES = new Set<string>(['APPR']);
/** Reverse is Posted-only (cashtransfer/store_reverse.go). */
export const JE_REVERSIBLE_STATUSES = new Set<string>(['POST']);
/** Cancel is legal from Draft/Approved (cashtransfer/transitions.go); CANC/RVSD are terminal. */
export const JE_CANCELLABLE_STATUSES = new Set<string>(['DRFT', 'APPR']);
/** Delete is Draft-only (cashtransfer/store_update.go SoftDelete, spec AD-9). */
export const JE_DELETABLE_STATUSES = new Set<string>(['DRFT']);

// ── Payload mapping (UI form state <-> backend create/update contract) ──────

function toStr(v: unknown): string {
  return v === null || v === undefined ? '' : String(v);
}

function toNumber(v: unknown): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : 0;
}

function toIntOrNull(v: unknown): number | null {
  const s = String(v ?? '').trim();
  if (!s) return null;
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

// A bare <input type="date"> value like "2026-07-30" fails to decode
// server-side: cashtransfer.CreateInput/UpdateInput.TransferDate is a Go
// *time.Time, whose JSON unmarshaling requires full RFC3339 — a date-only
// string is rejected outright, surfaced as a generic 400 "Invalid request
// body." toRFC3339OrUndefined appends a UTC-midnight time component before
// sending; fromRFC3339DateOnly strips it back off when loading a journal
// entry into the form. Mirrors paymentForm.ts's identical helpers
// (payment.paymentDate has the same backend type).
export function toRFC3339OrUndefined(dateStr: string): string | undefined {
  return dateStr ? `${dateStr}T00:00:00Z` : undefined;
}

export function fromRFC3339DateOnly(iso: string | undefined): string {
  return iso ? iso.slice(0, 10) : '';
}

interface JournalEntryHeaderFields {
  amount: number;
  transferDate?: string;
  reference?: string;
  notes?: string;
  internalNotes?: string;
  ownerEmployeeId: number | null;
  customFields: Record<string, unknown>;
}

function toHeaderFields(
  data: Record<string, unknown>,
  customFields: Record<string, unknown>,
): JournalEntryHeaderFields {
  return {
    amount: toNumber(data.amount),
    transferDate: toRFC3339OrUndefined(toStr(data.transfer_date)),
    reference: toStr(data.reference) || undefined,
    notes: toStr(data.notes) || undefined,
    internalNotes: toStr(data.internal_notes) || undefined,
    ownerEmployeeId: toIntOrNull(data.owner_employee),
    customFields,
  };
}

/** Maps the Add form's state to the backend's `JournalEntryCreatePayload`. */
export function toCreatePayload(
  fromAccountUuid: string,
  toAccountUuid: string,
  data: Record<string, unknown>,
  customFields: Record<string, unknown> = {},
): JournalEntryCreatePayload {
  return { fromAccountUuid, toAccountUuid, ...toHeaderFields(data, customFields) };
}

/** Maps the Edit form's state to the backend's `JournalEntryUpdatePayload`. */
export function toUpdatePayload(
  fromAccountUuid: string,
  toAccountUuid: string,
  data: Record<string, unknown>,
  customFields: Record<string, unknown> = {},
  recordVersion = 0,
): JournalEntryUpdatePayload {
  return { fromAccountUuid, toAccountUuid, ...toHeaderFields(data, customFields), recordVersion };
}

/** Maps a loaded JournalEntry (GET response) back to the Edit form's header
 *  state — the inverse of toUpdatePayload. From/To accounts are returned
 *  separately since AccountPicker owns its own {id, code, name} shape. */
export function fromJournalEntry(je: JournalEntry): {
  data: Record<string, unknown>;
  customFieldValues: Record<string, unknown>;
  fromAccount: JournalEntryAccountRef;
  toAccount: JournalEntryAccountRef;
} {
  return {
    data: {
      je_status: je.status,
      je_doc_num: je.transferNumber,
      amount: je.amount,
      transfer_date: fromRFC3339DateOnly(je.transferDate),
      reference: je.reference ?? '',
      owner_employee: je.ownerEmployeeId === null ? '' : String(je.ownerEmployeeId),
      notes: je.notes ?? '',
      internal_notes: je.internalNotes ?? '',
    },
    customFieldValues: je.customFields ?? {},
    fromAccount: je.fromAccount,
    toAccount: je.toAccount,
  };
}

export function journalEntryDefaults(): Record<string, unknown> {
  const today = new Date().toISOString().split('T')[0];
  return { transfer_date: today };
}
