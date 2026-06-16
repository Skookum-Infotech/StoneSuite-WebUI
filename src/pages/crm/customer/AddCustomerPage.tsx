import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Building2, AlertCircle, Loader2, Save, X, ChevronLeft } from 'lucide-react';
import { crmService } from '@/services/crmService';
import { workflowService, userService } from '@/services/tenantServices';
import { apiErrorMessage } from '@/api/tenantClient';
import { CrmRecordForm } from '@/components/crm/CrmRecordForm';
import { EditableFilesPanel } from '@/components/crm/CrmSubTabsPanel';
import { crmCoreDefaults } from '@/lib/crmFields';
import type { FieldDefinition } from '@/types/tenant';

export default function AddCustomerPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [coreFields, setCoreFields] = useState<Record<string, unknown>>(crmCoreDefaults);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, unknown>>({});
  const [ownerUserId, setOwnerUserId] = useState('');

  const set = (key: string, value: unknown) => setCoreFields((d) => ({ ...d, [key]: value }));

  const { data: allWorkflows = [] } = useQuery({ queryKey: ['workflows'], queryFn: workflowService.list });
  const customerWorkflow = allWorkflows.find((wf) => wf.key.toLowerCase() === 'customer');
  const { data: customerDef } = useQuery({
    queryKey: ['workflow', customerWorkflow?.id],
    queryFn: () => workflowService.get(customerWorkflow!.id),
    enabled: Boolean(customerWorkflow?.id),
  });
  const customFieldDefs: FieldDefinition[] = customerDef?.fields ?? [];

  const { data: users = [] } = useQuery({ queryKey: ['workspace-users'], queryFn: userService.listUsers });

  const { mutate: createCustomer, isPending, error: createError } = useMutation({
    mutationFn: () =>
      crmService.createRecord('customer', {
        coreFields,
        customFields: customFieldValues,
        ownerUserId: ownerUserId || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-records', 'customer'] });
      navigate('/crm/customer');
    },
  });

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-stone-50">
      <form
        onSubmit={(e) => { e.preventDefault(); createCustomer(); }}
        className="flex flex-col flex-1 min-h-0"
      >
        {/* Sticky top bar */}
        <div className="shrink-0 bg-white border-b border-stone-100 px-4 py-2.5 flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/crm/customer')}
            className="flex items-center gap-1 text-xs text-stone-400 hover:text-stone-600 transition-colors px-1.5 py-1 rounded-md hover:bg-stone-100 shrink-0"
            aria-label="Back to customers"
          >
            <ChevronLeft className="size-3.5" />
            Customers
          </button>
          <div className="w-px h-4 bg-stone-200 shrink-0" />
          <div className="h-7 w-7 rounded-md bg-emerald-100 flex items-center justify-center shrink-0">
            <Building2 className="h-3.5 w-3.5 text-emerald-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-semibold text-stone-800 leading-tight">New Customer</h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => navigate('/crm/customer')}
              disabled={isPending}
              className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 hover:border-stone-300 disabled:opacity-50 transition-all"
            >
              <X className="size-3" />
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-1.5 text-xs font-semibold text-stone-900 hover:bg-brand-hover disabled:opacity-50 transition-all shadow-sm"
            >
              {isPending ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
              {isPending ? 'Saving…' : 'Save Customer'}
            </button>
          </div>
        </div>

        {/* Error bar */}
        {createError && (
          <div className="shrink-0 bg-red-50 border-b border-red-100 px-6 py-2 flex items-center gap-2 text-xs text-red-700">
            <AlertCircle className="size-3.5 shrink-0" />
            {apiErrorMessage(createError, 'Failed to save customer.')}
          </div>
        )}

        {/* Scrollable form body */}
        <div className="flex-1 overflow-y-auto modal-scrollbar">
          <div className="px-5 py-5 space-y-5">
            <CrmRecordForm
              core={{ fields: coreFields, onChange: set }}
              custom={{ defs: customFieldDefs, values: customFieldValues, onChange: (key, value) => setCustomFieldValues((prev) => ({ ...prev, [key]: value })) }}
              owner={{ userId: ownerUserId, onChange: setOwnerUserId, users }}
            />
            <EditableFilesPanel />
            <div className="h-6" />
          </div>
        </div>
      </form>
    </div>
  );
}
