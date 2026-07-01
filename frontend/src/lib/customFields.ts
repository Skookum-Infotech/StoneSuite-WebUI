import type { FieldDefinition } from '@/types/tenant';

/** Coerces raw form values into the JSON shapes the workflow API expects. */
export function coerceCustomFields(
  fields: FieldDefinition[],
  raw: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    const v = raw[f.key];
    if (v === undefined || v === '' || v === null) continue;
    if (f.dataType === 'number') {
      const n = Number(v);
      out[f.key] = Number.isNaN(n) ? v : n;
    } else if (f.dataType === 'bool') {
      out[f.key] = Boolean(v);
    } else {
      out[f.key] = v;
    }
  }
  return out;
}
