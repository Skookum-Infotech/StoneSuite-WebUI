import { useState } from 'react';
import { useQueries, useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Lock, ShieldCheck, ChevronDown } from 'lucide-react';
import { workflowService, userService } from '@/services/tenantServices';
import { apiErrorMessage } from '@/api/tenantClient';
import { Badge, Spinner, ErrorNote } from '@/components/tenant/ui';
import { ApproverPicker, MAX_APPROVERS } from '@/components/tenant/ApproverPicker';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { cn } from '@/lib/utils';
import type { WorkflowState, WorkflowTransition } from '@/types/tenant';

function stripWorkflowPrefix(name: string, workflowKey: string): string {
  const prefix = `${workflowKey}-`;
  return name.toLowerCase().startsWith(prefix.toLowerCase()) ? name.slice(prefix.length) : name;
}

// States & transitions are fixed configuration for the workflow type — not
// something an admin edits here — except for one thing: which users must
// sign off before a record can leave a given state. That's editable per
// state (workflow_config:configure); everyone with workflow_config:read can
// see who's assigned.
export function StatesReference({
  workflowId,
  workflowKey,
  states,
  transitions,
}: {
  workflowId: string;
  workflowKey: string;
  states: WorkflowState[];
  transitions: WorkflowTransition[];
}) {
  const { hasPermission, isLoading: permsLoading } = useUserPermissions();
  const canRead = permsLoading || hasPermission('workflow_config', 'read');
  const canConfigure = hasPermission('workflow_config', 'configure');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const ordered = [...states].sort((a, b) => a.sortOrder - b.sortOrder);
  const stateById = new Map(states.map((s) => [s.id, s]));
  const nameFor = (s?: WorkflowState) => (s ? stripWorkflowPrefix(s.name, workflowKey) : '—');

  const approverQueries = useQueries({
    queries: ordered.map((s) => ({
      queryKey: ['state-approvers', s.id],
      queryFn: () => workflowService.getStateApprovers(workflowId, s.id),
      enabled: canRead,
      staleTime: 60 * 1000,
    })),
  });
  const approversByState = new Map(ordered.map((s, i) => [s.id, approverQueries[i]?.data ?? []]));

  return (
    <section className="rounded-[10px] border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-stone-900">
      <div className="mb-3 flex items-center justify-between gap-3 border-b border-stone-100 pb-3 dark:border-stone-800">
        <h2 className="text-sm font-semibold text-stone-950 dark:text-white">States &amp; transitions</h2>
        <span className="flex items-center gap-1 text-xs text-stone-400">
          <Lock className="size-3" /> Structure read only
        </span>
      </div>

      {ordered.length === 0 ? (
        <p className="text-xs text-stone-400">No states configured.</p>
      ) : (
        <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          {ordered.map((s) => {
            const outgoing = transitions.filter((t) => t.fromStateId === s.id);
            const approverUserIds = approversByState.get(s.id) ?? [];
            const gated = approverUserIds.length > 0;
            const expanded = expandedId === s.id;
            return (
              <div key={s.id}>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="inline-block size-1.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} aria-hidden="true" />
                  <span className="truncate text-xs font-semibold text-stone-900 dark:text-stone-100">{nameFor(s)}</span>
                  {s.isInitial && <span className="shrink-0 text-2xs text-stone-400">start</span>}
                  {s.isTerminal && <span className="shrink-0 text-2xs text-stone-400">end</span>}
                  {gated && (
                    <Badge color="#f59e0b" size="sm">
                      Approval required
                    </Badge>
                  )}
                </div>
                {outgoing.length > 0 && (
                  <ul className="mt-1.5 space-y-1 border-l border-stone-100 pl-3 dark:border-stone-800">
                    {outgoing.map((t) => (
                      <li key={t.id} className="truncate text-xs text-stone-400">
                        <span className="text-stone-500 dark:text-stone-400">{t.name}</span> → {nameFor(stateById.get(t.toStateId))}
                      </li>
                    ))}
                  </ul>
                )}

                {canRead && (
                  <button
                    type="button"
                    aria-expanded={expanded}
                    aria-label={`${expanded ? 'Hide' : 'Show'} approvers for ${nameFor(s)}`}
                    onClick={() => setExpandedId(expanded ? null : s.id)}
                    className="mt-1.5 flex items-center gap-1 text-2xs font-medium text-stone-400 transition-colors hover:text-stone-600 dark:hover:text-stone-300"
                  >
                    <ShieldCheck className="size-3" />
                    {gated ? `${approverUserIds.length} approver${approverUserIds.length > 1 ? 's' : ''}` : 'No approvers'}
                    <ChevronDown className={cn('size-3 transition-transform', expanded && 'rotate-180')} />
                  </button>
                )}

                {expanded && (
                  <StateApproversEditor
                    workflowId={workflowId}
                    stateId={s.id}
                    approverUserIds={approverUserIds}
                    canConfigure={canConfigure}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function StateApproversEditor({
  workflowId,
  stateId,
  approverUserIds,
  canConfigure,
}: {
  workflowId: string;
  stateId: string;
  approverUserIds: string[];
  canConfigure: boolean;
}) {
  const qc = useQueryClient();
  const usersQ = useQuery({ queryKey: ['users'], queryFn: userService.listUsers, staleTime: 5 * 60 * 1000 });
  const [error, setError] = useState<string | null>(null);
  const allUsers = usersQ.data ?? [];
  const activeUsers = allUsers.filter((u) => u.status === 'active');
  const byId = new Map(allUsers.map((u) => [u.id, u]));

  const update = useMutation({
    mutationFn: (ids: string[]) => workflowService.setStateApprovers(workflowId, stateId, ids),
    onSuccess: (ids) => {
      setError(null);
      qc.setQueryData(['state-approvers', stateId], ids);
    },
    onError: (err: unknown) => setError(apiErrorMessage(err, 'Failed to update approvers.')),
  });

  const wrapCls = 'mt-2 rounded-lg border border-stone-100 bg-stone-50 p-2.5 dark:border-stone-800 dark:bg-stone-950/30';

  if (!canConfigure) {
    const names = approverUserIds.map((id) => {
      const u = byId.get(id);
      return u ? u.fullName || u.email : 'Unknown user';
    });
    return (
      <div className={wrapCls}>
        {names.length === 0 ? (
          <p className="text-2xs text-stone-400">No approvers configured for this state.</p>
        ) : (
          <p className="text-2xs text-stone-600 dark:text-stone-300">{names.join(', ')}</p>
        )}
      </div>
    );
  }

  return (
    <div className={wrapCls}>
      {usersQ.isLoading ? (
        <Spinner label="Loading users…" />
      ) : (
        <ApproverPicker
          users={activeUsers}
          selected={approverUserIds}
          onAdd={(userId) => {
            if (approverUserIds.length >= MAX_APPROVERS || approverUserIds.includes(userId)) return;
            update.mutate([...approverUserIds, userId]);
          }}
          onRemove={(userId) => update.mutate(approverUserIds.filter((id) => id !== userId))}
          disabled={update.isPending}
        />
      )}
      {error && (
        <div className="mt-2">
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}
    </div>
  );
}
