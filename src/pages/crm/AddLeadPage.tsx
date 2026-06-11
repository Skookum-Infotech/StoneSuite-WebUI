import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Sparkles, AlertCircle } from 'lucide-react';
import { crmService } from '@/services/crmService';
import { workflowService } from '@/services/tenantServices';
import { apiErrorMessage } from '@/api/tenantClient';
import { DynamicFieldInput } from '@/components/tenant/DynamicFieldInput';
import { Section, FieldShell, inputClass } from '@/components/prospect/ProspectUI';
import { PRIMARY_SECTIONS, TABS, leadDefaults } from '@/lib/leadForm';
import { cn } from '@/lib/utils';
import type { LeadField, LeadSection, LeadTab } from '@/lib/leadForm';
import type { FieldDefinition } from '@/types/tenant';

export default function AddLeadPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [data, setData] = useState<Record<string, unknown>>(leadDefaults);
  const [activeTab, setActiveTab] = useState(TABS[0]?.key ?? '');
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, unknown>>({});

  const set = (key: string, value: unknown) => setData((d) => ({ ...d, [key]: value }));

  const { data: allWorkflows = [] } = useQuery({ queryKey: ['workflows'], queryFn: workflowService.list });
  const leadWorkflow = allWorkflows.find((wf) => wf.key.toLowerCase() === 'lead');
  const { data: leadDef } = useQuery({
    queryKey: ['workflow', leadWorkflow?.id],
    queryFn: () => workflowService.get(leadWorkflow!.id),
    enabled: Boolean(leadWorkflow?.id),
  });
  const customFieldDefs: FieldDefinition[] = leadDef?.fields ?? [];

  const { mutate: createLead, isPending, error: createError } = useMutation({
    mutationFn: () =>
      crmService.createRecord('lead', { coreFields: data, customFields: customFieldValues }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-records', 'lead'] });
      navigate('/crm/lead');
    },
  });

  const activeTabObj = TABS.find((t) => t.key === activeTab) ?? TABS[0];

  return (
    <div className="flex-1 flex flex-col bg-stone-50 min-h-0">
      <form onSubmit={(e) => { e.preventDefault(); createLead(); }} className="flex flex-col flex-1">

        {/* Sticky header */}
        <div className="bg-white border-b border-stone-200 px-6 py-3 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center gap-1 rounded bg-brand px-3 py-1.5 text-xs font-semibold text-stone-950 hover:bg-brand-hover disabled:opacity-50 transition-colors"
            >
              {isPending ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/crm/lead')}
              disabled={isPending}
              className="rounded border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold text-stone-600 hover:bg-stone-50 disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
            {createError && (
              <div className="flex items-center gap-1.5 rounded border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs text-red-700">
                <AlertCircle className="size-3.5 shrink-0" />
                {apiErrorMessage(createError, 'Failed to save lead.')}
              </div>
            )}
          </div>
          <nav className="hidden sm:flex items-center gap-1 text-xs text-stone-400 font-medium">
            <span>CRM</span><span>/</span><span>Lead</span><span>/</span>
            <span className="text-stone-700 font-semibold">New Lead</span>
          </nav>
        </div>

        {/* Page title */}
        <div className="bg-white border-b border-stone-100 px-6 py-2 flex items-center gap-2">
          <div className="h-5 w-5 rounded bg-purple-100 flex items-center justify-center">
            <Sparkles className="h-3 w-3 text-purple-600" />
          </div>
          <h1 className="text-sm font-bold text-stone-800">Lead</h1>
        </div>

        {/* Form body */}
        <div className="flex-1 overflow-y-auto modal-scrollbar px-6 py-4 space-y-3">
          {PRIMARY_SECTIONS.map((section) => (
            <LeadSectionFields key={section.title} section={section} data={data} set={set} />
          ))}

          <div className="rounded border border-stone-200 bg-white overflow-hidden">
            <LeadTabBar tabs={TABS} active={activeTabObj.key} onSelect={setActiveTab} />
            <div className="px-4 py-4">
              {activeTabObj.sections.length > 0 ? (
                <div className="space-y-3">
                  {activeTabObj.sections.map((section) => (
                    <LeadSectionFields key={section.title} section={section} data={data} set={set} />
                  ))}
                </div>
              ) : (
                <p className="text-xs text-stone-400 py-4 text-center">
                  {activeTabObj.label} information will be available after the lead is created.
                </p>
              )}
            </div>
          </div>

          {customFieldDefs.length > 0 && (
            <Section title="Custom Fields">
              <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                {customFieldDefs.map((f) => (
                  <DynamicFieldInput
                    key={f.id || f.key}
                    field={f}
                    value={customFieldValues[f.key]}
                    onChange={(key, value) =>
                      setCustomFieldValues((prev) => ({ ...prev, [key]: value }))
                    }
                  />
                ))}
              </div>
            </Section>
          )}
        </div>
      </form>
    </div>
  );
}

