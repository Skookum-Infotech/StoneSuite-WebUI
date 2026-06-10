import { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Sparkles, AlertCircle, ArrowLeft } from 'lucide-react';
import { crmService } from '@/services/crmService';
import { workflowService } from '@/services/tenantServices';
import { apiErrorMessage } from '@/api/tenantClient';
import { DynamicFieldInput } from '@/components/tenant/DynamicFieldInput';
import { StatusDropdown } from '@/components/crm/StatusDropdown';
import { DeleteRecordDialog } from '@/components/crm/DeleteRecordDialog';
import { ConvertRecordButton } from '@/components/crm/ConvertRecordButton';
import { Section } from '@/components/prospect/ProspectUI';
import { Spinner, ErrorNote } from '@/components/tenant/ui';
import { PRIMARY_SECTIONS, TABS, leadDefaults } from '@/lib/leadForm';
import { LeadSectionFields, LeadTabBar } from './AddLeadPage';
import type { FieldDefinition } from '@/types/tenant';

export default function EditLeadPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [localCoreFields, setLocalCoreFields] = useState<Record<string, unknown> | null>(null);
  const [localCustomFields, setLocalCustomFields] = useState<Record<string, unknown> | null>(null);
  const [localStateId, setLocalStateId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(TABS[0]?.key ?? '');

  const { data: record, isLoading, error: loadError } = useQuery({
    queryKey: ['crm-record', id],
    queryFn: () => crmService.getRecord(id, 'lead'),
    enabled: Boolean(id),
  });

  const coreFields = localCoreFields ?? { ...leadDefaults(), ...record?.coreFields };
  const customFieldValues = localCustomFields ?? record?.customFields ?? {};
  const currentStateId = localStateId ?? record?.currentStateId ?? '';

  const { data: allWorkflows = [] } = useQuery({ queryKey: ['workflows'], queryFn: workflowService.list });
  const leadWorkflow = allWorkflows.find((wf) => wf.key.toLowerCase() === 'lead');
  const { data: leadDef } = useQuery({
    queryKey: ['workflow', leadWorkflow?.id],
    queryFn: () => workflowService.get(leadWorkflow!.id),
    enabled: Boolean(leadWorkflow?.id),
  });
  const customFieldDefs: FieldDefinition[] = leadDef?.fields ?? [];

  const transition = useMutation({
    mutationFn: (toStateId: string) => crmService.transitionRecord(id, toStateId, 'lead'),
    onSuccess: (updated) => {
      setLocalStateId(updated.currentStateId);
      queryClient.invalidateQueries({ queryKey: ['crm-record', id] });
      queryClient.invalidateQueries({ queryKey: ['crm-records', 'lead'] });
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
      crmService.updateRecord(id, { coreFields, customFields: customFieldValues }, 'lead'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-record', id] });
      queryClient.invalidateQueries({ queryKey: ['crm-records', 'lead'] });
      navigate('/crm/lead');
    },
  });

  const set = (key: string, value: unknown) =>
    setLocalCoreFields((prev) => ({ ...(prev ?? { ...leadDefaults(), ...record?.coreFields }), [key]: value }));

  const activeTabObj = TABS.find((t) => t.key === activeTab) ?? TABS[0];

  if (isLoading) return <div className="p-6"><Spinner label="Loading lead…" /></div>;
  if (loadError || !record)
    return <div className="p-6"><ErrorNote>{apiErrorMessage(loadError, 'Failed to load lead.')}</ErrorNote></div>;

  const company = String(coreFields.company_name ?? coreFields.first_name ?? '—');

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
              onClick={() => navigate('/crm/lead')}
              className="flex items-center gap-1 text-xs font-semibold text-stone-500 hover:text-stone-800"
            >
              <ArrowLeft className="size-3.5" />
              Leads
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
              onClick={() => navigate('/crm/lead')}
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
              workflowKey="lead"
              mode="transitions"
              recordId={id}
              value={currentStateId}
              onChange={handleStatusChange}
              disabled={transition.isPending}
            />
            <ConvertRecordButton
              recordId={id}
              sourceWorkflowKey="lead"
              onConverted={(newId) => navigate(`/prospects/${newId}/edit`)}
            />
            <DeleteRecordDialog
              recordId={id}
              workflowKey="lead"
              label={`Lead — ${company}`}
              onDeleted={() => {
                queryClient.invalidateQueries({ queryKey: ['crm-records', 'lead'] });
                navigate('/crm/lead');
              }}
            />
          </div>
        </div>

        {/* Page title */}
        <div className="bg-white border-b border-stone-100 px-6 py-2 flex items-center gap-2">
          <div className="h-5 w-5 rounded bg-purple-100 flex items-center justify-center">
            <Sparkles className="h-3 w-3 text-purple-600" />
          </div>
          <h1 className="text-sm font-bold text-stone-800">Lead — {company}</h1>
        </div>

        {/* Form body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {PRIMARY_SECTIONS.map((section) => (
            <LeadSectionFields key={section.title} section={section} data={coreFields} set={set} />
          ))}

          <div className="rounded border border-stone-200 bg-white overflow-hidden">
            <LeadTabBar tabs={TABS} active={activeTabObj.key} onSelect={setActiveTab} />
            <div className="px-4 py-4">
              {activeTabObj.sections.length > 0 ? (
                <div className="space-y-3">
                  {activeTabObj.sections.map((section) => (
                    <LeadSectionFields key={section.title} section={section} data={coreFields} set={set} />
                  ))}
                </div>
              ) : (
                <p className="text-xs text-stone-400 py-4 text-center">
                  {activeTabObj.label} information is not yet available.
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
