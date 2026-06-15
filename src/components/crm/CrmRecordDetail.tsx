import { useQuery } from '@tanstack/react-query';
import { lookupService, type LookupItem } from '@/services/lookupService';
import { CRM_CORE_SECTIONS, type CrmCoreField } from '@/lib/crmFields';
import { ModernSection, ModernFieldShell } from './FormPrimitives';

/** Read-only renderer for the unified CRM core fields, used by Lead, Prospect, and Customer detail pages. */
export function CrmRecordDetail({ coreFields }: { coreFields: Record<string, unknown> }) {
  const { data: lookups } = useQuery({ queryKey: ['crm-lookups'], queryFn: lookupService.getCrmLookups });

  function resolveLookup(field: CrmCoreField, value: unknown): string {
    if (!lookups || !field.lookupKey || value === null || value === undefined || value === '') return '';
    const items = lookups[field.lookupKey] as LookupItem[];
    const match = items.find((item) => String(item.id) === String(value));
    return match?.name ?? '';
  }

  return (
    <>
      {CRM_CORE_SECTIONS.map((section) => (
        <ModernSection key={section.title} title={section.title}>
          <div className="grid grid-cols-1 gap-x-5 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
            {section.fields.map((field) => {
              const raw = coreFields[field.key];
              const display = field.type === 'lookup-select' ? resolveLookup(field, raw) : raw ? String(raw) : '';
              return (
                <ModernFieldShell key={field.key} label={field.label}>
                  <p className="text-xs text-stone-700 min-h-[1.25rem]">
                    {display || <span className="text-stone-300 italic">—</span>}
                  </p>
                </ModernFieldShell>
              );
            })}
          </div>
        </ModernSection>
      ))}
    </>
  );
}
