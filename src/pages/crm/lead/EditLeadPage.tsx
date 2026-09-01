import { useState, useCallback, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Sparkles, AlertCircle, ChevronRight, Loader2, Save, ShieldAlert } from 'lucide-react';
import { crmService } from '@/services/crmService';
import { workflowService } from '@/services/tenantServices';
import { activeCustomFields } from '@/lib/customFields';
import { apiErrorMessage } from '@/api/tenantClient';
import { StatusDropdown } from '@/components/crm/StatusDropdown';
import { ApprovalBanner } from '@/components/tenant/ApprovalBanner';
import { CrmRecordForm } from '@/components/crm/CrmRecordForm';
import { FormActionBar } from '@/components/crm/FormPrimitives';
import { EditableFilesPanel } from '@/components/crm/CrmSubTabsPanel';
import { Spinner, ErrorNote } from '@/components/tenant/ui';
import { UnsavedChangesPrompt } from '@/components/UnsavedChangesPrompt';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { crmCoreDefaults } from '@/lib/crmFields';
import { validateCrmRecord, type CrmFieldError } from '@/lib/crmValidation';
import { useBreadcrumbStore } from '@/store/useBreadcrumbStore';
import { CrmPageHeader } from '@/pages/crm/components/CrmPageHeader';
import { cn } from '@/lib/utils';
import type { FieldDefinition } from '@/types/tenant';

const TABS = [
  { key: 'details', label: 'Details' },
  { key: 'files', label: 'Files' },
] as const;

type Tab = (typeof TABS)[number]['key'];

