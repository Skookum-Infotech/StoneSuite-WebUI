import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Users, AlertCircle, Loader2, Save, X } from 'lucide-react';
import { crmService } from '@/services/crmService';
import { workflowService, userService } from '@/services/tenantServices';
import { apiErrorMessage } from '@/api/tenantClient';
import { CrmRecordForm } from '@/components/crm/CrmRecordForm';
import { StatusDropdown } from '@/components/crm/StatusDropdown';
import { EditableFilesPanel, type EditableFilesPanelHandle } from '@/components/crm/CrmSubTabsPanel';
import { crmCoreDefaults } from '@/lib/crmFields';
import { CrmPageHeader } from '@/pages/crm/components/CrmPageHeader';
import type { FieldDefinition } from '@/types/tenant';

export default function AddProspectPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const panelRef = useRef<EditableFilesPanelHandle>(null);
  const [coreFields, setCoreFields] = useState<Record<string, unknown>>(() => crmCoreDefaults());
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, unknown>>({});
  const [ownerUserId, setOwnerUserId] = useState('');
  const [crmStatusId, setCrmStatusId] = useState('');
  const [isUploadingFiles, setIsUploadingFiles] = useState(false);

  const set = (key: string, value: unknown) => setCoreFields((d) => ({ ...d, [key]: value }));
  const handleStatusChange = useCallback((stateId: string) => setCrmStatusId(stateId), []);

  const { data: allWorkflows = [] } = useQuery({ queryKey: ['workflows'], queryFn: workflowService.list });
  const prospectWorkflow = allWorkflows.find((wf) => wf.key.toLowerCase() === 'prospect');
  const { data: prospectDef } = useQuery({
    queryKey: ['workflow', prospectWorkflow?.id],
    queryFn: () => workflowService.get(prospectWorkflow?.id ?? ''),
    enabled: Boolean(prospectWorkflow?.id),
  });
  const customFieldDefs: FieldDefinition[] = prospectDef?.fields ?? [];

  const { data: users = [] } = useQuery({ queryKey: ['workspace-users'], queryFn: userService.listUsers });

  const { mutate: createProspect, isPending, error: createError } = useMutation({
    mutationFn: () =>
      crmService.createRecord('prospect', {
        coreFields,
        customFields: customFieldValues,
        ownerUserId: ownerUserId || undefined,
        crmStatusId: crmStatusId || undefined,
      }),
    onSuccess: async (record) => {
      queryClient.invalidateQueries({ queryKey: ['crm-records', 'prospect'] });
      if (panelRef.current?.hasStagedFiles()) {
        setIsUploadingFiles(true);
        try { await panelRef.current.uploadStagedTo(record.id); } finally { setIsUploadingFiles(false); }
      }
      navigate(`/crm/prospect/${record.id}`);
    },
  });

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-stone-50">
      <form
        onSubmit={(e) => { e.preventDefault(); createProspect(); }}
        className="flex flex-col flex-1 min-h-0"
      >
        <CrmPageHeader
          backLabel="Prospects"
          onBack={() => navigate('/crm/prospect')}
          icon={Users}
          iconBg="bg-blue-100"
          iconColor="text-blue-600"
          title="New Prospect"
          subtitle="Fields marked * are required."
          actions={(
            <>
              <button
                type="button"
                onClick={() => navigate('/crm/prospect')}
                disabled={isPending}
                className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 hover:border-stone-300 disabled:opacity-50 transition-all"
              >
                <X className="size-3" />
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending || isUploadingFiles}
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-1.5 text-xs font-semibold text-stone-900 hover:bg-brand-hover disabled:opacity-50 transition-all shadow-sm"
              >
                {(isPending || isUploadingFiles) ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
                {isPending ? 'Saving…' : isUploadingFiles ? 'Uploading…' : 'Save Prospect'}
              </button>
            </>
          )}
        />

        {/* Error banner */}
        {createError && (
          <div className="shrink-0 flex items-start gap-3 border-b border-red-200 bg-red-50 px-5 py-2.5">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-100">
              <AlertCircle className="size-3 text-red-600" />
            </span>
            <p className="text-xs text-red-700">
              <span className="font-bold">Error: </span>
              {apiErrorMessage(createError, 'Failed to save prospect.')}
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
                  workflowKey="prospect"
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
            onClick={() => navigate('/crm/prospect')}
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
            {isPending ? 'Saving…' : isUploadingFiles ? 'Uploading…' : 'Save Prospect'}
          </button>
        </div>
      </form>
    </div>
  );
}
