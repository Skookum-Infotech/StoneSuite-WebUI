import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation } from '@tanstack/react-query';
import { AlertTriangle, ShieldAlert, PackageCheck, Loader2 } from 'lucide-react';
import { useModalDialog } from '@/hooks/useModalDialog';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { itemReceiptService } from '@/services/itemReceiptService';
import { apiErrorMessage } from '@/api/tenantClient';
import { overReceiptDetails, type OverReceiptLine } from '@/lib/itemReceiptErrors';
import type { ItemReceipt } from '@/types/itemReceipt';

type PostBranch = 'confirm' | 'approve' | 'escalate';

// Posting is the act that actually moves stock — a distinct, deliberate step
// from saving the draft (spec §3), never an autosave. A 403 here can mean
// two very different things and the dialog branches on which: over-tolerance
// with the item_receipt:approve grant gets a reason field and a retry;
// over-tolerance without it gets told to escalate, with no retry offered.
export function PostReceiptDialog({ itemReceiptId, onPosted }: {
  itemReceiptId: string;
  onPosted: (updated: ItemReceipt) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand px-3.5 py-1.5 text-xs font-semibold text-stone-950 hover:bg-brand-hover transition-all shadow-sm active:scale-95"
      >
        <PackageCheck className="size-3.5" />
        Post Receipt
      </button>
      {open && (
        <PostReceiptDialogPanel
          itemReceiptId={itemReceiptId}
          onClose={() => setOpen(false)}
          onPosted={(updated) => { setOpen(false); onPosted(updated); }}
        />
      )}
    </>
  );
}

function PostReceiptDialogPanel({ itemReceiptId, onClose, onPosted }: {
  itemReceiptId: string;
  onClose: () => void;
  onPosted: (updated: ItemReceipt) => void;
}) {
  const { hasPermission, isLoading: permissionsLoading } = useUserPermissions();
  const canApprove = !permissionsLoading && hasPermission('item_receipt', 'approve');
  const [reason, setReason] = useState('');

  const post = useMutation({
    mutationFn: (overReceiptReason?: string) =>
      itemReceiptService.post(itemReceiptId, overReceiptReason ? { overReceiptReason } : {}),
    onSuccess: onPosted,
  });

  const overReceipt = post.error ? overReceiptDetails(post.error) : null;
  const branch: PostBranch = !overReceipt ? 'confirm' : canApprove ? 'approve' : 'escalate';

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-[2px]"
      onClick={(e) => e.target === e.currentTarget && !post.isPending && onClose()}
    >
      {/* Keyed on `branch` so the panel fully remounts when the dialog's content
          swaps to a structurally different view — otherwise useModalDialog's
          mount-time focus grab never re-fires, and the element the user just
          activated (now unmounted mid-branch-swap) drops focus to <body>,
          breaking the Tab trap and skipping the screen-reader announcement of
          the new heading. */}
      <PostReceiptDialogContent
        key={branch}
        branch={branch}
        onClose={onClose}
        isPending={post.isPending}
        error={post.error}
        overReceiptLines={overReceipt?.lines ?? []}
        reason={reason}
        setReason={setReason}
        onConfirm={() => post.mutate(undefined)}
        onConfirmOverReceipt={() => post.mutate(reason)}
      />
    </div>,
    document.body,
  );
}

function PostReceiptDialogContent({
  branch, onClose, isPending, error, overReceiptLines, reason, setReason, onConfirm, onConfirmOverReceipt,
}: {
  branch: PostBranch;
  onClose: () => void;
  isPending: boolean;
  error: unknown;
  overReceiptLines: OverReceiptLine[];
  reason: string;
  setReason: (v: string) => void;
  onConfirm: () => void;
  onConfirmOverReceipt: () => void;
}) {
  const contentRef = useModalDialog(onClose);

  return (
    <div
      ref={contentRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-labelledby="post-receipt-title"
      className="mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-2xl outline-none"
    >
      {branch === 'confirm' ? (
        <>
          <div role="alert" className="mb-4 flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent">
              <PackageCheck className="size-4 text-accent-foreground" />
            </div>
            <div>
              <h3 id="post-receipt-title" className="text-sm font-bold text-stone-900">Post this item receipt?</h3>
              <p className="text-xs text-stone-400 mt-0.5">This moves stock and advances the purchase order.</p>
            </div>
          </div>
          <p className="text-xs text-stone-600 mb-5">
            Once posted this receipt can no longer be edited. To correct a mistake, void it and receive again.
          </p>
          {error && (
            <p role="alert" className="mb-3 text-xs text-destructive">
              {apiErrorMessage(error, 'Failed to post item receipt.')}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-1.5 text-xs font-semibold text-stone-950 hover:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-all"
            >
              {isPending && <Loader2 className="size-3 animate-spin" />}
              {isPending ? 'Posting…' : 'Post Receipt'}
            </button>
          </div>
        </>
      ) : branch === 'approve' ? (
        <>
          <div role="alert" className="mb-4 flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-100">
              <ShieldAlert className="size-4 text-amber-600" />
            </div>
            <div>
              <h3 id="post-receipt-title" className="text-sm font-bold text-stone-900">This exceeds the ordered quantity</h3>
              <p className="text-xs text-stone-400 mt-0.5">Confirm the over-receipt to post anyway.</p>
            </div>
          </div>
          <OverReceiptLinesList lines={overReceiptLines} />
          <label className="mt-4 block text-xs font-semibold text-stone-900" htmlFor="over-receipt-reason">
            Reason <span className="text-red-400">*</span>
          </label>
          <textarea
            id="over-receipt-reason"
            required
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why is this shipment larger than ordered?"
            aria-label="Over-receipt reason"
            className="mt-1.5 w-full resize-none rounded-[10px] border border-stone-300 px-3.5 py-2.5 text-xs text-stone-900 outline-none transition-all focus:border-brand focus:ring-2 focus:ring-brand/30"
          />
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirmOverReceipt}
              disabled={isPending || !reason.trim()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-all"
            >
              {isPending && <Loader2 className="size-3 animate-spin" />}
              {isPending ? 'Posting…' : 'Confirm & Post'}
            </button>
          </div>
        </>
      ) : (
        <>
          <div role="alert" className="mb-4 flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="size-4 text-destructive" />
            </div>
            <div>
              <h3 id="post-receipt-title" className="text-sm font-bold text-stone-900">This exceeds the ordered quantity</h3>
              <p className="text-xs text-stone-400 mt-0.5">You don&apos;t have permission to accept an over-delivery.</p>
            </div>
          </div>
          <OverReceiptLinesList lines={overReceiptLines} />
          <p className="mt-4 text-xs text-stone-600">
            Ask someone with the Item Receipt Approve permission to post this receipt, or reduce the received
            quantities to stay within the ordered amount.
          </p>
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50"
            >
              Close
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function OverReceiptLinesList({ lines }: { lines: OverReceiptLine[] }) {
  return (
    <ul className="space-y-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-2xs text-amber-800">
      {lines.map((l) => (
        <li key={l.lineNumber}>
          Line {l.lineNumber} — ordered {l.ordered}, already received {l.alreadyReceived}, receiving {l.receiving}
        </li>
      ))}
    </ul>
  );
}