export default function EditLeadPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  const initialTab = (location.state as { initialTab?: Tab } | null)?.initialTab ?? 'details';
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);

  const [localCoreFields, setLocalCoreFields] = useState<Record<string, unknown> | null>(null);
  const [localCustomFields, setLocalCustomFields] = useState<Record<string, unknown> | null>(null);
  const [localStateId, setLocalStateId] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<CrmFieldError[]>([]);

  const { data: record, isLoading, error: loadError } = useQuery({
    queryKey: ['crm-record', id],
    queryFn: () => crmService.getRecord(id, 'lead'),
    enabled: Boolean(id),
  });

  const coreFields = localCoreFields ?? { ...crmCoreDefaults(), ...record?.coreFields };
  const customFieldValues = localCustomFields ?? record?.customFields ?? {};
  const currentStateId = localStateId ?? record?.currentStateId ?? '';

  // Status is excluded: a transition is persisted the moment it is picked, so it
  // is never an unsaved edit.
  const guard = useUnsavedChangesGuard({ coreFields, customFieldValues }, Boolean(record));

  const { data: allWorkflows = [] } = useQuery({ queryKey: ['workflows'], queryFn: workflowService.list });
  const leadWorkflow = allWorkflows.find((wf) => wf.key.toLowerCase() === 'lead');
  const { data: leadDef } = useQuery({
    queryKey: ['workflow', leadWorkflow?.id],
    queryFn: () => workflowService.get(leadWorkflow?.id ?? ''),
    enabled: Boolean(leadWorkflow?.id),
  });
  const customFieldDefs: FieldDefinition[] = activeCustomFields(leadDef);

  const routeMap: Record<string, string> = {
    lead: '/crm/lead',
    prospect: '/crm/prospect',
    customer: '/crm/customer',
  };

  const transition = useMutation({
    mutationFn: (toStateId: string) => crmService.transitionRecord(id, toStateId, 'lead'),
    onSuccess: (updated) => {
      setLocalStateId(updated.currentStateId);
      queryClient.invalidateQueries({ queryKey: ['crm-record', id] });
      queryClient.invalidateQueries({ queryKey: ['crm-records', 'lead'] });
      const newType = updated.workflowId?.toLowerCase();
      if (newType && newType !== 'lead' && routeMap[newType]) {
        queryClient.invalidateQueries({ queryKey: ['crm-records', newType] });
        guard.markClean();
        navigate(`${routeMap[newType]}/${updated.id}`);
      }
    },
  });

  const handleStatusChange = useCallback(
    (toStateId: string) => {
      if (toStateId !== currentStateId) {
        setLocalStateId(toStateId);
        transition.mutate(toStateId);
      }
    },
    // transition.mutate is a stable reference from TanStack Query; transition object is not
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentStateId, transition.mutate],
  );

  const save = useMutation({
    mutationFn: () =>
      crmService.updateRecord(id, { coreFields, customFields: customFieldValues }, 'lead'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-record', id] });
      queryClient.invalidateQueries({ queryKey: ['crm-records', 'lead'] });
      guard.markClean();
      navigate('/crm/lead');
    },
  });

  const set = (key: string, value: unknown) => {
    if (validationErrors.length > 0) setValidationErrors([]);
    setLocalCoreFields((prev) => ({ ...(prev ?? { ...crmCoreDefaults(), ...record?.coreFields }), [key]: value }));
  };

  const setLabel = useBreadcrumbStore((s) => s.setLabel);
  const clearLabel = useBreadcrumbStore((s) => s.clearLabel);
  useEffect(() => {
    if (record?.recordNumber) {
      setLabel(id, record.recordNumber);
      return () => clearLabel(id);
    }
  }, [id, record?.recordNumber, setLabel, clearLabel]);

  if (isLoading) return <div className="p-6"><Spinner label="Loading lead…" /></div>;
  if (loadError || !record)
    return <div className="p-6"><ErrorNote>{apiErrorMessage(loadError, 'Failed to load lead.')}</ErrorNote></div>;

  const nameParts = [coreFields.customer_authorized_person_fname, coreFields.customer_authorized_person_lname].filter(Boolean).join(' ');
  const company = String((coreFields.customer_name ?? nameParts) || '—');
  const saveError = save.error ?? transition.error;
  const approval = record.approval;
  // A record awaiting approval is locked server-side (UpdateRecord returns
  // 409) — the Save button is disabled here too so the click never round-
  // trips. Editing a REJECTED record is how its owner resubmits it, so that
  // stays fully editable; only 'pending' locks.
  const locked = approval?.status === 'pending';

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-stone-50">
      <UnsavedChangesPrompt guard={guard} />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (locked) return;
          const errors = validateCrmRecord(coreFields, customFieldDefs, customFieldValues);
          if (errors.length > 0) { setValidationErrors(errors); setActiveTab('details'); return; }
          setValidationErrors([]);
          save.mutate();
        }}
        className="flex flex-col flex-1 min-h-0"
      >
        <CrmPageHeader
          backLabel="Leads"
          onBack={() => navigate('/crm/lead')}
          icon={Sparkles}
          iconBg="bg-purple-100"
          iconColor="text-purple-600"
          title={company}
          subtitle="Lead"
          recordNumber={record.recordNumber}
          actions={(
            <button
              type="submit"
              disabled={save.isPending || locked}
              title={locked ? 'This record is awaiting approval and cannot be edited.' : undefined}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-1.5 text-xs font-semibold text-stone-900 hover:bg-brand-hover disabled:opacity-50 transition-all shadow-sm"
            >
              {save.isPending ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
              {save.isPending ? 'Saving…' : 'Save Changes'}
            </button>
          )}
        />

        {locked && (
          <div className="shrink-0 flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-5 py-2.5">
            <ShieldAlert className="size-4 shrink-0 text-amber-500" aria-hidden="true" />
            <p className="text-xs font-medium text-amber-800">
              <span className="font-semibold">Locked</span> — this record is awaiting approval and cannot be edited
              until it is approved.
            </p>
          </div>
        )}
        {approval?.status === 'rejected' && (
          <ApprovalBanner
            status="rejected"
            approverNames={[]}
            canApprove={false}
            onApprove={() => {}}
            rejection={{ byName: approval.rejectedByName, reason: approval.rejectionReason }}
          />
        )}

        {saveError && (
          <div className="shrink-0 flex items-start gap-3 border-b border-red-200 bg-red-50 px-5 py-2.5">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-100">
              <AlertCircle className="size-3 text-red-600" />
            </span>
            <p className="text-xs text-red-700">
              <span className="font-bold">Error: </span>
              {apiErrorMessage(saveError, 'Failed to save.')}
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
        <div className="flex shrink-0 border-b border-stone-200 bg-white px-5 3xl:px-12 4xl:px-16">
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

        {/* Two-column body — browser scrolls, not an inner div */}
        <div className="flex flex-col px-4 py-4 pb-24 sm:px-5 sm:py-5 3xl:px-12 3xl:py-8 4xl:px-16 4xl:py-10">
          <div className="flex-1 space-y-2 min-w-0">
            {activeTab === 'details' && (
              <CrmRecordForm
                core={{ fields: coreFields, onChange: set }}
                custom={{
                  defs: customFieldDefs,
                  values: customFieldValues,
                  onChange: (key, value) => {
                    if (validationErrors.length > 0) setValidationErrors([]);
                    setLocalCustomFields((prev) => ({ ...(prev ?? record?.customFields ?? {}), [key]: value }));
                  },
                }}
                invalidKeys={validationErrors.length > 0 ? new Set(validationErrors.map((e) => e.key)) : undefined}
                statusNode={(
                  <StatusDropdown
                    workflowKey="lead"
                    mode="transitions"
                    recordId={id}
                    value={currentStateId}
                    onChange={handleStatusChange}
                    disabled={transition.isPending}
                    gated={approval?.gated}
                  />
                )}
              />
            )}
            {/* Always mounted so upload state is preserved across tab switches */}
            <div className={activeTab === 'files' ? '' : 'hidden'}>
              <EditableFilesPanel recordId={id} />
            </div>
          </div>

        </div>

        <FormActionBar
          onCancel={() => navigate('/crm/lead')}
          isPending={save.isPending}
        />
      </form>
    </div>
  );
}
