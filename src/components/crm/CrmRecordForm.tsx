import { useQuery } from '@tanstack/react-query';
import { lookupService, type LookupItem } from '@/services/lookupService';
import { CRM_CORE_SECTIONS, CRM_CUSTOMER_BALANCE_SECTION, type CrmCoreField } from '@/lib/crmFields';
import { ModernSection, ModernFieldShell } from './FormPrimitives';
import { fieldCls, textareaCls, readonlyCls, checkboxLabelCls } from './formUtils';
import { DynamicFieldInput } from '@/components/tenant/DynamicFieldInput';
import type { FieldDefinition, WorkspaceUser } from '@/types/tenant';

type CoreProps = {
  fields: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
};

type CustomProps = {
  defs: FieldDefinition[];
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
};

type OwnerProps = {
  userId: string;
  onChange: (userId: string) => void;
  users: WorkspaceUser[]; // used for the CRM Account Owner select (not core field registry)
};

type Props = {
  core: CoreProps;
  custom: CustomProps;
  statusNode?: React.ReactNode;
  owner?: OwnerProps;
  showCustomerBalances?: boolean;
};

/** Shared editable form for the unified CRM core fields, used by Lead, Prospect, and Customer Add/Edit pages. */
export function CrmRecordForm({ core, custom, statusNode, owner, showCustomerBalances }: Props) {
  const { data: lookups } = useQuery({ queryKey: ['crm-lookups'], queryFn: lookupService.getCrmLookups });

  const fieldStr = (key: string) => String(core.fields[key] ?? '');

  function isFieldVisible(field: CrmCoreField): boolean {
    if (field.showIfFieldTrue) {
      return Boolean(core.fields[field.showIfFieldTrue]);
    }
    if (field.showIfFieldFalse) {
      return !core.fields[field.showIfFieldFalse];
    }
    return true;
  }

  function lookupOptions(field: CrmCoreField): LookupItem[] {
    if (!lookups || !field.lookupKey) return [];
    const items = lookups[field.lookupKey] as Array<LookupItem & { countryId?: number }>;
    if (field.dependsOn) {
      const parentValue = fieldStr(field.dependsOn);
      if (!parentValue) return [];
      return items.filter((item) => String(item.countryId ?? '') === parentValue);
    }
    return items;
  }

  return (
    <>
      {CRM_CORE_SECTIONS.map((section, idx) => (
        <ModernSection
          key={section.title}
          title={section.title}
          index={idx + 1}
          defaultCollapsed={idx > 0}
        >
          <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            {idx === 0 && statusNode && (
              <ModernFieldShell label="Status" required>
                {statusNode}
              </ModernFieldShell>
            )}
            {idx === 0 && owner && (
              <ModernFieldShell label="CRM Account Owner">
                <select
                  value={owner.userId}
                  onChange={(e) => owner.onChange(e.target.value)}
                  className={fieldCls}
                  aria-label="CRM Account Owner"
                >
                  <option value="">— Unassigned —</option>
                  {owner.users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.fullName || u.email}
                    </option>
                  ))}
                </select>
              </ModernFieldShell>
            )}
            {section.fields.map((field) => {
              if (!isFieldVisible(field)) return null;
              return (
                <CrmFieldInput
                  key={field.key}
                  field={field}
                  value={core.fields[field.key]}
                  onChange={core.onChange}
                  options={lookupOptions(field)}
                />
              );
            })}
          </div>
        </ModernSection>
      ))}

      {showCustomerBalances && (
        <ModernSection title={CRM_CUSTOMER_BALANCE_SECTION.title} index={CRM_CORE_SECTIONS.length + 1} defaultCollapsed>
          <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            {CRM_CUSTOMER_BALANCE_SECTION.fields.map((field) => (
              <CrmFieldInput
                key={field.key}
                field={field}
                value={core.fields[field.key]}
                onChange={core.onChange}
                options={lookupOptions(field)}
              />
            ))}
          </div>
        </ModernSection>
      )}

      {custom.defs.length > 0 && (
        <ModernSection title="Custom Fields" index={CRM_CORE_SECTIONS.length + (showCustomerBalances ? 2 : 1)} defaultCollapsed>
          <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            {custom.defs.map((f) => (
              <DynamicFieldInput
                key={f.id || f.key}
                field={f}
                value={custom.values[f.key]}
                onChange={custom.onChange}
              />
            ))}
          </div>
        </ModernSection>
      )}
    </>
  );
}

function CrmFieldInput({
  field,
  value,
  onChange,
  options,
}: {
  field: CrmCoreField;
  value: unknown;
  onChange: (key: string, value: unknown) => void;
  options: LookupItem[];
}) {
  const str = typeof value === 'string' ? value : value === null || value === undefined ? '' : String(value);
  const checked = value === true || value === 'true';

  if (field.type === 'checkbox') {
    return (
      <div className="col-span-full flex items-center gap-3 py-2.5">
        <input
          type="checkbox"
          id={field.key}
          checked={checked}
          onChange={(e) => onChange(field.key, e.target.checked)}
          className="h-5 w-5 rounded border-stone-300 accent-brand cursor-pointer shrink-0"
          aria-label={field.label}
        />
        <label
          htmlFor={field.key}
          className={`${checkboxLabelCls} cursor-pointer select-none hover:text-stone-900 transition-colors flex-1`}
        >
          {field.label}
          {field.required && <span className="ml-0.5 text-red-400">*</span>}
        </label>
      </div>
    );
  }

  if (field.type === 'readonly') {
    return (
      <ModernFieldShell label={field.label}>
        <div className={`${readonlyCls} cursor-not-allowed select-none`}>
          {str || '—'}
        </div>
      </ModernFieldShell>
    );
  }

  if (field.type === 'textarea') {
    return (
      <div className="col-span-full">
        <ModernFieldShell label={field.label} required={field.required}>
          <textarea
            rows={4}
            required={field.required}
            value={str}
            onChange={(e) => onChange(field.key, e.target.value)}
            className={textareaCls}
            aria-label={field.label}
            placeholder={field.placeholder}
          />
        </ModernFieldShell>
      </div>
    );
  }

  if (field.type === 'address') {
    return (
      <div className="sm:col-span-2">
        <ModernFieldShell label={field.label} required={field.required}>
          <textarea
            rows={2}
            required={field.required}
            value={str}
            onChange={(e) => onChange(field.key, e.target.value)}
            className={textareaCls}
            aria-label={field.label}
            placeholder={field.placeholder}
          />
        </ModernFieldShell>
      </div>
    );
  }

  if (field.type === 'lookup-select') {
    return (
      <ModernFieldShell label={field.label} required={field.required}>
        <select
          required={field.required}
          value={str}
          onChange={(e) => onChange(field.key, e.target.value)}
          className={fieldCls}
          aria-label={field.label}
        >
          <option value="">— Select —</option>
          {options.map((opt) => (
            <option key={opt.id} value={String(opt.id)}>
              {opt.name}
            </option>
          ))}
        </select>
      </ModernFieldShell>
    );
  }

  // text, email, tel, date, number
  return (
    <ModernFieldShell label={field.label} required={field.required}>
      <input
        type={field.type}
        required={field.required}
        value={str}
        onChange={(e) => onChange(field.key, e.target.value)}
        className={fieldCls}
        aria-label={field.label}
        placeholder={field.placeholder}
      />
    </ModernFieldShell>
  );
}
