import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Building2, AlertCircle } from 'lucide-react';
import { crmService } from '@/services/crmService';
import { workflowService } from '@/services/tenantServices';
import { DynamicFieldInput } from '@/components/tenant/DynamicFieldInput';
import { StatusDropdown } from '@/components/crm/StatusDropdown';
import { apiErrorMessage } from '@/api/tenantClient';
import { Section, FieldShell, inputClass } from '@/components/prospect/ProspectUI';
import type { FieldDefinition } from '@/types/tenant';

export default function AddCustomerPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [stateId, setStateId] = useState('');
  const [coreFields, setCoreFields] = useState<Record<string, unknown>>({});
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, unknown>>({});

  // Handler required by StatusDropdown (disabled on create, so called once for initial state)
  const handleStatusChange = useCallback((id: string) => setStateId(id), []);

  // Custom field definitions for customer workflow
  const { data: allWorkflows = [] } = useQuery({ queryKey: ['workflows'], queryFn: workflowService.list });
  const customerWorkflow = allWorkflows.find((wf) => wf.key.toLowerCase() === 'customer');
  const { data: customerDef } = useQuery({
    queryKey: ['workflow', customerWorkflow?.id],
    queryFn: () => workflowService.get(customerWorkflow!.id),
    enabled: Boolean(customerWorkflow?.id),
  });
  const customFields: FieldDefinition[] = customerDef?.fields ?? [];

  const create = useMutation({
    mutationFn: () =>
      crmService.createRecord('customer', {
        coreFields,
        customFields: customFieldValues,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-records', 'customer'] });
      navigate('/crm/customer');
    },
  });

  const set = (key: string, value: unknown) =>
    setCoreFields((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="flex-1 flex flex-col bg-stone-50 min-h-0">
      <form
        onSubmit={(e) => { e.preventDefault(); create.mutate(); }}
        className="flex flex-col flex-1"
      >
        {/* Header Bar */}
        <div className="bg-white border-b border-stone-200 px-6 py-3 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={create.isPending}
              className="inline-flex items-center gap-1 rounded bg-brand px-3 py-1.5 text-xs font-semibold text-stone-950 hover:bg-brand-hover disabled:opacity-50 transition-colors"
            >
              {create.isPending ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/crm/customer')}
              disabled={create.isPending}
              className="rounded border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold text-stone-600 hover:bg-stone-50 disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
            {create.error && (
              <div className="flex items-center gap-1.5 rounded border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs text-red-700">
                <AlertCircle className="size-3.5 shrink-0" />
                {apiErrorMessage(create.error, 'Failed to save customer.')}
              </div>
            )}
          </div>
          <nav className="hidden sm:flex items-center gap-1 text-xs text-stone-400 font-medium">
            <span>CRM</span><span>/</span><span>Customer</span><span>/</span>
            <span className="text-stone-700 font-semibold">New Customer</span>
          </nav>
        </div>

        {/* Page Title */}
        <div className="bg-white border-b border-stone-100 px-6 py-2 flex items-center gap-2">
          <div className="h-5 w-5 rounded bg-emerald-100 flex items-center justify-center">
            <Building2 className="h-3 w-3 text-emerald-600" />
          </div>
          <h1 className="text-sm font-bold text-stone-800">New Customer</h1>
        </div>

        {/* Form Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          <Section title="Customer Details">
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
                {/* Disabled on create — customers always start at the initial state */}
                <StatusDropdown
                  workflowKey="customer"
                  mode="all"
                  value={stateId}
                  onChange={handleStatusChange}
                  disabled
                />
              </FieldShell>
              <FieldShell label="Email" required>
                <input
                  required
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
              <FieldShell label="Industry">
                <input
                  value={String(coreFields.industry ?? '')}
                  onChange={(e) => set('industry', e.target.value)}
                  className={inputClass}
                  placeholder="e.g. SaaS, Retail"
                />
              </FieldShell>
              <FieldShell label="Website">
                <input
                  type="url"
                  value={String(coreFields.website ?? '')}
                  onChange={(e) => set('website', e.target.value)}
                  className={inputClass}
                  placeholder="https://"
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
        </div>
      </form>
    </div>
  );
}
