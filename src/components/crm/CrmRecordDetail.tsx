import { useQuery } from '@tanstack/react-query';
import { lookupService, type LookupItem } from '@/services/lookupService';
import { CRM_CORE_SECTIONS, CRM_CUSTOMER_BALANCE_SECTION, type CrmCoreField } from '@/lib/crmFields';
import { ModernSection, ModernFieldShell } from './FormPrimitives';

type Props = {
  coreFields: Record<string, unknown>;
  showCustomerBalances?: boolean;
};

/** Read-only renderer for the unified CRM core fields, used by Lead, Prospect, and Customer detail pages. */
export function CrmRecordDetail({ coreFields, showCustomerBalances }: Props) {
  const { data: lookups } = useQuery({ queryKey: ['crm-lookups'], queryFn: lookupService.getCrmLookups });

  function resolveLookup(field: CrmCoreField, value: unknown): string {
    if (!lookups || !field.lookupKey || value === null || value === undefined || value === '') return '';
    const items = lookups[field.lookupKey] as LookupItem[];
    const match = items.find((item) => String(item.id) === String(value));
    return match?.name ?? '';
  }

  function isFieldVisible(field: CrmCoreField): boolean {
    if (field.showIfFieldTrue) return Boolean(coreFields[field.showIfFieldTrue]);
    if (field.showIfFieldFalse) return !coreFields[field.showIfFieldFalse];
    return true;
  }

  function renderValue(field: CrmCoreField): string {
    const raw = coreFields[field.key];
    if (field.type === 'lookup-select') return resolveLookup(field, raw);
    if (field.type === 'checkbox') return raw === true || raw === 'true' ? 'Yes' : 'No';
    return raw ? String(raw) : '';
  }

  function renderSection(section: typeof CRM_CORE_SECTIONS[number]) {
    const visibleFields = section.fields.filter(isFieldVisible);
    if (visibleFields.length === 0) return null;
    return (
      <ModernSection key={section.title} title={section.title}>
        <div className="grid grid-cols-1 gap-x-5 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
          {visibleFields.map((field) => {
            const display = renderValue(field);
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
    );
  }

  return (
    <>
      {CRM_CORE_SECTIONS.map(renderSection)}

      {showCustomerBalances && (
        <ModernSection title={CRM_CUSTOMER_BALANCE_SECTION.title}>
          <div className="grid grid-cols-1 gap-x-5 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
            {CRM_CUSTOMER_BALANCE_SECTION.fields.map((field) => {
              const display = renderValue(field);
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
      )}
    </>
  );
}
