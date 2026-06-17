import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Users, AlertCircle, Loader2, Save, X, ChevronLeft } from 'lucide-react';
import { crmService } from '@/services/crmService';
import { workflowService, userService } from '@/services/tenantServices';
import { apiErrorMessage } from '@/api/tenantClient';
import { CrmRecordForm } from '@/components/crm/CrmRecordForm';
import { StatusDropdown } from '@/components/crm/StatusDropdown';
import { EditableFilesPanel, type EditableFilesPanelHandle } from '@/components/crm/CrmSubTabsPanel';
import { crmCoreDefaults } from '@/lib/crmFields';
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
      navigate(`/prospects/${record.id}`);
    },
  });

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-stone-50">
      <form
        onSubmit={(e) => { e.preventDefault(); createProspect(); }}
        className="flex flex-col flex-1 min-h-0"
      >
        {/* Sticky top bar */}
        <div className="shrink-0 bg-white border-b border-stone-100 px-4 py-2.5 flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/prospects')}
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
            <h1 className="text-sm font-semibold text-stone-800 leading-tight">New Prospect</h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => navigate('/prospects')}
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
              {isPending ? 'Saving…' : isUploadingFiles ? 'Uploading files…' : 'Save Prospect'}
            </button>
          </div>
        </div>

        {/* Error bar */}
        {createError && (
          <div className="shrink-0 bg-red-50 border-b border-red-100 px-6 py-2 flex items-center gap-2 text-xs text-red-700">
            <AlertCircle className="size-3.5 shrink-0" />
            {apiErrorMessage(createError, 'Failed to save prospect.')}
          </div>
        )}

        {/* Scrollable form body */}
        <div className="flex-1 overflow-y-auto modal-scrollbar">
          <div className="px-5 py-5 space-y-5">
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
            <div className="h-6" />
          </div>
        </div>
      </form>
    </div>
  );
}
