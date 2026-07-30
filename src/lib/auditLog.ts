import type { AuditEntry, AuditFilters, AuditQueryParams } from '@/types/audit';

/** Page size requested from the server. The endpoint caps limit at 100. */
export const AUDIT_PAGE_SIZE = 25;

/** Label shown when an entry has neither a user nor an employee to credit. */
export const UNKNOWN_ACTOR_LABEL = 'System';

/**
 * Display labels for the resource filter dropdown. Mirrors the Resource
 * constants in the backend's authz/catalog.go, plus `record_attachment` —
 * the one audit resource that isn't an RBAC resource (attachment audit rows
 * are written directly via workflow.LogAudit, not gated per-resource). This
 * is the full set of values `audit_logs.resource` can hold; keep it in sync
 * if the backend adds one.
 */
export const AUDIT_RESOURCES: { value: string; label: string }[] = [
  { value: 'lead', label: 'Lead' },
  { value: 'prospect', label: 'Prospect' },
  { value: 'customer', label: 'Customer' },
  { value: 'crm_activity', label: 'CRM Activity' },
  { value: 'user', label: 'User' },
  { value: 'role', label: 'Role' },
  { value: 'workflow', label: 'Workflow' },
  { value: 'workflow_config', label: 'Workflow Config' },
  { value: 'sso_config', label: 'SSO Configuration' },
  { value: 'audit', label: 'Audit' },
  { value: 'estimate', label: 'Estimate' },
  { value: 'quote', label: 'Quote' },
  { value: 'sales_order', label: 'Sales Order' },
  { value: 'installation', label: 'Installation' },
  { value: 'invoice', label: 'Invoice' },
  { value: 'payment', label: 'Payment' },
  { value: 'credit_memo', label: 'Credit Memo' },
  { value: 'refund', label: 'Refund' },
  { value: 'cash_transfer', label: 'Journal Entry' },
  { value: 'vendor', label: 'Vendor' },
  { value: 'requisition', label: 'Requisition' },
  { value: 'purchase_order', label: 'Purchase Order' },
  { value: 'item_receipt', label: 'Item Receipt' },
  { value: 'vendor_bill', label: 'Vendor Bill' },
  { value: 'vendor_payment', label: 'Vendor Payment' },
  { value: 'vendor_credit', label: 'Vendor Credit' },
  { value: 'expense', label: 'Expense' },
  { value: 'record_attachment', label: 'Attachment' },
];

/**
 * Display labels for the action filter dropdown. Cross-referenced against
 * every workflow.LogAudit/LogAuditFull call site in the backend (the
 * per-module *_audit.go files, crm.go, and attachments.go) — this is the
 * full set of values `audit_logs.action` can hold today.
 */
export const AUDIT_ACTIONS: { value: string; label: string }[] = [
  { value: 'create', label: 'Create' },
  { value: 'update', label: 'Update' },
  { value: 'delete', label: 'Delete' },
  { value: 'transition', label: 'Transition' },
  { value: 'approve', label: 'Approve' },
  { value: 'convert', label: 'Convert' },
  { value: 'apply', label: 'Apply' },
  { value: 'unapply', label: 'Unapply' },
  { value: 'payment', label: 'Payment' },
  { value: 'attachment.upload', label: 'Attachment Upload' },
  { value: 'attachment.download', label: 'Attachment Download' },
  { value: 'attachment.delete', label: 'Attachment Delete' },
];

/** Renders a snake_case or dot.separated resource/action token as Title Case. */
export function humanizeToken(token: string): string {
  if (!token) return token;
  return token
    .split(/[_.\s]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');
}

/** Display label for a resource value — the curated label, or a humanized fallback. */
export function resourceLabel(value: string): string {
  return AUDIT_RESOURCES.find((r) => r.value === value)?.label ?? humanizeToken(value);
}

/** Display label for an action value — the curated label, or a humanized fallback. */
export function actionLabel(value: string): string {
  return AUDIT_ACTIONS.find((a) => a.value === value)?.label ?? humanizeToken(value);
}

/**
 * Converts a `<input type="date">` value to an RFC3339 instant at the start of
 * that local day. Returns undefined for a blank or unparseable value so the
 * param is omitted rather than sent empty.
 */
export function dayStartRfc3339(day: string): string | undefined {
  return dayToRfc3339(day, 'T00:00:00.000');
}

/** As dayStartRfc3339, but the last instant of the day (the range is inclusive). */
export function dayEndRfc3339(day: string): string | undefined {
  return dayToRfc3339(day, 'T23:59:59.999');
}

function dayToRfc3339(day: string, time: string): string | undefined {
  if (!day) return undefined;
  const d = new Date(`${day}${time}`);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

/**
 * Builds the query params for one page. Blank filters are dropped so the server
 * sees no empty-string filters, and the cursor is forwarded verbatim — it is an
 * opaque keyset token and must never be constructed or mutated client-side.
 */
export function buildAuditParams(filters: AuditFilters, cursor: string): AuditQueryParams {
  const params: AuditQueryParams = { limit: AUDIT_PAGE_SIZE };
  if (filters.resource) params.resource = filters.resource;
  if (filters.action) params.action = filters.action;
  if (filters.actor) params.actor = filters.actor;
  const from = dayStartRfc3339(filters.from);
  if (from) params.from = from;
  const to = dayEndRfc3339(filters.to);
  if (to) params.to = to;
  if (cursor) params.cursor = cursor;
  return params;
}

/** True when at least one filter is active (drives the "Clear" affordance). */
export function hasActiveFilters(filters: AuditFilters): boolean {
  return Object.values(filters).some((v) => v !== '');
}

/**
 * Pulls the acting employee's id out of an entry's `details`. The v2 employee
 * path records `{"employee_id": n}` there and leaves `actor_user_id` null.
 */
export function detailsEmployeeId(details: unknown): number | null {
  if (typeof details !== 'object' || details === null) return null;
  const raw = (details as Record<string, unknown>).employee_id;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  return null;
}

/**
 * Resolves the display name for an entry's actor. Falls back through: known
 * user → employee id from details → `System`. `names` maps users.id to a human
 * label; an id missing from it (the user list may be unreadable to this caller)
 * renders as the raw id so the trail is still traceable.
 */
export function actorLabel(entry: AuditEntry, names: Record<string, string>): string {
  if (entry.actorUserId) return names[entry.actorUserId] ?? entry.actorUserId;
  const employeeId = detailsEmployeeId(entry.details);
  if (employeeId !== null) return `Employee #${employeeId}`;
  return UNKNOWN_ACTOR_LABEL;
}

/** True when the actor could only be identified by a raw id (render it as such). */
export function isRawActorId(entry: AuditEntry, names: Record<string, string>): boolean {
  return Boolean(entry.actorUserId) && !names[entry.actorUserId as string];
}

/** Human-readable local timestamp for the table's Time column. */
export function formatAuditTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/** Pretty-prints an entry's details for the expanded row. */
export function formatDetails(details: unknown): string {
  if (details === null || details === undefined) return '';
  try {
    return JSON.stringify(details, null, 2);
  } catch {
    return String(details);
  }
}
