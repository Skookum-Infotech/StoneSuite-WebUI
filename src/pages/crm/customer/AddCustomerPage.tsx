import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Building2, AlertCircle, Loader2, Save, X } from 'lucide-react';
import { crmService } from '@/services/crmService';
import { workflowService, userService } from '@/services/tenantServices';
import { apiErrorMessage } from '@/api/tenantClient';
import { CrmRecordForm } from '@/components/crm/CrmRecordForm';
import { StatusDropdown } from '@/components/crm/StatusDropdown';
import { EditableFilesPanel, type EditableFilesPanelHandle } from '@/components/crm/CrmSubTabsPanel';
import { crmCoreDefaults } from '@/lib/crmFields';
import { CrmPageHeader } from '@/pages/crm/components/CrmPageHeader';
import type { FieldDefinition } from '@/types/tenant';

export default function AddCustomerPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const panelRef = useRef<EditableFilesPanelHandle>(null);
  const [coreFields, setCoreFields] = useState<Record<string, unknown>>(() => crmCoreDefaults());
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, unknown>>({});
  const [ownerUserId, setOwnerUserId] = useState('');
  const [crmStatusId, setCrmStatusId] = useState('');
  const [isUploadingFiles, setIsUploadingFiles] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const set = (key: string, value: unknown) => setCoreFields((d) => ({ ...d, [key]: value }));
  const handleStatusChange = useCallback((stateId: string) => setCrmStatusId(stateId), []);

  const { data: allWorkflows = [] } = useQuery({ queryKey: ['workflows'], queryFn: workflowService.list });
  const customerWorkflow = allWorkflows.find((wf) => wf.key.toLowerCase() === 'customer');
  const { data: customerDef } = useQuery({
    queryKey: ['workflow', customerWorkflow?.id],
    queryFn: () => workflowService.get(customerWorkflow?.id ?? ''),
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
        crmStatusId: crmStatusId || undefined,
      }),
    onSuccess: async (record) => {
      queryClient.invalidateQueries({ queryKey: ['crm-records', 'customer'] });
      if (panelRef.current?.hasStagedFiles()) {
        setIsUploadingFiles(true);
        try {
          await panelRef.current.uploadStagedTo(record.id);
        } catch {
          // Record was created; surface the upload failure but still navigate
          setUploadError('Customer saved, but file upload failed. Re-upload from the record page.');
        } finally {
          setIsUploadingFiles(false);
        }
      }
      navigate('/crm/customer');
    },
  });

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-stone-50">
      <form
        onSubmit={(e) => { e.preventDefault(); createCustomer(); }}
        className="flex flex-col flex-1 min-h-0"
      >
        <CrmPageHeader
          backLabel="Customers"
          onBack={() => navigate('/crm/customer')}
          icon={Building2}
          iconBg="bg-emerald-100"
          iconColor="text-emerald-600"
          title="New Customer"
          subtitle="Fields marked * are required."
          actions={(
            <>
              <button
                type="submit"
                disabled={isPending || isUploadingFiles}
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-1.5 text-xs font-semibold text-stone-900 hover:bg-brand-hover disabled:opacity-50 transition-all shadow-sm"
              >
                {(isPending || isUploadingFiles) ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
                {isPending ? 'Saving…' : isUploadingFiles ? 'Uploading…' : 'Save Customer'}
              </button>
            </>
          )}
        />

        {/* Error / upload-error banners */}
        {createError && (
          <div className="shrink-0 flex items-start gap-3 border-b border-red-200 bg-red-50 px-5 py-2.5">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-100">
              <AlertCircle className="size-3 text-red-600" />
            </span>
            <p className="text-xs text-red-700">
              <span className="font-bold">Error: </span>
              {apiErrorMessage(createError, 'Failed to save customer.')}
            </p>
          </div>
        )}
        {uploadError && (
          <div className="shrink-0 flex items-start gap-3 border-b border-amber-200 bg-amber-50 px-5 py-2.5">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-100">
              <AlertCircle className="size-3 text-amber-600" />
            </span>
            <p className="text-xs text-amber-800">
              <span className="font-bold">Warning: </span>
              {uploadError}
            </p>
          </div>
        )}

        {/* Scrollable form body */}
        <div className="flex-1 overflow-y-auto modal-scrollbar">
          <div className="px-4 py-3 pb-24 space-y-3">
            <CrmRecordForm
              core={{ fields: coreFields, onChange: set }}
              custom={{ defs: customFieldDefs, values: customFieldValues, onChange: (key, value) => setCustomFieldValues((prev) => ({ ...prev, [key]: value })) }}
              owner={{ userId: ownerUserId, onChange: setOwnerUserId, users }}
              statusNode={(
                <StatusDropdown
                  workflowKey="customer"
                  mode="all"
                  value={crmStatusId}
                  onChange={handleStatusChange}
                />
              )}
            />
            <EditableFilesPanel ref={panelRef} />
          </div>
        </div>

        {/* Fixed bottom action bar — offset by sidebar width on desktop */}
        <div className="fixed bottom-0 left-0 right-0 lg:left-56 z-20 border-t border-stone-200 bg-white px-6 py-3 flex items-center justify-end gap-3 shadow-[0_-2px_8px_rgba(0,0,0,0.08)]">
          <button
            type="button"
            onClick={() => navigate('/crm/customer')}
            disabled={isPending}
            className="inline-flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-50 hover:border-stone-300 disabled:opacity-50 transition-all"
          >
            <X className="size-3.5" />
            Cancel
          </button>
          <button
            type="submit"
            disabled={isPending || isUploadingFiles}
            className="inline-flex items-center gap-2 rounded-lg bg-brand px-5 py-2 text-sm font-semibold text-stone-900 hover:bg-brand-hover disabled:opacity-50 transition-all shadow-sm active:scale-95"
          >
            {(isPending || isUploadingFiles) ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {isPending ? 'Saving…' : isUploadingFiles ? 'Uploading…' : 'Save Customer'}
          </button>
        </div>
      </form>
    </div>
  );
}
