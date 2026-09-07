import type { FieldDefinition, FieldType } from '@/types/tenant';
import type { ImportColumnMapping, ImportMappedFields } from '@/types/import';

// Same "core:"/"cf:" namespace convention as the backend's
// stonesuite-backend/importer package (importer.go's corePrefix/cfPrefix) —
// keep these in sync with that file.
export const CORE_PREFIX = 'core:';
export const CF_PREFIX = 'cf:';

export const IGNORE_TARGET = '';

/** Mirrors importer.coerceCustomValue (importer/mapping.go): coerce one raw
 *  cell's text to the Go type workflow.ValidateCustomFields expects for a
 *  number/bool custom field. Left as the raw string for every other type, or
 *  when parsing fails — the backend's own validation then reports the
 *  specific "must be a number"/"must be true or false" message. */
function coerceCustomValue(dataType: FieldType | undefined, raw: string): unknown {
  if (raw.trim() === '') return raw;
  if (dataType === 'number') {
    const n = Number(raw);
    if (!Number.isNaN(n) && raw.trim() !== '') return n;
  }
  if (dataType === 'bool') {
    const lower = raw.trim().toLowerCase();
    if (lower === 'true' || lower === '1') return true;
    if (lower === 'false' || lower === '0') return false;
  }
  return raw;
}

/** Mirrors importer.ApplyColumnMapping (importer/mapping.go): turn one
 *  staged row's raw column->text data into core/custom fields using mapping
 *  (column header -> "core:<key>" | "cf:<key>" | "" to ignore). Run
 *  client-side during the review step, since the review UI is the only place
 *  a column mapping is chosen (see importer/worker.go's stageTabular, which
 *  only applies a mapping supplied upfront at job-creation time). */
export function applyColumnMapping(
  raw: Record<string, string>,
  mapping: ImportColumnMapping,
  fieldDefs: FieldDefinition[],
): ImportMappedFields {
  const defByKey = new Map(fieldDefs.map((d) => [d.key, d]));
  const out: ImportMappedFields = { core: {}, custom: {} };
  for (const [col, val] of Object.entries(raw)) {
    const target = mapping[col];
    if (!target) continue;
    if (target.startsWith(CORE_PREFIX)) {
      out.core[target.slice(CORE_PREFIX.length)] = val;
    } else if (target.startsWith(CF_PREFIX)) {
      const key = target.slice(CF_PREFIX.length);
      out.custom[key] = coerceCustomValue(defByKey.get(key)?.dataType, val);
    }
  }
  return out;
}

/** The distinct raw column headers across a batch of staged rows — a row's
 *  own keys can vary slightly, so union across all of them rather than
 *  trusting the first row alone. */
export function collectRawColumns(rows: Array<{ raw: Record<string, string> }>): string[] {
  const seen = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row.raw)) seen.add(key);
  }
  return [...seen];
}
