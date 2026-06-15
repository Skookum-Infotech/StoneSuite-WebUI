import { useQuery } from '@tanstack/react-query';
import { lookupService, type LookupItem } from '@/services/lookupService';
import { CRM_CORE_SECTIONS, type CrmCoreField } from '@/lib/crmFields';
import { ModernSection, ModernFieldShell, fieldCls } from './FormPrimitives';
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
  users: WorkspaceUser[];
};

type Props = {
  core: CoreProps;
  custom: CustomProps;
  statusNode?: React.ReactNode;
  owner?: OwnerProps;
};

/** Shared editable form for the unified CRM core fields, used by Lead, Prospect, and Customer Add/Edit pages. */
export function CrmRecordForm({ core, custom, statusNode, owner }: Props) {
  const { data: lookups } = useQuery({ queryKey: ['crm-lookups'], queryFn: lookupService.getCrmLookups });

  const fieldStr = (key: string) => String(core.fields[key] ?? '');

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
        <ModernSection key={section.title} title={section.title}>
          <div className="grid grid-cols-1 gap-x-5 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
            {idx === 0 && statusNode && (
              <ModernFieldShell label="Status" required>
                {statusNode}
              </ModernFieldShell>
            )}
            {idx === 0 && owner && (
              <ModernFieldShell label="Owner">
                <select
                  value={owner.userId}
                  onChange={(e) => owner.onChange(e.target.value)}
                  className={fieldCls}
                  aria-label="Owner"
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
            {section.fields.map((field) => (
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
      ))}

      {custom.defs.length > 0 && (
        <ModernSection title="Custom Fields">
          <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
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

  if (field.type === 'textarea') {
    return (
      <div className="sm:col-span-2 lg:col-span-3">
        <ModernFieldShell label={field.label} required={field.required}>
          <textarea
            rows={3}
            required={field.required}
            value={str}
            onChange={(e) => onChange(field.key, e.target.value)}
            className={`${fieldCls} resize-none`}
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
