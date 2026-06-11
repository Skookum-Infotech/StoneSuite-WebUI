import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Users } from 'lucide-react';
import { crmService } from '@/services/crmService';
import { workflowService } from '@/services/tenantServices';
import { apiErrorMessage } from '@/api/tenantClient';
import { DynamicFieldInput } from '@/components/tenant/DynamicFieldInput';
import { ProspectForm } from '@/components/prospect/ProspectForm';
import { Section } from '@/components/prospect/ProspectUI';
import type { FieldDefinition } from '@/types/tenant';

export default function AddProspectPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, unknown>>({});

  const { data: allWorkflows = [] } = useQuery({ queryKey: ['workflows'], queryFn: workflowService.list });
  const prospectWorkflow = allWorkflows.find((wf) => wf.key.toLowerCase() === 'prospect');
  const { data: prospectDef } = useQuery({
    queryKey: ['workflow', prospectWorkflow?.id],
    queryFn: () => workflowService.get(prospectWorkflow!.id),
    enabled: Boolean(prospectWorkflow?.id),
  });
  const customFieldDefs: FieldDefinition[] = prospectDef?.fields ?? [];

  const create = useMutation({
    mutationFn: (coreFields: Record<string, unknown>) =>
      crmService.createRecord('prospect', { coreFields, customFields: customFieldValues }),
    onSuccess: (record) => {
      queryClient.invalidateQueries({ queryKey: ['crm-records', 'prospect'] });
      navigate(`/prospects/${record.id}`);
    },
  });

  return (
    <div className="flex-1 flex flex-col bg-stone-50 min-h-0">

      {/* Page title */}
      <div className="bg-white border-b border-stone-200 px-6 py-3 flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand/20 text-brand-dark">
          <Users className="size-4" />
        </div>
        <div>
          <h1 className="text-sm font-bold text-stone-800">New Prospect</h1>
          <p className="text-2xs text-stone-400">Create a new prospect record</p>
        </div>
        <nav className="ml-auto hidden sm:flex items-center gap-1 text-xs text-stone-400 font-medium">
          <span>CRM</span><span>/</span><span>Prospects</span><span>/</span>
          <span className="text-stone-700 font-semibold">New</span>
        </nav>
      </div>

      <div className="flex-1 overflow-y-auto modal-scrollbar px-6 py-4 space-y-3">
        <ProspectForm
          submitting={create.isPending}
          errorMessage={create.error ? apiErrorMessage(create.error, 'Could not save the prospect.') : null}
          onSubmit={(fields) => create.mutate(fields)}
          onCancel={() => navigate('/prospects')}
        />

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
    </div>
  );
}
