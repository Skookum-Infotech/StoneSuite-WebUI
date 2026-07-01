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

export function validateCrmRecord(
  coreFields: Record<string, unknown>,
  customDefs: FieldDefinition[],
  customValues: Record<string, unknown>,
): CrmFieldError[] {
  const errors: CrmFieldError[] = [];
  for (const section of CRM_CORE_SECTIONS) {
    for (const field of section.fields) {
      if (!field.required || !isVisible(field, coreFields)) continue;
      const val = coreFields[field.key];
      if (val === undefined || val === null || val === '') {
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
