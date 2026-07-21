// Tenant-wide audit log browser — GET /api/tenant/audit.
//
// The endpoint is a keyset-paginated read model over `audit_logs`, gated on
// audit:read and already narrowed server-side to what the caller may see. Two
// consequences for the UI: entries arrive newest-first and must be rendered in
// the order returned, and no client-side filtering is needed or wanted.

/** One audit-log row. */
export interface AuditEntry {
  id: string;
  /**
   * Null for actions taken through the v2 employee path — those carry the
   * acting employee's id inside `details` instead. Never render this blank.
   */
  actorUserId: string | null;
  action: string;
  resource: string;
  resourceId: string;
  details: unknown;
  createdAt: string;
}

/** The filter form's state. Blank means "not filtering on this". */
export interface AuditFilters {
  resource: string;
  action: string;
  /** A tenant users.id, matched exactly server-side. */
  actor: string;
  /** Local calendar days (yyyy-mm-dd) from `<input type="date">`, inclusive. */
  from: string;
  to: string;
}

export const EMPTY_AUDIT_FILTERS: AuditFilters = {
  resource: '',
  action: '',
  actor: '',
  from: '',
  to: '',
};

/** One page of entries plus the cursor for the next one ('' = last page). */
export interface AuditPage {
  entries: AuditEntry[];
  nextCursor: string;
}

/** Query params accepted by the endpoint. `cursor` is opaque — pass through only. */
export interface AuditQueryParams {
  resource?: string;
  action?: string;
  actor?: string;
  from?: string;
  to?: string;
  limit?: number;
  cursor?: string;
}
