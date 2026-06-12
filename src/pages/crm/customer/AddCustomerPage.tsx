import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Building2, AlertCircle, Loader2, Save, X } from 'lucide-react';
import { crmService } from '@/services/crmService';
import { workflowService } from '@/services/tenantServices';
import { StatusDropdown } from '@/components/crm/StatusDropdown';
import { CustomerFormSections } from '@/components/crm/CustomerFormSections';
import { apiErrorMessage } from '@/api/tenantClient';
import type { FieldDefinition } from '@/types/tenant';

export default function AddCustomerPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [stateId, setStateId] = useState('');
  const [coreFields, setCoreFields] = useState<Record<string, unknown>>({});
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, unknown>>({});

  const handleStatusChange = useCallback((id: string) => setStateId(id), []);

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
      crmService.createRecord('customer', { coreFields, customFields: customFieldValues }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-records', 'customer'] });
      navigate('/crm/customer');
    },
  });

  const set = (key: string, value: unknown) =>
    setCoreFields((prev) => ({ ...prev, [key]: value }));

  const displayName = String(coreFields.company_name ?? '');

  return (
    <div className="flex flex-1 min-h-0 bg-stone-50">
      <form
        onSubmit={(e) => { e.preventDefault(); create.mutate(); }}
        className="flex flex-1 min-h-0 min-w-0"
      >
        {/* ── Left: scrollable form ── */}
        <div className="flex flex-col flex-1 min-h-0 min-w-0">
          <div className="shrink-0 bg-white border-b border-stone-100 px-6 py-3.5 flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
              <Building2 className="h-4 w-4 text-emerald-600" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-stone-800 leading-tight">New Customer</h1>
              <p className="text-2xs text-stone-400 mt-0.5">Fill in the details to create a customer record</p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto overflow-x-hidden modal-scrollbar px-6 py-5 space-y-4">
            <CustomerFormSections
              core={{ fields: coreFields, onChange: set }}
              custom={{
                defs: customFields,
                values: customFieldValues,
                onChange: (key, value) =>
                  setCustomFieldValues((prev) => ({ ...prev, [key]: value })),
              }}
              statusNode={
                <StatusDropdown
                  workflowKey="customer"
                  mode="all"
                  value={stateId}
                  onChange={handleStatusChange}
                  disabled
                />
              }
            />
            <div className="h-4" />
          </div>
        </div>

        {/* ── Right: sticky actions panel ── */}
        <div className="w-60 xl:w-64 shrink-0 border-l border-stone-200 bg-white flex flex-col overflow-y-auto modal-scrollbar">
          <div className="p-4 border-b border-stone-100 space-y-2">
            <button
              type="submit"
              disabled={create.isPending}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-xs font-semibold text-stone-900 hover:bg-brand-hover disabled:opacity-50 transition-all duration-150 shadow-sm hover:shadow"
            >
              {create.isPending ? (
                <><Loader2 className="size-3.5 animate-spin" />Saving…</>
              ) : (
                <><Save className="size-3.5" />Save Customer</>
              )}
            </button>
            <button
              type="button"
              onClick={() => navigate('/crm/customer')}
              disabled={create.isPending}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-stone-200 bg-white px-4 py-2 text-xs font-medium text-stone-600 hover:bg-stone-50 hover:border-stone-300 disabled:opacity-50 transition-all duration-150"
            >
              <X className="size-3.5" />
              Cancel
            </button>

            {create.error && (
              <div className="flex items-start gap-2 rounded-lg border border-red-100 bg-red-50 px-3 py-2.5 text-xs text-red-700">
                <AlertCircle className="size-3.5 shrink-0 mt-0.5" />
                <span>{apiErrorMessage(create.error, 'Failed to save customer.')}</span>
              </div>
            )}
          </div>

          {/* Record preview */}
          <div className="p-4 border-b border-stone-100">
            <p className="text-2xs font-semibold uppercase tracking-wider text-stone-400 mb-2.5">Preview</p>
            <div className="rounded-lg bg-stone-50 border border-stone-100 p-3 space-y-2.5">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                  <Building2 className="h-3.5 w-3.5 text-emerald-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-stone-800 truncate leading-tight">
                    {displayName || <span className="text-stone-400 font-normal italic">Unnamed</span>}
                  </p>
                  <p className="text-2xs text-stone-400 mt-0.5">Company</p>
                </div>
              </div>
              {(Boolean(coreFields.email) || Boolean(coreFields.phone)) && (
                <div className="pt-2 space-y-1 border-t border-stone-200">
                  {Boolean(coreFields.email) && (
                    <p className="text-2xs text-stone-500 truncate">{String(coreFields.email)}</p>
                  )}
                  {Boolean(coreFields.phone) && (
                    <p className="text-2xs text-stone-500 truncate">{String(coreFields.phone)}</p>
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
                Fields marked <span className="text-red-400 font-semibold">*</span> are required. Company name and email must be set before saving.
              </p>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
