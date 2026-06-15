import { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users, AlertCircle, Loader2, Save, X, Clock,
} from 'lucide-react';
import { crmService } from '@/services/crmService';
import { workflowService, userService } from '@/services/tenantServices';
import { apiErrorMessage } from '@/api/tenantClient';
import { StatusDropdown } from '@/components/crm/StatusDropdown';
import { DeleteRecordDialog } from '@/components/crm/DeleteRecordDialog';
import { ConvertRecordButton } from '@/components/crm/ConvertRecordButton';
import { CrmRecordForm } from '@/components/crm/CrmRecordForm';
import { Spinner, ErrorNote } from '@/components/tenant/ui';
import { crmCoreDefaults } from '@/lib/crmFields';
import { cn } from '@/lib/utils';
import type { FieldDefinition } from '@/types/tenant';

// ── Mock history (TODO: replace with crmService.getRecordHistory(id) when ready) ──
type HistoryEntry = {
  id: string;
  type: 'created' | 'transition' | 'edit';
  actor: string;
  initials: string;
  color: string;
  at: string;
  fromState?: string;
  toState?: string;
  summary?: string;
};

const MOCK_HISTORY: HistoryEntry[] = [
  {
    id: '3',
    type: 'transition',
    actor: 'Alex Johnson',
    initials: 'AJ',
    color: 'bg-blue-100 text-blue-700',
    at: '2 hours ago',
    fromState: 'New',
    toState: 'In Discussion',
  },
  {
    id: '2',
    type: 'edit',
    actor: 'Maria Garcia',
    initials: 'MG',
    color: 'bg-emerald-100 text-emerald-700',
    at: 'Yesterday',
    summary: 'Updated company name and email',
  },
  {
    id: '1',
    type: 'created',
    actor: 'Sarah Chen',
    initials: 'SC',
    color: 'bg-purple-100 text-purple-700',
    at: '2 days ago',
  },
];

