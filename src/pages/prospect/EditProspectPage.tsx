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
import { Section, FieldShell, inputClass } from '@/components/prospect/ProspectUI';
import { Spinner, ErrorNote } from '@/components/tenant/ui';
import type { FieldDefinition } from '@/types/tenant';

export default function EditProspectPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // null = not yet modified by user → fall back to record data
  const [localCoreFields, setLocalCoreFields] = useState<Record<string, unknown> | null>(null);
  const [localCustomFields, setLocalCustomFields] = useState<Record<string, unknown> | null>(null);
  const [localStateId, setLocalStateId] = useState<string | null>(null);

  const { data: record, isLoading, error: loadError } = useQuery({
    queryKey: ['crm-record', id],
    queryFn: () => crmService.getRecord(id, 'prospect'),
    enabled: Boolean(id),
  });

  const coreFields = localCoreFields ?? record?.coreFields ?? {};
  const customFieldValues = localCustomFields ?? record?.customFields ?? {};
  const currentStateId = localStateId ?? record?.currentStateId ?? '';

  // Custom field definitions
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
    mutationFn: () => crmService.updateRecord(id, { coreFields, customFields: customFieldValues }, 'prospect'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-record', id] });
      queryClient.invalidateQueries({ queryKey: ['crm-records', 'prospect'] });
      navigate('/prospects');
    },
  });

  const set = (key: string, value: unknown) =>
    setLocalCoreFields((prev) => ({ ...(prev ?? record?.coreFields ?? {}), [key]: value }));

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
        {/* Header Bar */}
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

        {/* Page Title */}
        <div className="bg-white border-b border-stone-100 px-6 py-2 flex items-center gap-2">
          <div className="h-5 w-5 rounded bg-brand/20 flex items-center justify-center">
            <Users className="h-3 w-3 text-brand-dark" />
          </div>
          <h1 className="text-sm font-bold text-stone-800">Prospect — {company}</h1>
        </div>

        {/* Form Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          <Section title="Prospect Details">
            <div className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
              <FieldShell label="Company Name" required>
                <input
                  required
                  value={String(coreFields.company_name ?? '')}
                  onChange={(e) => set('company_name', e.target.value)}
                  className={inputClass}
                />
              </FieldShell>
              <FieldShell label="Status">
                <StatusDropdown
                  workflowKey="prospect"
                  mode="transitions"
                  recordId={id}
                  value={currentStateId}
                  onChange={handleStatusChange}
                  disabled={transition.isPending}
                />
              </FieldShell>
              <FieldShell label="Email">
                <input
                  type="email"
                  value={String(coreFields.email ?? '')}
                  onChange={(e) => set('email', e.target.value)}
                  className={inputClass}
                />
              </FieldShell>
              <FieldShell label="Phone">
                <input
                  type="tel"
                  value={String(coreFields.phone ?? '')}
                  onChange={(e) => set('phone', e.target.value)}
                  className={inputClass}
                />
              </FieldShell>
              <FieldShell label="Deal Size">
                <input
                  type="number"
                  value={String(coreFields.deal_size ?? '')}
                  onChange={(e) => set('deal_size', e.target.value)}
                  className={inputClass}
                />
              </FieldShell>
              <FieldShell label="Expected Close Date">
                <input
                  type="date"
                  value={String(coreFields.close_date ?? '')}
                  onChange={(e) => set('close_date', e.target.value)}
                  className={inputClass}
                />
              </FieldShell>
            </div>
          </Section>

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
