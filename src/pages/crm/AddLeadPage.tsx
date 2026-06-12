import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import {
  Sparkles, AlertCircle, Loader2, Building2, User,
  Save, X,
} from 'lucide-react';
import { crmService } from '@/services/crmService';
import { workflowService } from '@/services/tenantServices';
import { apiErrorMessage } from '@/api/tenantClient';
import { DynamicFieldInput } from '@/components/tenant/DynamicFieldInput';
import { PRIMARY_SECTIONS, TABS, leadDefaults } from '@/lib/leadForm';
import { cn } from '@/lib/utils';
import type { LeadField, LeadSection, LeadTab } from '@/lib/leadForm';
import type { FieldDefinition } from '@/types/tenant';

export const fieldCls =
  'w-full rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs text-stone-800 outline-none placeholder:text-stone-300 focus:border-stone-400 focus:ring-2 focus:ring-stone-900/5 transition-all duration-150 disabled:bg-stone-50 disabled:text-stone-400 hover:border-stone-300';

const SECTION_ACCENTS: Record<string, string> = {
  'Primary Information': 'bg-purple-400',
  'Email | Phone | Address': 'bg-blue-400',
  'Classification': 'bg-amber-400',
  'Qualification': 'bg-emerald-400',
};

export function ModernSection({ title, children }: { title: string; children: React.ReactNode }) {
  const accent = SECTION_ACCENTS[title] ?? 'bg-stone-400';
  return (
    <div className="rounded-xl border border-stone-200 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center gap-2.5 px-5 py-3 border-b border-stone-100">
        <div className={cn('w-1 h-4 rounded-full shrink-0', accent)} />
        <h3 className="text-xs font-semibold text-stone-700">{title}</h3>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

export function ModernFieldShell({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="block text-2xs font-medium text-stone-500 leading-none">
        {label}
        {required && <span className="ml-0.5 text-red-400">*</span>}
      </label>
      {children}
    </div>
  );
}

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

  const displayName =
    data.type === 'Individual'
      ? [data.first_name, data.last_name].filter(Boolean).join(' ')
      : (data.company_name as string) ?? '';

  return (
    <div className="flex flex-1 min-h-0 bg-stone-50">
      <form
        onSubmit={(e) => { e.preventDefault(); createLead(); }}
        className="flex flex-1 min-h-0 min-w-0"
      >
        {/* ── Left: scrollable form ── */}
        <div className="flex flex-col flex-1 min-h-0 min-w-0">

          {/* Page title */}
          <div className="shrink-0 bg-white border-b border-stone-100 px-6 py-3.5 flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-purple-100 flex items-center justify-center shrink-0">
              <Sparkles className="h-4 w-4 text-purple-600" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-stone-800 leading-tight">New Lead</h1>
              <p className="text-2xs text-stone-400 mt-0.5">Fill in the details to create a lead record</p>
            </div>
          </div>

          {/* Scrollable form body */}
          <div className="flex-1 overflow-y-auto modal-scrollbar px-6 py-5 space-y-4">
            {PRIMARY_SECTIONS.map((section) => (
              <LeadSectionFields key={section.title} section={section} data={data} set={set} />
            ))}

            {/* Tab panel */}
            <div className="rounded-xl border border-stone-200 bg-white shadow-sm overflow-hidden">
              <LeadTabBar tabs={TABS} active={activeTabObj.key} onSelect={setActiveTab} />
              <div className="px-5 py-4">
                {activeTabObj.sections.length > 0 ? (
                  <div className="space-y-4">
                    {activeTabObj.sections.map((section) => (
                      <LeadSectionFields key={section.title} section={section} data={data} set={set} />
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2 py-6">
                    <div className="h-1.5 w-1.5 rounded-full bg-stone-300" />
                    <p className="text-xs text-stone-400">
                      {activeTabObj.label} details will be available after saving
                    </p>
                  </div>
                )}
              </div>
            </div>

            {customFieldDefs.length > 0 && (
              <ModernSection title="Custom Fields">
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
              </ModernSection>
            )}

            <div className="h-4" />
          </div>
        </div>

        {/* ── Right: sticky actions panel ── */}
        <div className="w-60 xl:w-64 shrink-0 border-l border-stone-200 bg-white flex flex-col overflow-y-auto modal-scrollbar">

          {/* Save / Cancel */}
          <div className="p-4 border-b border-stone-100 space-y-2">
            <button
              type="submit"
              disabled={isPending}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-xs font-semibold text-stone-900 hover:bg-brand-hover disabled:opacity-50 transition-all duration-150 shadow-sm hover:shadow"
            >
              {isPending ? (
                <><Loader2 className="size-3.5 animate-spin" />Saving…</>
              ) : (
                <><Save className="size-3.5" />Save Lead</>
              )}
            </button>
            <button
              type="button"
              onClick={() => navigate('/crm/lead')}
              disabled={isPending}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-stone-200 bg-white px-4 py-2 text-xs font-medium text-stone-600 hover:bg-stone-50 hover:border-stone-300 disabled:opacity-50 transition-all duration-150"
            >
              <X className="size-3.5" />
              Cancel
            </button>

            {createError && (
              <div className="flex items-start gap-2 rounded-lg border border-red-100 bg-red-50 px-3 py-2.5 text-xs text-red-700">
                <AlertCircle className="size-3.5 shrink-0 mt-0.5" />
                <span>{apiErrorMessage(createError, 'Failed to save lead.')}</span>
              </div>
            )}
          </div>

          {/* Record preview */}
          <div className="p-4 border-b border-stone-100">
            <p className="text-2xs font-semibold uppercase tracking-wider text-stone-400 mb-2.5">Preview</p>
            <div className="rounded-lg bg-stone-50 border border-stone-100 p-3 space-y-2.5">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-purple-100 flex items-center justify-center shrink-0">
                  {data.type === 'Individual'
                    ? <User className="h-3.5 w-3.5 text-purple-600" />
                    : <Building2 className="h-3.5 w-3.5 text-purple-600" />}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-stone-800 truncate leading-tight">
                    {displayName || <span className="text-stone-400 font-normal italic">Unnamed</span>}
                  </p>
                  <p className="text-2xs text-stone-400 mt-0.5">
                    {data.type === 'Individual' ? 'Individual' : 'Company'}
                  </p>
                </div>
              </div>
              {(Boolean(data.email) || Boolean(data.phone)) && (
                <div className="pt-2 space-y-1 border-t border-stone-200">
                  {Boolean(data.email) && (
                    <p className="text-2xs text-stone-500 truncate">{String(data.email)}</p>
                  )}
                  {Boolean(data.phone) && (
                    <p className="text-2xs text-stone-500 truncate">{String(data.phone)}</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Assignment */}
          <div className="p-4 border-b border-stone-100">
            <p className="text-2xs font-semibold uppercase tracking-wider text-stone-400 mb-2.5">Assignment</p>
            <div className="space-y-2">
              {[
                { label: 'Sales Rep', key: 'sales_rep' },
                { label: 'Territory', key: 'territory' },
                { label: 'Partner', key: 'partner' },
              ].map(({ label, key }) => (
                <div key={key} className="flex items-center justify-between gap-2">
                  <span className="text-2xs text-stone-400 shrink-0">{label}</span>
                  <span className="text-2xs font-medium text-stone-600 truncate text-right">
                    {data[key] ? String(data[key]) : <span className="text-stone-300 font-normal">—</span>}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Tip */}
          <div className="p-4 mt-auto">
            <div className="rounded-lg bg-amber-50 border border-amber-100 p-3">
              <p className="text-2xs font-semibold text-amber-700 mb-1">Tip</p>
              <p className="text-2xs text-amber-600 leading-relaxed">
                Fields marked <span className="text-red-400 font-semibold">*</span> are required. A company name or contact person must be set before saving.
              </p>
            </div>
          </div>
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
    <ModernSection title={section.title}>
      <div className="grid grid-cols-1 gap-x-5 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((f) => (
          <LeadFieldInput key={f.key} field={f} value={data[f.key]} set={set} />
        ))}
      </div>
    </ModernSection>
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
        <ModernFieldShell label={field.label} required={field.required}>
          <div className="flex rounded-lg bg-stone-100 p-0.5 gap-0.5 mt-1">
            {field.options?.map((opt) => (
              <label
                key={opt}
                className={cn(
                  'flex-1 text-center py-1.5 text-xs font-medium rounded-md cursor-pointer select-none transition-all duration-150',
                  value === opt
                    ? 'bg-white text-stone-800 shadow-sm border border-stone-200/80'
                    : 'text-stone-500 hover:text-stone-700',
                )}
              >
                <input
                  type="radio"
                  name={field.key}
                  value={opt}
                  checked={value === opt}
                  onChange={() => set(field.key, opt)}
                  className="sr-only"
                  aria-label={opt}
                />
                {opt}
              </label>
            ))}
          </div>
        </ModernFieldShell>
      </div>
    );
  }

  if (field.type === 'checkbox') {
    return (
      <label className="flex items-center gap-2.5 self-end pb-1 cursor-pointer group">
        <div
          className={cn(
            'h-4 w-4 rounded-md border-2 flex items-center justify-center shrink-0 transition-all duration-150',
            value === true
              ? 'bg-stone-800 border-stone-800'
              : 'border-stone-300 group-hover:border-stone-400 bg-white',
          )}
        >
          {value === true && (
            <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 12 12" fill="none">
              <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
          <input
            type="checkbox"
            checked={value === true}
            onChange={(e) => set(field.key, e.target.checked)}
            className="sr-only"
            aria-label={field.label}
          />
        </div>
        <span className="text-xs text-stone-600 font-medium select-none">{field.label}</span>
      </label>
    );
  }

  return (
    <ModernFieldShell label={field.label} required={field.required}>
      {field.type === 'textarea' ? (
        <textarea
          rows={3}
          required={field.required}
          value={str}
          onChange={(e) => set(field.key, e.target.value)}
          className={`${fieldCls} resize-none`}
          aria-label={field.label}
          placeholder={field.placeholder}
        />
      ) : field.type === 'select' ? (
        <select
          required={field.required}
          value={str}
          onChange={(e) => set(field.key, e.target.value)}
          className={fieldCls}
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
          className={fieldCls}
          aria-label={field.label}
        />
      )}
    </ModernFieldShell>
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
    <div className="flex overflow-x-auto modal-scrollbar border-b border-stone-200 bg-white">
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          onClick={() => onSelect(t.key)}
          aria-pressed={active === t.key}
          className={cn(
            'px-4 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 -mb-px transition-all duration-150',
            active === t.key
              ? 'border-stone-800 text-stone-800'
              : 'border-transparent text-stone-400 hover:text-stone-600 hover:border-stone-300',
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
