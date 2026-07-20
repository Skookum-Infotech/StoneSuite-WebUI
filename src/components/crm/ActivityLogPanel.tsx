import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Phone, Mail, Calendar, StickyNote, CheckSquare, Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import { crmActivityService, type Activity, type ActivityType } from '@/services/crmActivityService';
import type { CRMWorkflowKey } from '@/services/crmService';
import { ACTIVITY_TYPES, ACTIVITY_TYPE_LABELS } from '@/lib/crmActivityForm';
import { LogActivityDialog } from '@/components/crm/LogActivityDialog';
import { Spinner, ErrorNote } from '@/components/tenant/ui';
import { apiErrorMessage } from '@/api/tenantClient';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { cn } from '@/lib/utils';

type Props = { recordId: string; workflowKey: CRMWorkflowKey };

type DialogState = { mode: 'create' } | { mode: 'edit'; activity: Activity } | null;

const TYPE_ICON: Record<ActivityType, React.ElementType> = {
  call: Phone,
  email: Mail,
  meeting: Calendar,
  note: StickyNote,
  task: CheckSquare,
};

function formatOccurredAt(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

export function ActivityLogPanel({ recordId, workflowKey }: Props) {
  const queryClient = useQueryClient();
  const { hasPermission, isLoading: permissionsLoading } = useUserPermissions();
  const canCreate = permissionsLoading || hasPermission('crm_activity', 'create');
  const canUpdate = permissionsLoading || hasPermission('crm_activity', 'update');
  const canDelete = permissionsLoading || hasPermission('crm_activity', 'delete');

  const [typeFilter, setTypeFilter] = useState<ActivityType | null>(null);
  const [dialogState, setDialogState] = useState<DialogState>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const { data: activities = [], isLoading, error } = useQuery({
    queryKey: ['crm-activities', recordId, typeFilter],
    queryFn: () => crmActivityService.list(workflowKey, recordId, typeFilter ?? undefined),
    enabled: Boolean(recordId),
  });

  async function handleDelete(activityId: string) {
    setDeletingId(activityId);
    setDeleteError(null);
    try {
      await crmActivityService.remove(workflowKey, recordId, activityId);
      queryClient.invalidateQueries({ queryKey: ['crm-activities', recordId] });
      setConfirmDeleteId(null);
    } catch (err) {
      setDeleteError(apiErrorMessage(err, 'Failed to delete activity.'));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="rounded-xl border border-stone-200 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-stone-100 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap" role="group" aria-label="Filter by activity type">
          <FilterChip label="All" active={typeFilter === null} onClick={() => setTypeFilter(null)} />
          {ACTIVITY_TYPES.map((t) => (
            <FilterChip key={t} label={ACTIVITY_TYPE_LABELS[t]} active={typeFilter === t} onClick={() => setTypeFilter(t)} />
          ))}
        </div>
        {canCreate && (
          <button
            type="button"
            onClick={() => setDialogState({ mode: 'create' })}
            aria-label="Log activity"
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-stone-900 hover:bg-brand-hover transition-all active:scale-95 shrink-0"
          >
            <Plus className="size-3.5" aria-hidden="true" />
            Log Activity
          </button>
        )}
      </div>

      <div className="px-5 py-4">
        {isLoading ? (
          <div className="py-6 flex justify-center"><Spinner label="Loading activity…" /></div>
        ) : error ? (
          <ErrorNote>{apiErrorMessage(error, 'Failed to load activity.')}</ErrorNote>
        ) : activities.length === 0 ? (
          <p className="py-6 text-center text-xs text-stone-400 italic">No activity logged yet.</p>
        ) : (
          <div className="divide-y divide-stone-50">
            {activities.map((a) => (
              <ActivityRow
                key={a.id}
                activity={a}
                canUpdate={canUpdate}
                canDelete={canDelete}
                confirming={confirmDeleteId === a.id}
                deleting={deletingId === a.id}
                onEdit={() => setDialogState({ mode: 'edit', activity: a })}
                onDeleteClick={() => { setDeleteError(null); setConfirmDeleteId(a.id); }}
                onDeleteConfirm={() => handleDelete(a.id)}
                onDeleteCancel={() => setConfirmDeleteId(null)}
              />
            ))}
          </div>
        )}

        {deleteError && (
          <p role="alert" className="mt-3 text-xs text-destructive">{deleteError}</p>
        )}
      </div>

      {dialogState && (
        <LogActivityDialog
          workflowKey={workflowKey}
          recordId={recordId}
          mode={dialogState.mode}
          activity={dialogState.mode === 'edit' ? dialogState.activity : undefined}
          onClose={() => setDialogState(null)}
          onSaved={() => setDialogState(null)}
        />
      )}
    </div>
  );
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'rounded-full px-2.5 py-1 text-2xs font-semibold transition-colors',
        active ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-500 hover:bg-stone-200 hover:text-stone-700',
      )}
    >
      {label}
    </button>
  );
}

type ActivityRowProps = {
  activity: Activity;
  canUpdate: boolean;
  canDelete: boolean;
  confirming: boolean;
  deleting: boolean;
  onEdit: () => void;
  onDeleteClick: () => void;
  onDeleteConfirm: () => void;
  onDeleteCancel: () => void;
};

function ActivityRow({
  activity, canUpdate, canDelete, confirming, deleting, onEdit, onDeleteClick, onDeleteConfirm, onDeleteCancel,
}: ActivityRowProps) {
  const Icon = TYPE_ICON[activity.activityType];
  const typeLabel = ACTIVITY_TYPE_LABELS[activity.activityType];
  const rowLabel = `${typeLabel}${activity.subject ? `: ${activity.subject}` : ''}`;

  return (
    <div className="flex items-start gap-3 py-3">
      <div className="flex items-center justify-center w-7 h-7 rounded shrink-0 bg-stone-100 mt-0.5">
        <Icon className="h-3.5 w-3.5 text-stone-500" aria-hidden="true" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-2xs font-semibold px-1 rounded bg-stone-100 text-stone-500">{typeLabel}</span>
          <p className="text-xs font-medium text-stone-700 truncate">
            {activity.subject || <span className="text-stone-400">—</span>}
          </p>
        </div>
        {activity.body && (
          <p className="text-xs text-stone-500 mt-1 whitespace-pre-wrap">{activity.body}</p>
        )}
        <div className="flex items-center gap-2 mt-1.5 text-2xs text-stone-400">
          <span>{formatOccurredAt(activity.occurredAt)}</span>
          {activity.author.name && (
            <>
              <span className="text-stone-300">·</span>
              <span>{activity.author.name}</span>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {confirming ? (
          <>
            <button
              type="button"
              onClick={onDeleteConfirm}
              disabled={deleting}
              className="px-2 py-1 rounded text-2xs text-white bg-destructive hover:bg-destructive/90 transition-colors disabled:opacity-50"
            >
              {deleting ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> : 'Delete'}
            </button>
            <button
              type="button"
              onClick={onDeleteCancel}
              disabled={deleting}
              className="px-2 py-1 rounded text-2xs text-stone-500 hover:bg-stone-100 transition-colors"
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            {canUpdate && (
              <button
                type="button"
                onClick={onEdit}
                aria-label={`Edit ${rowLabel}`}
                className="p-1.5 rounded text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                onClick={onDeleteClick}
                aria-label={`Delete ${rowLabel}`}
                className="p-1.5 rounded text-stone-400 hover:text-destructive hover:bg-destructive/5 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
