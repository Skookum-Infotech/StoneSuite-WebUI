import { useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowRight, CheckCircle2, Loader2, RotateCcw, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { apiErrorMessage } from '@/api/tenantClient';
import { binTransferService } from '@/services/binTransferService';
import { useModalDialog } from '@/hooks/useModalDialog';
import { textareaCls } from '@/components/crm/formUtils';
import { statusToastLabel } from '@/lib/statusToast';
import { cn } from '@/lib/utils';
import { BT_STATUS_CODES, btActions, type BtAction } from '@/lib/binTransferStatus';
import type { BinTransfer } from '@/types/binTransfer';

const COMPLETE_TO = 'COMP';
const CANCEL_TO = 'CANC';

function confirmCopy(action: BtAction, slabCount: number): { title: string; body: string; button: string } {
  const slabs = `${slabCount} slab${slabCount === 1 ? '' : 's'}`;
  switch (action.to) {
    case COMPLETE_TO:
      return {
        title: 'Complete this transfer?',
        body: `${slabs} will be moved to their destination bins now. Each slab's bin is updated and a move back needs a new transfer.`,
        button: 'Complete',
      };
    case CANCEL_TO:
      return {
        title: 'Cancel this transfer?',
        body: 'Nothing will be moved and the slabs are released for another transfer. This cannot be undone.',
        button: 'Cancel Transfer',
      };
    case 'PAPV':
      return {
        title: 'Submit for approval?',
        body: 'The approvers are notified. It cannot be edited while it waits; an approver can send it back with a reason.',
        button: 'Submit',
      };
    case 'DRFT':
      return {
        title: `${action.label}?`,
        body: 'It goes back to Draft so it can be edited. Any approvals already given are discarded and it must be approved again.',
        button: action.label,
      };
    default:
      return { title: `${action.label}?`, body: 'This moves the transfer to its next step.', button: action.label };
  }
}

function ActionIcon({ action, busy }: { action: BtAction; busy: boolean }) {
  if (busy) return <Loader2 className="size-4 shrink-0 animate-spin" />;
  if (action.to === CANCEL_TO) return <XCircle className="size-4 shrink-0" />;
  if (action.to === 'DRFT') return <RotateCcw className="size-4 shrink-0" />;
  if (action.to === COMPLETE_TO) return <CheckCircle2 className="size-4 shrink-0" />;
  return <ArrowRight className="size-4 shrink-0" />;
}

function ConfirmDialog({ action, slabCount, pending, error, onConfirm, onClose }: {
  action: BtAction;
  slabCount: number;
  pending: boolean;
  error: unknown;
  onConfirm: (note: string) => void;
  onClose: () => void;
}) {
  const contentRef = useModalDialog(onClose);
  const titleId = useId();
  const [note, setNote] = useState('');
  const copy = confirmCopy(action, slabCount);
  const destructive = action.to === CANCEL_TO;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={(e) => e.target === e.currentTarget && !pending && onClose()}
    >
      <div ref={contentRef} tabIndex={-1} className="mx-4 w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl outline-none">
        <div className="mb-3 flex items-center gap-3">
          <div className={cn('flex size-9 shrink-0 items-center justify-center rounded-full', destructive ? 'bg-destructive/10' : 'bg-accent')}>
            <AlertTriangle className={cn('size-4', destructive ? 'text-destructive' : 'text-accent-foreground')} />
          </div>
          <h3 id={titleId} className="text-sm font-bold text-stone-900">{copy.title}</h3>
        </div>
        <p className="mb-4 text-xs text-stone-600">{copy.body}</p>

        {destructive && (
          <div className="mb-4 space-y-1.5">
            <label htmlFor={`${titleId}-reason`} className="block text-xs font-semibold text-stone-900">Reason (optional)</label>
            <textarea
              id={`${titleId}-reason`}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Why is this being cancelled?"
              className={textareaCls}
            />
          </div>
        )}

        {Boolean(error) && (
          <p role="alert" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
            {apiErrorMessage(error, 'That did not work.')}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-50"
          >
            {destructive ? 'Keep it' : 'Back'}
          </button>
          <button
            type="button"
            onClick={() => onConfirm(note.trim())}
            disabled={pending}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold shadow-sm transition-all active:scale-95 disabled:opacity-50',
              destructive ? 'bg-destructive text-white hover:bg-destructive/90' : 'bg-brand text-stone-950 hover:bg-brand-hover',
            )}
          >
            {pending && <Loader2 className="size-3 animate-spin" />}
            {copy.button}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// The status buttons of a transfer, driven by the server's own `nextStatusCodes`
// (see btActions): Complete or Submit first, then Revise, then Cancel. Approve
// and Reject by the configured approvers live in the approval banner instead.
// Every move asks first — Complete in particular moves real stone.
export function BinTransferActions({ transfer, can }: {
  transfer: BinTransfer;
  can: { transition: boolean; approve: boolean };
}) {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<BtAction | null>(null);

  const run = useMutation({
    mutationFn: ({ action, note }: { action: BtAction; note: string }) =>
      action.to === COMPLETE_TO
        ? binTransferService.complete(transfer.id)
        : binTransferService.transition(transfer.id, action.to, note || undefined),
    onSuccess: (_updated, { action }) => {
      setPending(null);
      toast.success(action.to === COMPLETE_TO
        ? 'Transfer completed — the slabs are in their new bins.'
        : `Moved to ${statusToastLabel(BT_STATUS_CODES, action.to)}.`);
      queryClient.invalidateQueries({ queryKey: ['bin-transfer', transfer.id] });
      queryClient.invalidateQueries({ queryKey: ['bin-transfer-history', transfer.id] });
      queryClient.invalidateQueries({ queryKey: ['bin-transfers'] });
      if (action.to === COMPLETE_TO) {
        // The slabs and the bins' contents just changed.
        queryClient.invalidateQueries({ queryKey: ['inventory-units'] });
        queryClient.invalidateQueries({ queryKey: ['inventory-bins-tree'] });
        queryClient.invalidateQueries({ queryKey: ['inventory-bin-history'] });
      }
    },
  });

  const actions = btActions(transfer.statusCode, transfer.nextStatusCodes, transfer.gated).filter(
    (a) => (a.permission === 'approve' ? can.approve : can.transition),
  );
  if (actions.length === 0) return null;

  return (
    <div className="space-y-0.5">
      {actions.map((action) => (
        <button
          key={action.to}
          type="button"
          onClick={() => { run.reset(); setPending(action); }}
          disabled={run.isPending}
          className={cn(
            'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs transition-colors disabled:opacity-50',
            action.kind === 'primary' && 'font-semibold text-emerald-700 hover:bg-emerald-600/5',
            action.kind === 'secondary' && 'text-stone-600 hover:bg-stone-50',
            action.kind === 'danger' && 'text-destructive hover:bg-destructive/5',
          )}
        >
          <ActionIcon action={action} busy={run.isPending && pending?.to === action.to} />
          {action.label}
        </button>
      ))}

      {pending && (
        <ConfirmDialog
          action={pending}
          slabCount={transfer.slabCount}
          pending={run.isPending}
          error={run.error}
          onConfirm={(note) => run.mutate({ action: pending, note })}
          onClose={() => setPending(null)}
        />
      )}
    </div>
  );
}
