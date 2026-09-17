import { CRM_CORE_SECTIONS, type CrmCoreField } from './crmFields';
import type { FieldDefinition } from '@/types/tenant';

export interface CrmFieldError {
  key: string;
  label: string;
}

function isVisible(field: CrmCoreField, values: Record<string, unknown>): boolean {
  if (field.showIfFieldTrue) return Boolean(values[field.showIfFieldTrue]);
  if (field.showIfFieldFalse) return !values[field.showIfFieldFalse];
  return true;
}

/** True when a `type: 'number'` field's value is present but invalid: not a
 *  finite number, or outside the field's declared min/max. Checked
 *  independently of `required` — an optional field like Credit Limit must
 *  still be a sane number when the user does fill it in. */
function isOutOfRange(field: CrmCoreField, val: unknown): boolean {
  if (field.type !== 'number' || val === undefined || val === null || val === '') return false;
  const n = typeof val === 'number' ? val : Number(val);
  if (!Number.isFinite(n)) return true;
  if (field.min !== undefined && n < field.min) return true;
  if (field.max !== undefined && n > field.max) return true;
  return false;
}

export function validateCrmRecord(
  coreFields: Record<string, unknown>,
  customDefs: FieldDefinition[],
  customValues: Record<string, unknown>,
): CrmFieldError[] {
  const errors: CrmFieldError[] = [];
  for (const section of CRM_CORE_SECTIONS) {
    for (const field of section.fields) {
      if (!isVisible(field, coreFields)) continue;
      const val = coreFields[field.key];
      const missingRequired = field.required && (val === undefined || val === null || val === '');
      if (missingRequired || isOutOfRange(field, val)) {
        errors.push({ key: field.key, label: field.label });
      }
    }
  }
  for (const def of customDefs) {
    if (!def.required) continue;
    const val = customValues[def.key];
    if (val === undefined || val === null || val === '') {
      errors.push({ key: def.key, label: def.label });
    }
  }
  return errors;
}
