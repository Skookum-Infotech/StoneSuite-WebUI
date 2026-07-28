import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, EyeOff, Eye, XCircle, Loader2, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { chartOfAccountsService } from '@/services/chartOfAccountsService';
import { parseCoaError } from '@/lib/coaErrors';
import { visibilityPayload, VISIBILITY_ACTION_LABELS, type VisibilityAction } from '@/lib/coaVisibility';
import { BlockingSlotsDialog } from './BlockingSlotsDialog';

const ACTION_ICONS: Record<VisibilityAction, LucideIcon> = {
  activate: CheckCircle2,
  deactivate: XCircle,
  show: Eye,
  hide: EyeOff,
};

const VISIBILITY_ACTIONS: VisibilityAction[] = ['activate', 'deactivate', 'show', 'hide'];

// Bulk activate/deactivate/show/hide across the selected accounts — one
// transaction, all-or-nothing (BulkUpdate aborts entirely on the first
// blocked account). "changed" only distinguishes "modified" from "already in
// that state" — there is no partial-success shape to render.
export function BulkActionBar({ selectedIds, onClear }: { selectedIds: string[]; onClear: () => void }) {
  const queryClient = useQueryClient();
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [blocked, setBlocked] = useState<{ message: string; slots: string[] } | null>(null);
  const [pendingAction, setPendingAction] = useState<VisibilityAction | null>(null);

  const bulk = useMutation({
    mutationFn: (action: VisibilityAction) =>
      chartOfAccountsService.bulkUpdate({ uuids: selectedIds, ...visibilityPayload(action) }),
    onMutate: (action: VisibilityAction) => {
      setPendingAction(action);
      setResultMessage(null);
    },
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: ['coa-tree'] });
      queryClient.invalidateQueries({ queryKey: ['coa-accounts'] });
      const changed = results.filter((r) => r.changed).length;
      const unchanged = results.length - changed;
      setResultMessage(
        unchanged > 0
          ? `${changed} account${changed === 1 ? '' : 's'} changed, ${unchanged} already in that state.`
          : `${changed} account${changed === 1 ? '' : 's'} changed.`,
      );
      onClear();
    },
    onError: (err) => {
      const info = parseCoaError(err, 'Failed to update accounts.');
      if (info.kind === 'blockingSlots') {
        setBlocked({ message: info.message, slots: info.blockingSlots ?? [] });
      } else {
        setResultMessage(info.message);
      }
    },
    onSettled: () => setPendingAction(null),
  });

  if (selectedIds.length === 0 && !resultMessage) return null;

  return (
    <div className="space-y-2">
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-accent-foreground/20 bg-accent/10 px-3 py-2">
          <span className="text-xs font-semibold text-accent-foreground">
            {selectedIds.length} selected
          </span>
          {VISIBILITY_ACTIONS.map((action) => {
            const Icon = ACTION_ICONS[action];
            return (
              <button
                key={action}
                type="button"
                onClick={() => bulk.mutate(action)}
                disabled={bulk.isPending}
                aria-label={`${VISIBILITY_ACTION_LABELS[action]} ${selectedIds.length} selected accounts`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-2.5 py-1 text-xs font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-50 transition-colors"
              >
                {pendingAction === action ? <Loader2 className="size-3 animate-spin" /> : <Icon className="size-3" />}
                {VISIBILITY_ACTION_LABELS[action]}
              </button>
            );
          })}
          <button
            type="button"
            onClick={onClear}
            aria-label="Clear selection"
            className="ml-auto rounded p-0.5 text-stone-400 hover:bg-stone-100 hover:text-stone-600 transition-colors"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {resultMessage && (
        <div role="status" className="flex items-center justify-between gap-2 rounded-lg bg-stone-50 px-3 py-1.5 text-xs text-stone-600">
          {resultMessage}
          <button
            type="button"
            onClick={() => setResultMessage(null)}
            aria-label="Dismiss"
            className="shrink-0 rounded p-0.5 text-stone-400 hover:bg-stone-100 hover:text-stone-600 transition-colors"
          >
            <X className="size-3" />
          </button>
        </div>
      )}

      {blocked && (
        <BlockingSlotsDialog message={blocked.message} slots={blocked.slots} onClose={() => setBlocked(null)} />
      )}
    </div>
  );
}
