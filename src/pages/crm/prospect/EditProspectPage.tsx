import { useState, useCallback, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, AlertCircle, ChevronRight, Loader2, Save } from 'lucide-react';
import { crmService } from '@/services/crmService';
import { workflowService } from '@/services/tenantServices';
import { apiErrorMessage } from '@/api/tenantClient';
import { StatusDropdown } from '@/components/crm/StatusDropdown';
import { CrmRecordForm } from '@/components/crm/CrmRecordForm';
import { FormActionBar } from '@/components/crm/FormPrimitives';
import { EditableFilesPanel } from '@/components/crm/CrmSubTabsPanel';
import { Spinner, ErrorNote } from '@/components/tenant/ui';
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

export default function EditProspectPage() {
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
    queryFn: () => crmService.getRecord(id, 'prospect'),
    enabled: Boolean(id),
  });

  const coreFields = localCoreFields ?? { ...crmCoreDefaults(), ...record?.coreFields };
  const customFieldValues = localCustomFields ?? record?.customFields ?? {};
  const currentStateId = localStateId ?? record?.currentStateId ?? '';

  const { data: allWorkflows = [] } = useQuery({ queryKey: ['workflows'], queryFn: workflowService.list });
  const prospectWorkflow = allWorkflows.find((wf) => wf.key.toLowerCase() === 'prospect');
  const { data: prospectDef } = useQuery({
    queryKey: ['workflow', prospectWorkflow?.id],
    queryFn: () => workflowService.get(prospectWorkflow!.id),
    enabled: Boolean(prospectWorkflow?.id),
  });
  const customFieldDefs: FieldDefinition[] = prospectDef?.fields ?? [];

  const routeMap: Record<string, string> = {
    lead: '/crm/lead',
    prospect: '/crm/prospect',
    customer: '/crm/customer',
  };

  const transition = useMutation({
    mutationFn: (toStateId: string) => crmService.transitionRecord(id, toStateId, 'prospect'),
    onSuccess: (updated) => {
      setLocalStateId(updated.currentStateId);
      queryClient.invalidateQueries({ queryKey: ['crm-record', id] });
      queryClient.invalidateQueries({ queryKey: ['crm-records', 'prospect'] });
      const newType = updated.workflowId?.toLowerCase();
      if (newType && newType !== 'prospect' && routeMap[newType]) {
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
    [currentStateId, transition],
  );

  const save = useMutation({
    mutationFn: () =>
      crmService.updateRecord(id, { coreFields, customFields: customFieldValues }, 'prospect'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-record', id] });
      queryClient.invalidateQueries({ queryKey: ['crm-records', 'prospect'] });
      navigate('/crm/prospect');
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

  if (isLoading) return <div className="p-6"><Spinner label="Loading prospect…" /></div>;
  if (loadError || !record)
    return <div className="p-6"><ErrorNote>{apiErrorMessage(loadError, 'Failed to load prospect.')}</ErrorNote></div>;

  const company = String(coreFields.customer_name ?? '—');
  const saveError = save.error ?? transition.error;

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-stone-50">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const errors = validateCrmRecord(coreFields, customFieldDefs, customFieldValues);
          if (errors.length > 0) { setValidationErrors(errors); setActiveTab('details'); return; }
          setValidationErrors([]);
          save.mutate();
        }}
        className="flex flex-col flex-1 min-h-0"
      >
        <CrmPageHeader
          backLabel="Prospects"
          onBack={() => navigate('/crm/prospect')}
          icon={Users}
          iconBg="bg-blue-100"
          iconColor="text-blue-600"
          title={company}
          subtitle="Prospect"
          recordNumber={record.recordNumber}
          actions={(
            <button
              type="submit"
              disabled={save.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-1.5 text-xs font-semibold text-stone-900 hover:bg-brand-hover disabled:opacity-50 transition-all shadow-sm"
            >
              {save.isPending ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
              {save.isPending ? 'Saving…' : 'Save Changes'}
            </button>
          )}
        />

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
                    workflowKey="prospect"
                    mode="transitions"
                    recordId={id}
                    value={currentStateId}
                    onChange={handleStatusChange}
                    disabled={transition.isPending}
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
          onCancel={() => navigate('/crm/prospect')}
          isPending={save.isPending}
        />
      </form>
    </div>
  );
}