function ActivityFeed() {
  return (
    <div className="p-4 flex-1">
      <div className="flex items-center gap-2 mb-3">
        <Clock className="h-3 w-3 text-stone-400" />
        <p className="text-2xs font-semibold uppercase tracking-wider text-stone-400">Activity</p>
      </div>
      <div>
        {MOCK_HISTORY.map((entry, i) => (
          <div key={entry.id} className="relative flex gap-2.5 pb-4 last:pb-0">
            {i < MOCK_HISTORY.length - 1 && (
              <div className="absolute left-3.5 top-7 bottom-0 w-px bg-stone-100" />
            )}
            <div className={cn('w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-2xs font-semibold z-10', entry.color)}>
              {entry.initials}
            </div>
            <div className="flex-1 min-w-0 pt-0.5">
              {entry.type === 'transition' && (
                <>
                  <p className="text-2xs text-stone-500 leading-relaxed">
                    <span className="font-medium text-stone-700">{entry.actor}</span>{' '}
                    moved to <span className="font-medium text-stone-700">{entry.toState}</span>
                  </p>
                  <div className="flex items-center gap-1 mt-1.5">
                    <span className="text-2xs bg-stone-100 text-stone-500 px-1.5 py-0.5 rounded-md">{entry.fromState}</span>
                    <span className="text-2xs text-stone-300">→</span>
                    <span className="text-2xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-md font-medium">{entry.toState}</span>
                  </div>
                </>
              )}
              {entry.type === 'edit' && (
                <p className="text-2xs text-stone-500 leading-relaxed">
                  <span className="font-medium text-stone-700">{entry.actor}</span>{' '}
                  {entry.summary}
                </p>
              )}
              {entry.type === 'created' && (
                <p className="text-2xs text-stone-500 leading-relaxed">
                  <span className="font-medium text-stone-700">{entry.actor}</span>{' '}
                  created this prospect
                </p>
              )}
              <p className="text-2xs text-stone-300 mt-0.5">{entry.at}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

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

  const { data: users = [] } = useQuery({ queryKey: ['workspace-users'], queryFn: userService.listUsers });
  const owner = users.find((u) => u.id === record?.ownerUserId);

  const transition = useMutation({
    mutationFn: (toStateId: string) => crmService.transitionRecord(id, toStateId, 'prospect'),
    onSuccess: (updated) => {
      setLocalStateId(updated.currentStateId);
      queryClient.invalidateQueries({ queryKey: ['crm-record', id] });
      queryClient.invalidateQueries({ queryKey: ['crm-records', 'prospect'] });
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
      navigate('/prospects');
    },
  });

  const set = (key: string, value: unknown) =>
    setLocalCoreFields((prev) => ({ ...(prev ?? { ...crmCoreDefaults(), ...record?.coreFields }), [key]: value }));

  if (isLoading) return <div className="p-6"><Spinner label="Loading prospect…" /></div>;
  if (loadError || !record)
    return <div className="p-6"><ErrorNote>{apiErrorMessage(loadError, 'Failed to load prospect.')}</ErrorNote></div>;

  const company = String(coreFields.company_name ?? coreFields.first_name ?? '—');
  const saveError = save.error ?? transition.error;

  return (
    <div className="flex flex-1 min-h-0 bg-stone-50">
      <form
        onSubmit={(e) => { e.preventDefault(); save.mutate(); }}
        className="flex flex-1 min-h-0 min-w-0"
      >
        {/* ── Left: scrollable form ── */}
        <div className="flex flex-col flex-1 min-h-0 min-w-0">

          {/* Page title */}
          <div className="shrink-0 bg-white border-b border-stone-100 px-6 py-3.5 flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
              <Users className="h-4 w-4 text-blue-600" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-semibold text-stone-800 leading-tight truncate">
                {company}
              </h1>
              <p className="text-2xs text-stone-400 mt-0.5">Editing prospect record</p>
            </div>
            {record.recordNumber && (
              <span className="ml-auto shrink-0 rounded border border-stone-200 bg-stone-50 px-1.5 py-0.5 font-mono text-2xs text-stone-400">
                {record.recordNumber}
              </span>
            )}
          </div>

          {/* Scrollable form body */}
          <div className="flex-1 overflow-y-auto modal-scrollbar px-6 py-5 space-y-4">
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

            <div className="h-4" />
          </div>
        </div>

        {/* ── Right: actions + history panel ── */}
        <div className="w-60 xl:w-64 shrink-0 border-l border-stone-200 bg-white flex flex-col overflow-y-auto modal-scrollbar">

          {/* Save / Cancel */}
          <div className="p-4 border-b border-stone-100 space-y-2">
            <button
              type="submit"
              disabled={save.isPending}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-xs font-semibold text-stone-900 hover:bg-brand-hover disabled:opacity-50 transition-all duration-150 shadow-sm hover:shadow"
            >
              {save.isPending
                ? <><Loader2 className="size-3.5 animate-spin" />Saving…</>
                : <><Save className="size-3.5" />Save Changes</>
              }
            </button>
            <button
              type="button"
              onClick={() => navigate('/prospects')}
              disabled={save.isPending}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-stone-200 bg-white px-4 py-2 text-xs font-medium text-stone-600 hover:bg-stone-50 hover:border-stone-300 disabled:opacity-50 transition-all duration-150"
            >
              <X className="size-3.5" />
              Cancel
            </button>

            {saveError && (
              <div className="flex items-start gap-2 rounded-lg border border-red-100 bg-red-50 px-3 py-2.5 text-xs text-red-700">
                <AlertCircle className="size-3.5 shrink-0 mt-0.5" />
                <span>{apiErrorMessage(saveError, 'Failed to save.')}</span>
              </div>
            )}
          </div>

          {/* Record actions */}
          <div className="p-4 border-b border-stone-100">
            <p className="text-2xs font-semibold uppercase tracking-wider text-stone-400 mb-2.5">Record Actions</p>
            <div className="space-y-1.5">
              <div className="[&>button]:w-full [&>button]:justify-start [&>button]:rounded-lg [&>button]:text-xs">
                <ConvertRecordButton
                  recordId={id}
                  sourceWorkflowKey="prospect"
                  onConverted={(newId) => navigate(`/crm/customer/${newId}/edit`)}
                />
              </div>
              <div className="[&>button]:w-full [&>button]:justify-start [&>button]:rounded-lg [&>button]:text-xs">
                <DeleteRecordDialog
                  recordId={id}
                  workflowKey="prospect"
                  label={`Prospect — ${company}`}
                  onDeleted={() => {
                    queryClient.invalidateQueries({ queryKey: ['crm-records', 'prospect'] });
                    navigate('/prospects');
                  }}
                />
              </div>
            </div>
          </div>

          {/* Owner */}
          <div className="px-4 py-3 border-b border-stone-100">
            <p className="text-2xs font-semibold uppercase tracking-wider text-stone-400 mb-2">Owner</p>
            <p className="text-xs font-medium text-stone-700">
              {owner ? (owner.fullName || owner.email) : <span className="text-stone-300 italic">Unassigned</span>}
            </p>
          </div>

          {/* Activity feed */}
          <ActivityFeed />
        </div>
      </form>
    </div>
  );
}
