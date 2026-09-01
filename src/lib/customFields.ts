import type { FieldDefinition, WorkflowDefinition } from '@/types/tenant';

/**
 * The custom field definitions to actually render/use for a workflow: `[]`
 * unless the workflow's Custom Fields section is switched on
 * (`workflow.customFieldsEnabled`). Field definitions can exist (and hold
 * data) while the section is off -- see workflow/validate.go on the backend
 * -- so this is the single place that decides what the UI shows, rather than
 * every consumer re-checking `def?.workflow.customFieldsEnabled` itself.
 */
export function activeCustomFields(def?: WorkflowDefinition): FieldDefinition[] {
  if (!def?.workflow.customFieldsEnabled) return [];
  return def.fields;
}

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
