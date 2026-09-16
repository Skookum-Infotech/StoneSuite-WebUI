import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, CheckCircle2, XCircle, Eye, EyeOff, Loader2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { chartOfAccountsService } from '@/services/chartOfAccountsService';
import { parseCoaError } from '@/lib/coaErrors';
import {
  visibilityPayload, applicableVisibilityActions, VISIBILITY_ACTION_LABELS, type VisibilityAction,
} from '@/lib/coaVisibility';
import { ACCOUNT_TYPE_LABELS, type TreeAccount } from '@/types/chartOfAccounts';
import { BlockingSlotsDialog } from './BlockingSlotsDialog';
import { DeleteAccountDialog } from './DeleteAccountDialog';
import { cn } from '@/lib/utils';

const ACTION_ICONS: Record<VisibilityAction, LucideIcon> = {
  activate: CheckCircle2,
  deactivate: XCircle,
  show: Eye,
  hide: EyeOff,
};

/** The row's RBAC grants, bundled so the recursive call site passes one prop
 *  rather than three — and so adding a fourth grant later does not widen every
 *  signature between here and AccountTreeView. */
export interface TreeRowPerms {
  canUpdate: boolean;
  canCreate: boolean;
  canDelete: boolean;
}

/** Everything the row hands back up. Bundled for the same reason as
 *  TreeRowPerms. */
export interface TreeRowActions {
  onToggleSelect: (id: string) => void;
  onEdit: (account: TreeAccount) => void;
  onAddSubAccount: (account: TreeAccount) => void;
}

