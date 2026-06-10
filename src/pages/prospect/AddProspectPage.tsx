import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { UserPlus, AlertCircle } from 'lucide-react';
import { crmService } from '@/services/crmService';
import { workflowService } from '@/services/tenantServices';
import { DynamicFieldInput } from '@/components/tenant/DynamicFieldInput';
import { StatusDropdown } from '@/components/crm/StatusDropdown';
import { apiErrorMessage } from '@/api/tenantClient';
import { Section, FieldShell, inputClass } from '@/components/prospect/ProspectUI';
import type { FieldDefinition } from '@/types/tenant';

export default function AddProspectPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [stateId, setStateId] = useState('');
  const [coreFields, setCoreFields] = useState<Record<string, unknown>>({});
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, unknown>>({});

  const handleStatusChange = useCallback((id: string) => setStateId(id), []);

  // Fetch the Prospect workflow's custom field definitions
  const { data: allWorkflows = [] } = useQuery({ queryKey: ['workflows'], queryFn: workflowService.list });
  const prospectWorkflow = allWorkflows.find((wf) => wf.key.toLowerCase() === 'prospect');
  const { data: prospectDef } = useQuery({
    queryKey: ['workflow', prospectWorkflow?.id],
    queryFn: () => workflowService.get(prospectWorkflow!.id),
    enabled: Boolean(prospectWorkflow?.id),
  });
  const customFields: FieldDefinition[] = prospectDef?.fields ?? [];

  const create = useMutation({
    mutationFn: () =>
      crmService.createRecord('prospect', {
        coreFields,
        customFields: customFieldValues,
      }),
    onSuccess: (record) => {
      queryClient.invalidateQueries({ queryKey: ['crm-records', 'prospect'] });
      navigate(`/prospects/${record.id}`);
    },
  });

  const set = (key: string, value: unknown) =>
    setCoreFields((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="flex-1 bg-stone-50 p-6">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/20 text-brand-dark">
          <UserPlus className="size-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900">New Prospect</h1>
          <p className="text-sm text-stone-500">Create a new prospect record.</p>
        </div>
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); create.mutate(); }}
        className="space-y-3"
      >
        {create.error && (
          <div className="flex items-center gap-1.5 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            <AlertCircle className="size-3.5 shrink-0" />
            {apiErrorMessage(create.error, 'Could not save the prospect.')}
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={create.isPending}
            className="inline-flex items-center gap-1 rounded bg-brand px-4 py-2 text-xs font-semibold text-stone-950 transition-colors hover:bg-brand-hover disabled:opacity-50"
          >
            {create.isPending ? 'Saving…' : 'Save'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/prospects')}
            className="rounded border border-stone-300 bg-white px-4 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-50"
          >
            Cancel
          </button>
        </div>

        <Section title="Prospect Details">
          <div className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
            <FieldShell label="Company Name" required>
              <input
                required
                value={String(coreFields.company_name ?? '')}
                onChange={(e) => set('company_name', e.target.value)}
                className={inputClass}
                placeholder="Acme Corp"
              />
            </FieldShell>
            <FieldShell label="Status">
              <StatusDropdown
                workflowKey="prospect"
                mode="all"
                value={stateId}
                onChange={handleStatusChange}
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
                placeholder="0"
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

        {customFields.length > 0 && (
          <Section title="Custom Fields">
            <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
              {customFields.map((f) => (
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
      </form>
    </div>
  );
}
