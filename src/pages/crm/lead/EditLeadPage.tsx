import { useState, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Sparkles, AlertCircle, Loader2, Save, X } from 'lucide-react';
import { crmService } from '@/services/crmService';
import { workflowService } from '@/services/tenantServices';
import { apiErrorMessage } from '@/api/tenantClient';
import { StatusDropdown } from '@/components/crm/StatusDropdown';
import { DeleteRecordDialog } from '@/components/crm/DeleteRecordDialog';
import { CrmRecordForm } from '@/components/crm/CrmRecordForm';
import { EditableFilesPanel } from '@/components/crm/CrmSubTabsPanel';
import { Spinner, ErrorNote } from '@/components/tenant/ui';
import { crmCoreDefaults } from '@/lib/crmFields';
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
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>('details');

  const [localCoreFields, setLocalCoreFields] = useState<Record<string, unknown> | null>(null);
  const [localCustomFields, setLocalCustomFields] = useState<Record<string, unknown> | null>(null);
  const [localStateId, setLocalStateId] = useState<string | null>(null);

  const { data: record, isLoading, error: loadError } = useQuery({
    queryKey: ['crm-record', id],
    queryFn: () => crmService.getRecord(id, 'lead'),
    enabled: Boolean(id),
  });

  const coreFields = localCoreFields ?? { ...crmCoreDefaults(), ...record?.coreFields };
  const customFieldValues = localCustomFields ?? record?.customFields ?? {};
  const currentStateId = localStateId ?? record?.currentStateId ?? '';

  const { data: allWorkflows = [] } = useQuery({ queryKey: ['workflows'], queryFn: workflowService.list });
  const leadWorkflow = allWorkflows.find((wf) => wf.key.toLowerCase() === 'lead');
  const { data: leadDef } = useQuery({
    queryKey: ['workflow', leadWorkflow?.id],
    queryFn: () => workflowService.get(leadWorkflow?.id ?? ''),
    enabled: Boolean(leadWorkflow?.id),
  });
  const customFieldDefs: FieldDefinition[] = leadDef?.fields ?? [];

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
      navigate('/crm/lead');
    },
  });

  const set = (key: string, value: unknown) =>
    setLocalCoreFields((prev) => ({ ...(prev ?? { ...crmCoreDefaults(), ...record?.coreFields }), [key]: value }));

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

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-stone-50">
      <form
        onSubmit={(e) => { e.preventDefault(); save.mutate(); }}
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
          deleteSlot={(
            <DeleteRecordDialog
              recordId={id}
              workflowKey="lead"
              label={`Lead — ${company}`}
              onDeleted={() => {
                queryClient.invalidateQueries({ queryKey: ['crm-records', 'lead'] });
                navigate('/crm/lead');
              }}
            />
          )}
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

        {/* Error banner */}
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

        {/* Tab bar */}
        <div className="flex shrink-0 border-b border-stone-200 bg-white px-5">
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
          <div className="px-4 py-3 pb-24 space-y-3">
            {activeTab === 'details' && (
              <CrmRecordForm
                core={{ fields: coreFields, onChange: set }}
                custom={{
                  defs: customFieldDefs,
                  values: customFieldValues,
                  onChange: (key, value) =>
                    setLocalCustomFields((prev) => ({ ...(prev ?? record?.customFields ?? {}), [key]: value })),
                }}
                statusNode={(
                  <StatusDropdown
                    workflowKey="lead"
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

        {/* Fixed bottom action bar */}
        <div className="fixed bottom-0 left-0 right-0 lg:left-56 z-20 border-t border-stone-200 bg-white px-6 py-3 flex items-center justify-end gap-3 shadow-[0_-2px_8px_rgba(0,0,0,0.08)]">
          <button
            type="button"
            onClick={() => navigate('/crm/lead')}
            disabled={save.isPending}
            className="inline-flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-50 hover:border-stone-300 disabled:opacity-50 transition-all"
          >
            <X className="size-3.5" />
            Cancel
          </button>
          <button
            type="submit"
            disabled={save.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-brand px-5 py-2 text-sm font-semibold text-stone-900 hover:bg-brand-hover disabled:opacity-50 transition-all shadow-sm active:scale-95"
          >
            {save.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {save.isPending ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}
