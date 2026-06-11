import { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, AlertCircle, ArrowLeft } from 'lucide-react';
import { crmService } from '@/services/crmService';
import { workflowService } from '@/services/tenantServices';
import { apiErrorMessage } from '@/api/tenantClient';
import { DynamicFieldInput } from '@/components/tenant/DynamicFieldInput';
import { StatusDropdown } from '@/components/crm/StatusDropdown';
import { DeleteRecordDialog } from '@/components/crm/DeleteRecordDialog';
import { ConvertRecordButton } from '@/components/crm/ConvertRecordButton';
import { Section, FieldShell, TabBar, inputClass } from '@/components/prospect/ProspectUI';
import { Spinner, ErrorNote } from '@/components/tenant/ui';
import { PRIMARY_SECTIONS, TABS, prospectDefaults } from '@/lib/prospectForm';
import type { ProspectField, ProspectSection } from '@/lib/prospectForm';
import type { FieldDefinition } from '@/types/tenant';

export default function EditProspectPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [localCoreFields, setLocalCoreFields] = useState<Record<string, unknown> | null>(null);
  const [localCustomFields, setLocalCustomFields] = useState<Record<string, unknown> | null>(null);
  const [localStateId, setLocalStateId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(TABS[0]?.key ?? '');

  const { data: record, isLoading, error: loadError } = useQuery({
    queryKey: ['crm-record', id],
    queryFn: () => crmService.getRecord(id, 'prospect'),
    enabled: Boolean(id),
  });

  const coreFields = localCoreFields ?? { ...prospectDefaults(), ...record?.coreFields };
  const customFieldValues = localCustomFields ?? record?.customFields ?? {};
  const currentStateId = localStateId ?? record?.currentStateId ?? '';

  const { data: allWorkflows = [] } = useQuery({ queryKey: ['workflows'], queryFn: workflowService.list });
  const prospectWorkflow = allWorkflows.find((wf) => wf.key.toLowerCase() === 'prospect');
  const { data: prospectDef } = useQuery({
    queryKey: ['workflow', prospectWorkflow?.id],
    queryFn: () => workflowService.get(prospectWorkflow!.id),
    enabled: Boolean(prospectWorkflow?.id),
  });
  const customFieldDefs: FieldDefinition[] = prospectDef?.fields ?? [];

  const transition = useMutation({
    mutationFn: (toStateId: string) => crmService.transitionRecord(id, toStateId, 'prospect'),
    onSuccess: (updated) => {
      setLocalStateId(updated.currentStateId);
      queryClient.invalidateQueries({ queryKey: ['crm-record', id] });
      queryClient.invalidateQueries({ queryKey: ['crm-records', 'prospect'] });
    },
  });

  const handleStatusChange = useCallback(
    (toStateId: string) => {
      if (toStateId !== currentStateId) {
        setLocalStateId(toStateId);
        transition.mutate(toStateId);
      }
    },
    [currentStateId, transition],
  );

  const save = useMutation({
    mutationFn: () =>
      crmService.updateRecord(id, { coreFields, customFields: customFieldValues }, 'prospect'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-record', id] });
      queryClient.invalidateQueries({ queryKey: ['crm-records', 'prospect'] });
      navigate('/prospects');
    },
  });

  const set = (key: string, value: unknown) =>
    setLocalCoreFields((prev) => ({
      ...(prev ?? { ...prospectDefaults(), ...record?.coreFields }),
      [key]: value,
    }));

  const activeTabObj = TABS.find((t) => t.key === activeTab) ?? TABS[0];

  if (isLoading) return <div className="p-6"><Spinner label="Loading prospect…" /></div>;
  if (loadError || !record)
    return <div className="p-6"><ErrorNote>{apiErrorMessage(loadError, 'Failed to load prospect.')}</ErrorNote></div>;

  const company = String(coreFields.company_name ?? '—');

  return (
    <div className="flex-1 flex flex-col bg-stone-50 min-h-0">
      <form
        onSubmit={(e) => { e.preventDefault(); save.mutate(); }}
        className="flex flex-col flex-1"
      >
        {/* Sticky header */}
        <div className="bg-white border-b border-stone-200 px-6 py-3 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/prospects')}
              className="flex items-center gap-1 text-xs font-semibold text-stone-500 hover:text-stone-800"
            >
              <ArrowLeft className="size-3.5" />
              Prospects
            </button>
            <button
              type="submit"
              disabled={save.isPending}
              className="inline-flex items-center gap-1 rounded bg-brand px-3 py-1.5 text-xs font-semibold text-stone-950 hover:bg-brand-hover disabled:opacity-50 transition-colors"
            >
              {save.isPending ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/prospects')}
              disabled={save.isPending}
              className="rounded border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold text-stone-600 hover:bg-stone-50 disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
            {(save.error || transition.error) && (
              <div className="flex items-center gap-1.5 rounded border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs text-red-700">
                <AlertCircle className="size-3.5 shrink-0" />
                {apiErrorMessage(save.error ?? transition.error, 'Failed to save.')}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <StatusDropdown
              workflowKey="prospect"
              mode="transitions"
              recordId={id}
              value={currentStateId}
              onChange={handleStatusChange}
              disabled={transition.isPending}
            />
            <ConvertRecordButton
              recordId={id}
              sourceWorkflowKey="prospect"
              onConverted={(newId) => navigate(`/crm/customer/${newId}/edit`)}
            />
            <DeleteRecordDialog
              recordId={id}
              workflowKey="prospect"
              label={`Prospect — ${company}`}
              onDeleted={() => {
                queryClient.invalidateQueries({ queryKey: ['crm-records', 'prospect'] });
                navigate('/prospects');
              }}
            />
          </div>
        </div>

        {/* Page title */}
        <div className="bg-white border-b border-stone-100 px-6 py-2 flex items-center gap-2">
          <div className="h-5 w-5 rounded bg-brand/20 flex items-center justify-center">
            <Users className="h-3 w-3 text-brand-dark" />
          </div>
          <h1 className="text-sm font-bold text-stone-800">Prospect — {company}</h1>
        </div>

        {/* Form body */}
        <div className="flex-1 overflow-y-auto modal-scrollbar px-6 py-4 space-y-3">
          {PRIMARY_SECTIONS.map((section) => (
            <ProspectSectionFields key={section.title} section={section} data={coreFields} set={set} />
          ))}

          <div className="rounded border border-stone-200 bg-white overflow-hidden">
            <TabBar tabs={TABS} active={activeTabObj.key} onSelect={setActiveTab} />
            <div className="space-y-3 p-3">
              {activeTabObj.sections.map((section) => (
                <ProspectSectionFields key={section.title} section={section} data={coreFields} set={set} />
              ))}
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
                      setLocalCustomFields((prev) => ({
                        ...(prev ?? record?.customFields ?? {}),
                        [key]: value,
                      }))
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

function ProspectSectionFields({
  section,
  data,
  set,
}: {
  section: ProspectSection;
  data: Record<string, unknown>;
  set: (key: string, value: unknown) => void;
}) {
  return (
    <Section title={section.title}>
      <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
        {section.fields.map((f) => (
          <ProspectFieldInput key={f.key} field={f} value={data[f.key]} set={set} />
        ))}
      </div>
    </Section>
  );
}

function ProspectFieldInput({
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
          className={inputClass}
          aria-label={field.label}
        />
      )}
    </FieldShell>
  );
}
