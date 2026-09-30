import { humanizeToken } from '@/lib/auditLog';

export interface AuditFieldChange {
  field: string;
  label: string;
  from: string;
  to: string;
}

type Snapshot = Record<string, unknown>;

const EMPTY_VALUE_LABEL = '—';
const MAX_ARRAY_PREVIEW = 3;
const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

// Bookkeeping keys that change on every write or carry no meaning for a reader.
const NOISY_KEYS = new Set([
  'id',
  'tenant_id',
  'tenantId',
  'created_at',
  'createdAt',
  'updated_at',
  'updatedAt',
  'created_by',
  'createdBy',
  'updated_by',
  'updatedBy',
  'version',
]);

const isPlainObject = (v: unknown): v is Snapshot =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Pulls the `old` / `new` snapshots out of a global audit entry's `details` blob. */
export function extractSnapshots(details: unknown): { old?: Snapshot; new?: Snapshot } {
  if (!isPlainObject(details)) return {};
  const oldVal = details.old ?? details.old_value ?? details.oldValue;
  const newVal = details.new ?? details.new_value ?? details.newValue;
  return {
    old: isPlainObject(oldVal) ? oldVal : undefined,
    new: isPlainObject(newVal) ? newVal : undefined,
  };
}

function flatten(obj: Snapshot, prefix = ''): Map<string, unknown> {
  const out = new Map<string, unknown>();
  for (const [key, val] of Object.entries(obj)) {
    if (NOISY_KEYS.has(key)) continue;
    const path = prefix ? `${prefix}.${key}` : key;
    if (isPlainObject(val)) {
      flatten(val, path).forEach((v, k) => out.set(k, v));
    } else {
      out.set(path, val);
    }
  }
  return out;
}

/** Human-readable rendering of one audit value. */
export function formatAuditValue(val: unknown): string {
  if (val === null || val === undefined || val === '') return EMPTY_VALUE_LABEL;
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (typeof val === 'number') return String(val);
  if (typeof val === 'string') {
    if (ISO_DATE_TIME.test(val)) {
      const d = new Date(val);
      if (!Number.isNaN(d.getTime())) return d.toLocaleString();
    }
    return val;
  }
  if (Array.isArray(val)) {
    if (val.length === 0) return EMPTY_VALUE_LABEL;
    const shown = val.slice(0, MAX_ARRAY_PREVIEW).map(formatAuditValue).join(', ');
    return val.length > MAX_ARRAY_PREVIEW ? `${shown} (+${val.length - MAX_ARRAY_PREVIEW} more)` : shown;
  }
  return String(val);
}

/** Label for a (possibly dotted / camelCase) key, e.g. `salesTaxPercent` -> `Sales Tax Percent`. */
export function fieldLabel(path: string): string {
  const spaced = path.replace(/([a-z0-9])([A-Z])/g, '$1_$2');
  return humanizeToken(spaced);
}

/**
 * Returns only the fields whose value differs between the two snapshots.
 * Without both snapshots (a create or delete) there is nothing to compare, so
 * the result is empty rather than a dump of the whole record.
 */
export function diffSnapshots(oldVal?: Snapshot, newVal?: Snapshot): AuditFieldChange[] {
  if (!oldVal || !newVal) return [];
  const before = flatten(oldVal);
  const after = flatten(newVal);
  const keys = new Set([...before.keys(), ...after.keys()]);
  const changes: AuditFieldChange[] = [];
  for (const field of keys) {
    const a = formatAuditValue(before.get(field));
    const b = formatAuditValue(after.get(field));
    if (a === b) continue;
    changes.push({ field, label: fieldLabel(field), from: a, to: b });
  }
  return changes;
}
