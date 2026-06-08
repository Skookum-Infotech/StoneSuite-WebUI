import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { UserPlus } from 'lucide-react';
import { prospectService } from '@/services/prospectService';
import { workflowService } from '@/services/tenantServices';
import { DynamicFieldInput } from '@/components/tenant/DynamicFieldInput';
import { apiErrorMessage } from '@/api/tenantClient';
import { ProspectForm } from '@/components/prospect/ProspectForm';
import type { FieldDefinition } from '@/types/tenant';

export default function AddProspectPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, unknown>>({});

  // Fetch the Prospect workflow's custom field definitions.
  const { data: allWorkflows = [] } = useQuery({ queryKey: ['workflows'], queryFn: workflowService.list });
  const prospectWorkflow = allWorkflows.find((wf) => wf.key.toLowerCase() === 'prospect');
  const { data: prospectDef } = useQuery({
    queryKey: ['workflow', prospectWorkflow?.id],
    queryFn: () => workflowService.get(prospectWorkflow!.id),
    enabled: Boolean(prospectWorkflow?.id),
  });
  const customFields: FieldDefinition[] = prospectDef?.fields ?? [];

  const create = useMutation({
    mutationFn: (fields: Record<string, unknown>) => prospectService.create(fields),
    onSuccess: (prospect) => {
      queryClient.invalidateQueries({ queryKey: ['prospects'] });
      navigate(`/prospects/${prospect.id}`);
    },
  });

  const handleSubmit = (fields: Record<string, unknown>) => {
    create.mutate({ ...fields, customFields: customFieldValues });
  };

  return (
    <div className="flex-1 bg-stone-50 p-6">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/20 text-brand-dark">
          <UserPlus className="size-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900">Prospect</h1>
          <p className="text-sm text-stone-500">Create a new prospect record.</p>
        </div>
      </div>

      <ProspectForm
        submitting={create.isPending}
        errorMessage={create.error ? apiErrorMessage(create.error, 'Could not save the prospect.') : null}
        onSubmit={handleSubmit}
        onCancel={() => navigate('/prospects')}
      />

      {/* Dynamic custom fields added by admin in Config */}
      {customFields.length > 0 && (
        <div className="mt-3 overflow-hidden rounded border border-stone-200 bg-white">
          <div className="flex items-center gap-2 border-b border-stone-200 bg-stone-50 px-4 py-2">
            <h3 className="text-label font-bold uppercase tracking-wide text-stone-700">Custom Fields</h3>
          </div>
          <div className="grid grid-cols-1 gap-x-6 gap-y-3 px-4 py-3 sm:grid-cols-2">
            {customFields.map((f) => (
              <DynamicFieldInput
                key={f.id || f.key}
                field={f}
                value={customFieldValues[f.key]}
                onChange={(key, value) => setCustomFieldValues((prev) => ({ ...prev, [key]: value }))}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
