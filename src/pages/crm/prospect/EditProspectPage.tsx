import { useState, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users, AlertCircle, Loader2, Save, X, ChevronLeft,
} from 'lucide-react';
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
import type { FieldDefinition } from '@/types/tenant';

export default function EditProspectPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [localCoreFields, setLocalCoreFields] = useState<Record<string, unknown> | null>(null);
  const [localCustomFields, setLocalCustomFields] = useState<Record<string, unknown> | null>(null);
  const [localStateId, setLocalStateId] = useState<string | null>(null);

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

  if (isLoading) return <div className="p-6"><Spinner label="Loading prospect…" /></div>;
  if (loadError || !record)
    return <div className="p-6"><ErrorNote>{apiErrorMessage(loadError, 'Failed to load prospect.')}</ErrorNote></div>;

  const company = String(coreFields.customer_name ?? '—');
  const saveError = save.error ?? transition.error;

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-stone-50">
      <form
        onSubmit={(e) => { e.preventDefault(); save.mutate(); }}
        className="flex flex-col flex-1 min-h-0"
      >
        {/* Sticky top bar */}
        <div className="shrink-0 bg-white border-b border-stone-100 px-4 py-2.5 flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/crm/prospect')}
            className="flex items-center gap-1 text-xs text-stone-400 hover:text-stone-600 transition-colors px-1.5 py-1 rounded-md hover:bg-stone-100 shrink-0"
            aria-label="Back to prospects"
          >
            <ChevronLeft className="size-3.5" />
            Prospects
          </button>
          <div className="w-px h-4 bg-stone-200 shrink-0" />
          <div className="h-7 w-7 rounded-md bg-blue-100 flex items-center justify-center shrink-0">
            <Users className="h-3.5 w-3.5 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-semibold text-stone-800 leading-tight truncate">{company}</h1>
            <p className="text-2xs text-stone-400">Prospect</p>
          </div>
          <div className="w-px h-4 bg-stone-200 shrink-0" />
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="[&>button]:text-xs [&>button]:px-2.5 [&>button]:py-1.5 [&>button]:rounded-lg">
              <DeleteRecordDialog
                recordId={id}
                workflowKey="prospect"
                label={`Prospect — ${company}`}
                onDeleted={() => {
                  queryClient.invalidateQueries({ queryKey: ['crm-records', 'prospect'] });
                  navigate('/crm/prospect');
                }}
              />
            </div>
          </div>
          <div className="w-px h-4 bg-stone-200 shrink-0" />
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => navigate('/crm/prospect')}
              disabled={save.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 hover:border-stone-300 disabled:opacity-50 transition-all"
            >
              <X className="size-3" />
              Cancel
            </button>
            <button
              type="submit"
              disabled={save.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-1.5 text-xs font-semibold text-stone-900 hover:bg-brand-hover disabled:opacity-50 transition-all shadow-sm"
            >
              {save.isPending ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
              {save.isPending ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>

        {/* Error bar */}
        {saveError && (
          <div className="shrink-0 bg-red-50 border-b border-red-100 px-6 py-2 flex items-center gap-2 text-xs text-red-700">
            <AlertCircle className="size-3.5 shrink-0" />
            {apiErrorMessage(saveError, 'Failed to save.')}
          </div>
        )}

        {/* Scrollable form body */}
        <div className="flex-1 overflow-y-auto modal-scrollbar">
          <div className="px-5 py-5 space-y-5">
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
                  workflowKey="prospect"
                  mode="transitions"
                  recordId={id}
                  value={currentStateId}
                  onChange={handleStatusChange}
                  disabled={transition.isPending}
                />
              )}
            />
            <EditableFilesPanel recordId={id} />
            <div className="h-6" />
          </div>
        </div>
      </form>
    </div>
  );
}
