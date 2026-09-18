import { useState, useMemo, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Building2, AlertCircle, ChevronRight, Loader2, Save  } from 'lucide-react';
import { toast } from 'sonner';
import { crmService } from '@/services/crmService';
import { lookupService } from '@/services/lookupService';
import { defaultCountryId, defaultCurrencyId } from '@/lib/lookupDefaults';
import { workflowService, userService } from '@/services/tenantServices';
import { activeCustomFields } from '@/lib/customFields';
import { apiErrorMessage } from '@/api/tenantClient';
import { CrmRecordForm } from '@/components/crm/CrmRecordForm';
import { FormActionBar } from '@/components/crm/FormPrimitives';
import { StatusDropdown } from '@/components/crm/StatusDropdown';
import { EditableFilesPanel, type EditableFilesPanelHandle } from '@/components/crm/CrmSubTabsPanel';
import { UnsavedChangesPrompt } from '@/components/UnsavedChangesPrompt';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { useScrollToError } from '@/hooks/useScrollToError';
import { crmCoreDefaults, primaryAddressFields } from '@/lib/crmFields';
import { customerCoreDefaults } from '@/lib/customerDefaults';
import type { CustomerRef } from '@/pages/sales/components/CustomerPicker';
import { validateCrmRecord, type CrmFieldError } from '@/lib/crmValidation';
import { CrmPageHeader } from '@/pages/crm/components/CrmPageHeader';
import { cn } from '@/lib/utils';
import {
  NAME_PARAM, RETURN_TO_PARAM, isSafeReturnPath, returnRouterState,
} from '@/lib/recordCreateReturn';
import type { FieldDefinition, WorkflowRecord } from '@/types/tenant';

const CUSTOMER_LIST_PATH = '/crm/customer';

/** Maps a just-created (or already-loaded) customer record into the same
 *  CustomerRef shape CustomerPicker's search results produce — so a customer
 *  created via the "Create Customer" round trip auto-fills Bill To/currency/
 *  tax/terms exactly like one picked from the list would. */
function toCustomerRef(record: WorkflowRecord): CustomerRef {
  return {
    id: record.id,
    name: String(record.coreFields.customer_name ?? '(unnamed)'),
    ...customerCoreDefaults(record.coreFields),
  };
}

const TABS = [
  { key: 'details', label: 'Details' },
  { key: 'files', label: 'Files' },
] as const;

type Tab = (typeof TABS)[number]['key'];

export default function AddCustomerPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const panelRef = useRef<EditableFilesPanelHandle>(null);

  // Opened from a document's Customer picker ("Create Customer" for a typed
  // name the list doesn't have): the typed name is prefilled, and saving or
  // cancelling returns to that document, which restores its unsaved form
  // (see lib/recordCreateReturn.ts).
  const [searchParams] = useSearchParams();
  const returnParam = searchParams.get(RETURN_TO_PARAM);
  const returnTo = isSafeReturnPath(returnParam) ? returnParam : null;

  const [activeTab, setActiveTab] = useState<Tab>('details');
  const [coreFields, setCoreFields] = useState<Record<string, unknown>>(
    () => ({ ...crmCoreDefaults(), customer_name: searchParams.get(NAME_PARAM) ?? '' }),
  );
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, unknown>>({});
  const [ownerUserId, setOwnerUserId] = useState('');
  const [crmStatusId, setCrmStatusId] = useState('');
  const [isUploadingFiles, setIsUploadingFiles] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<CrmFieldError[]>([]);

  const set = (key: string, value: unknown) => {
    if (validationErrors.length > 0) setValidationErrors([]);
    setCoreFields((d) => {
      if (key === 'customer_is_bill_as_primary' && value === true) {
        return { ...d, ...primaryAddressFields(d, 'bill'), [key]: value };
      }
      if (key === 'customer_is_ship_as_primary' && value === true) {
        return { ...d, ...primaryAddressFields(d, 'ship'), [key]: value };
      }
      return { ...d, [key]: value };
    });
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

  const { data: users = [] } = useQuery({ queryKey: ['assignable-users'], queryFn: userService.listAssignableUsers });

  const { data: lookups } = useQuery({
    queryKey: ['crm-lookups'],
    queryFn: lookupService.getCrmLookups,
    staleTime: 10 * 60 * 1000,
  });

  // New customers default their address country / currency fields to United
  // States / USD once the lookups load — derived rather than copied into
  // state, so it never clobbers a value the user already set.
  const formCoreFields = useMemo(() => {
    if (!lookups) return coreFields;
    return {
      ...coreFields,
      customer_addr_country: coreFields.customer_addr_country || defaultCountryId(lookups.countries),
      customer_bill_addr_country: coreFields.customer_bill_addr_country || defaultCountryId(lookups.countries),
      customer_ship_addr_country: coreFields.customer_ship_addr_country || defaultCountryId(lookups.countries),
      customer_currency: coreFields.customer_currency || defaultCurrencyId(lookups.currencies),
    };
  }, [coreFields, lookups]);

  const guard = useUnsavedChangesGuard({ coreFields, customFieldValues, ownerUserId, crmStatusId });

  function leave(createdRecord: WorkflowRecord | null) {
    if (returnTo) navigate(returnTo, { state: returnRouterState(createdRecord ? toCustomerRef(createdRecord) : null) });
    else navigate(CUSTOMER_LIST_PATH);
  }

  const { mutate: createCustomer, isPending, error: createError } = useMutation({
    mutationFn: () =>
      crmService.createRecord('customer', {
        coreFields: formCoreFields,
        customFields: customFieldValues,
        ownerUserId: ownerUserId || undefined,
        crmStatusId: crmStatusId || undefined,
      }),
    onSuccess: async (record) => {
      toast.success(returnTo ? 'Customer created and added to your document.' : 'Customer created.');
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
      leave(record);
    },
  });
  const errorRef = useScrollToError<HTMLDivElement>(createError);

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-stone-50">
      <UnsavedChangesPrompt guard={guard} />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const errors = validateCrmRecord(formCoreFields, customFieldDefs, customFieldValues);
          if (errors.length > 0) { setValidationErrors(errors); setActiveTab('details'); return; }
          setValidationErrors([]);
          createCustomer();
        }}
        className="flex flex-col flex-1 min-h-0"
      >
        <CrmPageHeader
          backLabel={returnTo ? 'Back' : 'Customers'}
          onBack={() => leave(null)}
          icon={Building2}
          iconBg="bg-emerald-100"
          iconColor="text-emerald-600"
          title="New Customer"
          subtitle={returnTo
            ? "Fields marked * are required. You'll go back to your document after saving."
            : 'Fields marked * are required.'}
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
          <div
            ref={errorRef}
            tabIndex={-1}
            role="alert"
            className="shrink-0 flex items-start gap-3 border-b border-red-200 bg-red-50 px-5 py-2.5 focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-inset"
          >
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
              <p className="text-xs font-semibold text-red-700 mb-1.5">Please review the highlighted fields before saving:</p>
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
                core={{ fields: formCoreFields, onChange: set }}
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
          onCancel={() => leave(null)}
          isPending={isPending}
          isUploadingFiles={isUploadingFiles}
          submitLabel="Save Customer"
        />
      </form>
    </div>
  );
}
