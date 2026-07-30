import { tenantClient } from '@/api/tenantClient';
import type { AuditEntry } from '@/services/crmService';
import type {
  JournalEntry,
  JournalEntryCreatePayload,
  JournalEntryUpdatePayload,
  JournalEntrySearchRequest,
  JournalEntryPage,
} from '@/types/journalEntry';

// Journal Entry API wrapper. Talks to the dedicated relational module under
// `/api/tenant/finance/cash-transfers*` (the backend still calls this module
// "cash transfer" — mirrors itemReceiptService.ts). Every call carries the
// tenant Bearer JWT via `tenantClient`; the server enforces tenancy, RBAC
// (`cash_transfer:*`), scope, and IDOR.
const BASE = '/tenant/finance/cash-transfers';

function toPage(data: {
  records?: JournalEntry[] | null; nextCursor?: string; hasMore?: boolean; scope?: string;
}): JournalEntryPage {
  return {
    records: data.records ?? [],
    nextCursor: data.nextCursor ?? '',
    hasMore: Boolean(data.hasMore),
    scope: data.scope ?? '',
  };
}

export const journalEntryService = {
  // Full filter + sort + global search (number/reference/notes) + keyset
  // pagination. Cursors are opaque — pass back what the server returned,
  // never construct one.
  searchJournalEntries: (req: JournalEntrySearchRequest): Promise<JournalEntryPage> =>
    tenantClient
      .post<{ success: boolean; scope: string; records: JournalEntry[] | null; nextCursor: string; hasMore: boolean }>(
        `${BASE}/search`,
        req,
      )
      .then((r) => toPage(r.data)),

  getJournalEntry: (uuid: string): Promise<JournalEntry> =>
    tenantClient
      .get<{ success: boolean; cashTransfer: JournalEntry }>(`${BASE}/${uuid}`)
      .then((r) => r.data.cashTransfer),

  createJournalEntry: (payload: JournalEntryCreatePayload): Promise<JournalEntry> =>
    tenantClient
      .post<{ success: boolean; cashTransfer: JournalEntry }>(BASE, payload)
      .then((r) => r.data.cashTransfer),

  // Draft-only server-side. Always send `recordVersion` (the version last
  // read) — a stale version 409s rather than silently overwriting a
  // concurrent edit.
  updateJournalEntry: (uuid: string, payload: JournalEntryUpdatePayload): Promise<JournalEntry> =>
    tenantClient
      .patch<{ success: boolean; cashTransfer: JournalEntry }>(`${BASE}/${uuid}`, payload)
      .then((r) => r.data.cashTransfer),

  // Draft-only soft delete server-side.
  deleteJournalEntry: (uuid: string): Promise<void> =>
    tenantClient.delete(`${BASE}/${uuid}`).then(() => undefined),

  // Approve (Draft -> Approved) or Cancel (Draft/Approved -> Cancelled) — the
  // generic status endpoint. Post and Reverse are dedicated endpoints below;
  // this one refuses those two target codes server-side.
  transition: (uuid: string, toStatusCode: 'APPR' | 'CANC'): Promise<JournalEntry> =>
    tenantClient
      .post<{ success: boolean; cashTransfer: JournalEntry }>(`${BASE}/${uuid}/transition`, { toStatusCode })
      .then((r) => r.data.cashTransfer),

  // The act that moves money: creates a balanced journal entry and updates
  // both accounts' running balances. Approved-only server-side; a 409 here
  // can mean already posted, or the accounting period is closed.
  post: (uuid: string): Promise<JournalEntry> =>
    tenantClient
      .post<{ success: boolean; cashTransfer: JournalEntry }>(`${BASE}/${uuid}/post`, {})
      .then((r) => r.data.cashTransfer),

  // Creates a reversing journal entry and restores both accounts' balances.
  // Posted-only server-side.
  reverse: (uuid: string): Promise<JournalEntry> =>
    tenantClient
      .post<{ success: boolean; cashTransfer: JournalEntry }>(`${BASE}/${uuid}/reverse`, {})
      .then((r) => r.data.cashTransfer),

  getAudit: (uuid: string): Promise<AuditEntry[]> =>
    tenantClient
      .get<{ success: boolean; recordId: string; audit: AuditEntry[] }>(`${BASE}/${uuid}/audit`)
      .then((r) => r.data.audit ?? []),
};
