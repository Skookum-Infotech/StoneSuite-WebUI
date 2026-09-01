import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Building2, AlertCircle, ChevronRight, Loader2, Save  } from 'lucide-react';
import { crmService } from '@/services/crmService';
import { workflowService, userService } from '@/services/tenantServices';
import { activeCustomFields } from '@/lib/customFields';
import { apiErrorMessage } from '@/api/tenantClient';
import { CrmRecordForm } from '@/components/crm/CrmRecordForm';
import { FormActionBar } from '@/components/crm/FormPrimitives';
import { StatusDropdown } from '@/components/crm/StatusDropdown';
import { EditableFilesPanel, type EditableFilesPanelHandle } from '@/components/crm/CrmSubTabsPanel';
import { UnsavedChangesPrompt } from '@/components/UnsavedChangesPrompt';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { crmCoreDefaults } from '@/lib/crmFields';
import { validateCrmRecord, type CrmFieldError } from '@/lib/crmValidation';
import { CrmPageHeader } from '@/pages/crm/components/CrmPageHeader';
import { cn } from '@/lib/utils';
import type { FieldDefinition } from '@/types/tenant';

const TABS = [
  { key: 'details', label: 'Details' },
  { key: 'files', label: 'Files' },
] as const;

type Tab = (typeof TABS)[number]['key'];

export default function AddCustomerPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const panelRef = useRef<EditableFilesPanelHandle>(null);
  const [activeTab, setActiveTab] = useState<Tab>('details');
  const [coreFields, setCoreFields] = useState<Record<string, unknown>>(() => crmCoreDefaults());
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, unknown>>({});
  const [ownerUserId, setOwnerUserId] = useState('');
  const [crmStatusId, setCrmStatusId] = useState('');
  const [isUploadingFiles, setIsUploadingFiles] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<CrmFieldError[]>([]);

  const set = (key: string, value: unknown) => {
    if (validationErrors.length > 0) setValidationErrors([]);
    setCoreFields((d) => ({ ...d, [key]: value }));
  };
  const handleStatusChange = useCallback((stateId: string) => setCrmStatusId(stateId), []);

  const { data: allWorkflows = [] } = useQuery({ queryKey: ['workflows'], queryFn: workflowService.list });
  const customerWorkflow = allWorkflows.find((wf) => wf.key.toLowerCase() === 'customer');
  const { data: customerDef } = useQuery({
    queryKey: ['workflow', customerWorkflow?.id],
    queryFn: () => workflowService.get(customerWorkflow?.id ?? ''),
    enabled: Boolean(customerWorkflow?.id),
  });
  const customFieldDefs: FieldDefinition[] = activeCustomFields(customerDef);

  const { data: users = [] } = useQuery({ queryKey: ['workspace-users'], queryFn: userService.listUsers });

  const guard = useUnsavedChangesGuard({ coreFields, customFieldValues, ownerUserId, crmStatusId });

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
      guard.markClean();
      navigate('/crm/customer');
    },
  });

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-stone-50">
      <UnsavedChangesPrompt guard={guard} />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const errors = validateCrmRecord(coreFields, customFieldDefs, customFieldValues);
          if (errors.length > 0) { setValidationErrors(errors); setActiveTab('details'); return; }
          setValidationErrors([]);
          createCustomer();
        }}
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
        {validationErrors.length > 0 && (
          <div className="shrink-0 flex items-start gap-3 border-b border-red-200 bg-red-50 px-5 py-3">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-100">
              <AlertCircle className="size-3 text-red-600" />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-red-700 mb-1.5">Please fill in the required fields before saving:</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {validationErrors.map((e) => (
                  <span key={e.key} className="inline-flex items-center gap-1 text-xs text-red-600">
                    <ChevronRight className="size-3 shrink-0" />{e.label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab bar */}
        <div className="flex shrink-0 border-b border-stone-200 bg-white px-5 3xl:px-10 4xl:px-16">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors',
                activeTab === tab.key
                  ? 'border-stone-800 text-stone-900'
                  : 'border-transparent text-stone-400 hover:text-stone-600 hover:border-stone-300',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Scrollable form body */}
        <div className="flex-1 overflow-y-auto modal-scrollbar">
          <div className="px-4 py-3 pb-24 space-y-2 3xl:px-10 3xl:py-5 4xl:px-16 4xl:py-8">
            {activeTab === 'details' && (
              <CrmRecordForm
                core={{ fields: coreFields, onChange: set }}
                custom={{ defs: customFieldDefs, values: customFieldValues, onChange: (key, value) => { if (validationErrors.length > 0) setValidationErrors([]); setCustomFieldValues((prev) => ({ ...prev, [key]: value })); } }}
                owner={{ userId: ownerUserId, onChange: setOwnerUserId, users }}
                invalidKeys={validationErrors.length > 0 ? new Set(validationErrors.map((e) => e.key)) : undefined}
                statusNode={(
                  <StatusDropdown
                    workflowKey="customer"
                    mode="all"
                    value={crmStatusId}
                    onChange={handleStatusChange}
                  />
                )}
              />
            )}
            {/* Always mounted so staged files survive tab switches and are available in onSuccess */}
            <div className={activeTab === 'files' ? '' : 'hidden'}>
              <EditableFilesPanel ref={panelRef} />
            </div>
          </div>
        </div>

        <FormActionBar
          onCancel={() => navigate('/crm/customer')}
          isPending={isPending}
          isUploadingFiles={isUploadingFiles}
          submitLabel="Save Customer"
        />
      </form>
    </div>
  );
}