export function LeadSectionFields({
  section,
  data,
  set,
}: {
  section: LeadSection;
  data: Record<string, unknown>;
  set: (key: string, value: unknown) => void;
}) {
  const visible = section.fields.filter(
    (f) => !f.showWhen || data[f.showWhen.key] === f.showWhen.value,
  );
  return (
    <Section title={section.title}>
      <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((f) => (
          <LeadFieldInput key={f.key} field={f} value={data[f.key]} set={set} />
        ))}
      </div>
    </Section>
  );
}

export function LeadFieldInput({
  field,
  value,
  set,
}: {
  field: LeadField;
  value: unknown;
  set: (key: string, value: unknown) => void;
}) {
  const str = typeof value === 'string' ? value : '';

  if (field.type === 'type_toggle') {
    return (
      <div className="sm:col-span-2 lg:col-span-3">
        <FieldShell label={field.label} required={field.required}>
          <div className="flex items-center gap-4 pt-0.5">
            {field.options?.map((opt) => (
              <label key={opt} className="flex items-center gap-1.5 text-xs text-stone-600 cursor-pointer">
                <input
                  type="radio"
                  name={field.key}
                  value={opt}
                  checked={value === opt}
                  onChange={() => set(field.key, opt)}
                  className="accent-blue-600"
                  aria-label={opt}
                />
                {opt.toUpperCase()}
              </label>
            ))}
          </div>
        </FieldShell>
      </div>
    );
  }

  if (field.type === 'checkbox') {
    return (
      <label className="flex items-center gap-2 self-end pb-1.5 cursor-pointer">
        <input
          type="checkbox"
          checked={value === true}
          onChange={(e) => set(field.key, e.target.checked)}
          className="size-3.5 rounded border-stone-300 accent-brand"
          aria-label={field.label}
        />
        <span className="text-label font-semibold text-stone-600">{field.label}</span>
      </label>
    );
  }

  return (
    <FieldShell label={field.label} required={field.required}>
      {field.type === 'textarea' ? (
        <textarea
          rows={3}
          required={field.required}
          value={str}
          onChange={(e) => set(field.key, e.target.value)}
          className={`${inputClass} resize-none`}
          aria-label={field.label}
        />
      ) : field.type === 'select' ? (
        <select
          required={field.required}
          value={str}
          onChange={(e) => set(field.key, e.target.value)}
          className={inputClass}
          aria-label={field.label}
        >
          {field.options?.map((opt) => (
            <option key={opt} value={opt}>
              {opt || '— Select —'}
            </option>
          ))}
        </select>
      ) : (
        <input
          type={field.type === 'number' ? 'number' : field.type ?? 'text'}
          required={field.required}
          readOnly={field.readOnly}
          placeholder={field.placeholder}
          value={str}
          onChange={(e) => set(field.key, e.target.value)}
          className={inputClass}
          aria-label={field.label}
        />
      )}
    </FieldShell>
  );
}

export function LeadTabBar({
  tabs,
  active,
  onSelect,
}: {
  tabs: LeadTab[];
  active: string;
  onSelect: (key: string) => void;
}) {
  return (
    <div className="flex overflow-x-auto modal-scrollbar border-b border-stone-200 bg-stone-50">
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          onClick={() => onSelect(t.key)}
          aria-pressed={active === t.key}
          className={cn(
            'px-4 py-2.5 text-label font-semibold whitespace-nowrap border-b-2 transition-colors',
            active === t.key
              ? 'border-brand text-stone-800 bg-white'
              : 'border-transparent text-stone-500 hover:text-stone-700 hover:bg-stone-100',
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
