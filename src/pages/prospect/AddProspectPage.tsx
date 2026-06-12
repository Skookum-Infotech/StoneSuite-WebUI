import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Users, AlertCircle, Loader2, Save, X } from 'lucide-react';
import { crmService } from '@/services/crmService';
import { workflowService } from '@/services/tenantServices';
import { apiErrorMessage } from '@/api/tenantClient';
import { DynamicFieldInput } from '@/components/tenant/DynamicFieldInput';
import { PRIMARY_SECTIONS, TABS, prospectDefaults } from '@/lib/prospectForm';
import { ModernSection, ModernFieldShell, LeadTabBar, fieldCls } from '@/pages/crm/AddLeadPage';
import { cn } from '@/lib/utils';
import type { ProspectField, ProspectSection } from '@/lib/prospectForm';
import type { LeadTab } from '@/lib/leadForm';
import type { FieldDefinition } from '@/types/tenant';

export default function AddProspectPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [data, setData] = useState<Record<string, unknown>>(prospectDefaults());
  const [activeTab, setActiveTab] = useState(TABS[0]?.key ?? '');
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, unknown>>({});

  const set = (key: string, value: unknown) => setData((d) => ({ ...d, [key]: value }));

  const { data: allWorkflows = [] } = useQuery({ queryKey: ['workflows'], queryFn: workflowService.list });
  const prospectWorkflow = allWorkflows.find((wf) => wf.key.toLowerCase() === 'prospect');
  const { data: prospectDef } = useQuery({
    queryKey: ['workflow', prospectWorkflow?.id],
    queryFn: () => workflowService.get(prospectWorkflow!.id),
    enabled: Boolean(prospectWorkflow?.id),
  });
  const customFieldDefs: FieldDefinition[] = prospectDef?.fields ?? [];

  const { mutate: createProspect, isPending, error: createError } = useMutation({
    mutationFn: () =>
      crmService.createRecord('prospect', { coreFields: data, customFields: customFieldValues }),
    onSuccess: (record) => {
      queryClient.invalidateQueries({ queryKey: ['crm-records', 'prospect'] });
      navigate(`/prospects/${record.id}`);
    },
  });

  const activeTabObj = TABS.find((t) => t.key === activeTab) ?? TABS[0];
  const displayName = String(data.company_name ?? '');

  return (
    <div className="flex flex-1 min-h-0 bg-stone-50">
      <form
        onSubmit={(e) => { e.preventDefault(); createProspect(); }}
        className="flex flex-1 min-h-0 min-w-0"
      >
        {/* ── Left: scrollable form ── */}
        <div className="flex flex-col flex-1 min-h-0 min-w-0">
          <div className="shrink-0 bg-white border-b border-stone-100 px-6 py-3.5 flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
              <Users className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-stone-800 leading-tight">New Prospect</h1>
              <p className="text-2xs text-stone-400 mt-0.5">Fill in the details to create a prospect record</p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto overflow-x-hidden modal-scrollbar px-6 py-5 space-y-4">
            {PRIMARY_SECTIONS.map((section) => (
              <ProspectSectionFields key={section.title} section={section} data={data} set={set} />
            ))}

            <div className="rounded-xl border border-stone-200 bg-white shadow-sm overflow-hidden">
              <LeadTabBar
                tabs={TABS as unknown as LeadTab[]}
                active={activeTabObj.key}
                onSelect={setActiveTab}
              />
              <div className="px-5 py-4">
                {activeTabObj.sections.length > 0 ? (
                  <div className="space-y-4">
                    {activeTabObj.sections.map((section) => (
                      <ProspectSectionFields key={section.title} section={section} data={data} set={set} />
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
          <div className="p-4 border-b border-stone-100 space-y-2">
            <button
              type="submit"
              disabled={isPending}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-xs font-semibold text-stone-900 hover:bg-brand-hover disabled:opacity-50 transition-all duration-150 shadow-sm hover:shadow"
            >
              {isPending ? (
                <><Loader2 className="size-3.5 animate-spin" />Saving…</>
              ) : (
                <><Save className="size-3.5" />Save Prospect</>
              )}
            </button>
            <button
              type="button"
              onClick={() => navigate('/prospects')}
              disabled={isPending}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-stone-200 bg-white px-4 py-2 text-xs font-medium text-stone-600 hover:bg-stone-50 hover:border-stone-300 disabled:opacity-50 transition-all duration-150"
            >
              <X className="size-3.5" />
              Cancel
            </button>

            {createError && (
              <div className="flex items-start gap-2 rounded-lg border border-red-100 bg-red-50 px-3 py-2.5 text-xs text-red-700">
                <AlertCircle className="size-3.5 shrink-0 mt-0.5" />
                <span>{apiErrorMessage(createError, 'Failed to save prospect.')}</span>
              </div>
            )}
          </div>

          {/* Record preview */}
          <div className="p-4 border-b border-stone-100">
            <p className="text-2xs font-semibold uppercase tracking-wider text-stone-400 mb-2.5">Preview</p>
            <div className="rounded-lg bg-stone-50 border border-stone-100 p-3 space-y-2.5">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                  <Users className="h-3.5 w-3.5 text-blue-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-stone-800 truncate leading-tight">
                    {displayName || <span className="text-stone-400 font-normal italic">Unnamed</span>}
                  </p>
                  <p className="text-2xs text-stone-400 mt-0.5">Company</p>
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

          {/* Tip */}
          <div className="p-4 mt-auto">
            <div className="rounded-lg bg-amber-50 border border-amber-100 p-3">
              <p className="text-2xs font-semibold text-amber-700 mb-1">Tip</p>
              <p className="text-2xs text-amber-600 leading-relaxed">
                Fields marked <span className="text-red-400 font-semibold">*</span> are required. A company name must be set before saving.
              </p>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

export function ProspectSectionFields({
  section,
  data,
  set,
}: {
  section: ProspectSection;
  data: Record<string, unknown>;
  set: (key: string, value: unknown) => void;
}) {
  return (
    <ModernSection title={section.title}>
      <div className="grid grid-cols-1 gap-x-5 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
        {section.fields.map((f) => (
          <ProspectFieldInput key={f.key} field={f} value={data[f.key]} set={set} />
        ))}
      </div>
    </ModernSection>
  );
}

export function ProspectFieldInput({
  field,
  value,
  set,
}: {
  field: ProspectField;
  value: unknown;
  set: (key: string, value: unknown) => void;
}) {
  const str = typeof value === 'string' ? value : '';

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
          <option value="">— Select —</option>
          {field.options?.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
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
