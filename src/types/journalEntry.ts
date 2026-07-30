// Journal Entry (Finance) — frontend contract types.
//
// Mirrors the dedicated relational backend module, which internally is named
// `cashtransfer` (`StoneSuite-Backend/cashtransfer/types.go`,
// `docs/superpowers/specs/2026-07-28-cash-transfer-design.md`) and served
// from `/api/tenant/finance/cash-transfers*`. The frontend calls this
// "Journal Entry" throughout — it's the user-facing feature that moves money
// between two of the tenant's own Bank/Cash accounts and posts a real ledger
// entry, following the same v2 conventions as Item Receipt/Payment: hybrid
// PK, employee-based audit, soft delete, `recordVersion`, RBAC/scope/IDOR,
// the `query/` filter engine, keyset pagination.
import type { FilterClause, SortKey } from '@/types/tenant';

/** `lkp_record_status` codes for the CTRF record type. */
export type JournalEntryStatusCode = 'DRFT' | 'APPR' | 'POST' | 'CANC' | 'RVSD';

export interface JournalEntryAccountRef {
  id: string; // coa_account uuid
  code: string;
  name: string;
}

// ── Create / update inputs (client -> server) ────────────────────────────────

/** Shared header fields for create and update. */
export interface JournalEntryFields {
  fromAccountUuid: string;
  toAccountUuid: string;
  amount: number;
  transferDate?: string; // ISO date "yyyy-mm-dd" — defaults to CURRENT_DATE server-side
  reference?: string;
  notes?: string;
  internalNotes?: string;
  ownerEmployeeId?: number | null;
  customFields?: Record<string, unknown>;
}

export type JournalEntryCreatePayload = JournalEntryFields;

/** Update is Draft-only server-side. `recordVersion` opts into optimistic
 *  concurrency — send back the version you last read; a stale value 409s
 *  ("This cash transfer was changed by someone else"). Omitting it (or
 *  sending 0) means last-write-wins with no protection. */
export interface JournalEntryUpdatePayload extends JournalEntryFields {
  recordVersion: number;
}

// ── Responses (server -> client) ─────────────────────────────────────────────

export interface JournalEntry {
  id: string;
  transferNumber: string; // e.g. "JE-000001" — the backend's actual JSON key (cashtransfer.CashTransfer.Number, tagged `json:"transferNumber"`)

  status: string; // human label, e.g. "Draft"
  statusCode: JournalEntryStatusCode;

  transferDate: string;

  fromAccount: JournalEntryAccountRef;
  toAccount: JournalEntryAccountRef;

  amount: number;
  reference: string;

  notes: string;
  internalNotes: string;

  ownerEmployeeId: number | null;

  customFields: Record<string, unknown>;

  journalEntryId?: string;
  reversalJournalEntryId?: string;
  postedAt?: string;
  reversedAt?: string;

  createdAt: string;
  updatedAt: string;
  recordVersion: number;
}

// ── Search / list (server-side Record Filter Engine) ─────────────────────────
// Sortable fields: created_at, updated_at, document_number/record_number,
// transfer_date, amount, status (cashtransfer/resolver.go sortFields).
// Pagination is keyset: cursors are opaque, pass back only what the server
// returned.

export interface JournalEntrySearchRequest {
  filters?: FilterClause[];
  sort?: SortKey[];
  search?: string;
  limit?: number;
  cursor?: string;
}

export interface JournalEntryPage {
  records: JournalEntry[];
  nextCursor: string;
  hasMore: boolean;
  scope: string;
}
