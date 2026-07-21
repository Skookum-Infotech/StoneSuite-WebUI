import { tenantClient } from '@/api/tenantClient';
import type { AuditEntry, AuditPage, AuditQueryParams } from '@/types/audit';

// Tenant-wide audit log browser — GET /api/tenant/audit. See types/audit.ts
// for the shape and the invariants the UI must respect (opaque cursor,
// server-side scope narrowing, newest-first ordering).

interface AuditEntryWire {
  id: string;
  actor_user_id: string | null;
  action: string;
  resource: string;
  resource_id: string;
  details: unknown;
  created_at: string;
}

function mapEntry(w: AuditEntryWire): AuditEntry {
  return {
    id: w.id,
    actorUserId: w.actor_user_id,
    action: w.action,
    resource: w.resource,
    resourceId: w.resource_id,
    details: w.details,
    createdAt: w.created_at,
  };
}

export const auditService = {
  list: (params: AuditQueryParams): Promise<AuditPage> =>
    tenantClient
      .get<{ success: boolean; entries: AuditEntryWire[] | null; next_cursor: string }>(
        '/tenant/audit',
        { params },
      )
      .then((r) => ({
        entries: (r.data.entries ?? []).map(mapEntry),
        nextCursor: r.data.next_cursor ?? '',
      })),
};