// One row in the grouped tree report, rendered recursively for its children.
// The tree is capped at two levels (AD-4) so recursion only ever runs once in
// practice, but nothing here assumes that — it just renders what the server
// sends. "Add sub-account" is offered only at depth 0 (a child's own children
// array is always empty).
export function AccountTreeRow({
  account,
  perms,
  actions,
  selectedIds,
  depth = 0,
}: {
  account: TreeAccount;
  perms: TreeRowPerms;
  actions: TreeRowActions;
  selectedIds: Set<string>;
  depth?: number;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [blocked, setBlocked] = useState<{ message: string; slots: string[] } | null>(null);
  const [pendingAction, setPendingAction] = useState<VisibilityAction | null>(null);
  // The action buttons rendered below are conditional on account state, so a
  // successful toggle unmounts/remounts the clicked button at its DOM
  // position and silently drops keyboard focus to <body>. A persistent
  // sr-only status region at least announces the result to a screen-reader
  // user even though focus itself isn't restored.
  const [announcement, setAnnouncement] = useState('');

  const toggle = useMutation({
    mutationFn: (action: VisibilityAction) =>
      chartOfAccountsService.updateAccount(account.id, {
        ...visibilityPayload(action),
        recordVersion: account.recordVersion,
      }),
    onMutate: (action: VisibilityAction) => setPendingAction(action),
    onSuccess: (_data, action) => {
      setAnnouncement(`${VISIBILITY_ACTION_LABELS[action]} applied to ${account.code} ${account.name}.`);
      queryClient.invalidateQueries({ queryKey: ['coa-tree'] });
      queryClient.invalidateQueries({ queryKey: ['coa-accounts'] });
    },
    onError: (err) => {
      const info = parseCoaError(err, 'Failed to update account.');
      if (info.kind === 'blockingSlots') setBlocked({ message: info.message, slots: info.blockingSlots ?? [] });
    },
    onSettled: () => setPendingAction(null),
  });

  const visibilityActions = applicableVisibilityActions(account);
  const rowError = toggle.isError && !blocked ? parseCoaError(toggle.error, 'Failed to update account.') : null;

  return (
    <>
      <div
        className={cn(
          'flex items-center gap-2 py-2 px-2 rounded-lg hover:bg-stone-50 transition-colors group',
          depth > 0 && 'pl-8',
        )}
      >
        {perms.canUpdate && (
          <input
            type="checkbox"
            checked={selectedIds.has(account.id)}
            onChange={() => actions.onToggleSelect(account.id)}
            aria-label={`Select ${account.code} ${account.name}`}
            className="size-3.5 shrink-0 rounded border-stone-300"
          />
        )}
        <button
          type="button"
          onClick={() => navigate(`/finance/chart-of-accounts/${account.id}`)}
          className="flex flex-1 min-w-0 items-center gap-2 text-left"
        >
          <span className="w-16 shrink-0 font-mono text-2xs text-stone-400">{account.code}</span>
          <span className={cn('truncate text-xs', account.isActive ? 'text-stone-800' : 'italic text-stone-400')}>
            {account.name}
          </span>
        </button>

        <span className="hidden shrink-0 text-2xs text-stone-400 sm:inline">{ACCOUNT_TYPE_LABELS[account.type]}</span>
        {account.isSystem && (
          <span className="hidden shrink-0 rounded bg-stone-100 px-1 py-0.5 text-2xs font-semibold text-stone-500 md:inline" title="Seeded system account">
            SYS
          </span>
        )}
        {!account.isPostable && (
          <span className="hidden shrink-0 rounded bg-violet-50 px-1 py-0.5 text-2xs font-semibold text-violet-600 md:inline" title="Header account — not postable">
            HEADER
          </span>
        )}
        {!account.isActive && <span className="shrink-0 rounded bg-stone-100 px-1 py-0.5 text-2xs font-semibold text-stone-400">Inactive</span>}
        {!account.isVisible && <span className="shrink-0 rounded bg-stone-100 px-1 py-0.5 text-2xs font-semibold text-stone-400">Hidden</span>}

        <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
          {perms.canUpdate && visibilityActions.map((action) => {
            const Icon = ACTION_ICONS[action];
            return (
              <button
                key={action}
                type="button"
                onClick={() => toggle.mutate(action)}
                disabled={toggle.isPending}
                aria-label={`${VISIBILITY_ACTION_LABELS[action]} ${account.code} ${account.name}`}
                title={VISIBILITY_ACTION_LABELS[action]}
                className="rounded p-1 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700 disabled:opacity-50"
              >
                {pendingAction === action ? <Loader2 className="size-3.5 animate-spin" /> : <Icon className="size-3.5" />}
              </button>
            );
          })}
          {perms.canCreate && depth === 0 && (
            <button
              type="button"
              onClick={() => actions.onAddSubAccount(account)}
              aria-label={`Add sub-account under ${account.code} ${account.name}`}
              title="Add sub-account"
              className="rounded p-1 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700"
            >
              <Plus className="size-3.5" />
            </button>
          )}
          {perms.canUpdate && (
            <button
              type="button"
              onClick={() => actions.onEdit(account)}
              aria-label={`Edit ${account.code} ${account.name}`}
              title="Edit"
              className="rounded p-1 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700"
            >
              <Pencil className="size-3.5" />
            </button>
          )}
          {/* Seeded accounts are undeletable server-side (the store 409s and
              chk_coa_system_undeletable backs it), so the affordance is hidden
              rather than offered and then refused — same rule the detail page's
              Quick Actions card follows. */}
          {perms.canDelete && !account.isSystem && (
            <DeleteAccountDialog
              accountId={account.id}
              label={`${account.code} ${account.name}`}
              variant="icon"
              onDeleted={() => {
                queryClient.invalidateQueries({ queryKey: ['coa-tree'] });
                queryClient.invalidateQueries({ queryKey: ['coa-accounts'] });
              }}
            />
          )}
        </div>
      </div>

      <p role="status" className="sr-only">{announcement}</p>

      {rowError && (
        <p role="alert" className="pl-9 text-2xs text-destructive">{rowError.message}</p>
      )}

      {account.children.map((child) => (
        <AccountTreeRow
          key={child.id}
          account={child}
          perms={perms}
          actions={actions}
          selectedIds={selectedIds}
          depth={depth + 1}
        />
      ))}

      {blocked && (
        <BlockingSlotsDialog message={blocked.message} slots={blocked.slots} onClose={() => setBlocked(null)} />
      )}
    </>
  );
}
