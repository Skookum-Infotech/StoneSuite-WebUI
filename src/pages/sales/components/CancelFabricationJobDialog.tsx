import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AxiosError } from 'axios';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Ban, Loader2, CheckCircle2 } from 'lucide-react';
import { fabricationService } from '@/services/fabricationService';
import { apiErrorMessage } from '@/api/tenantClient';
import { fieldCls } from '@/components/crm/formUtils';
import { cn } from '@/lib/utils';
import { DISPOSITION_OPTIONS, DISPOSITION_LABELS } from '@/lib/fabricationForm';
import type { FabricationJob, FabricationSlab, SlabDisposition } from '@/types/fabrication';

function isConflict(err: unknown): boolean {
  return err instanceof AxiosError && err.response?.status === 409;
}

interface RowDraft {
  disposition: SlabDisposition | '';
  recoveredArea: string;
  lengthMm: string;
  widthMm: string;
  thicknessMm: string;
}

const EMPTY_ROW: RowDraft = { disposition: '', recoveredArea: '', lengthMm: '', widthMm: '', thicknessMm: '' };

// Cancel-after-cutting is a multi-step flow, not one button (spec §4.4): the
// server 409s on the plain cancel transition until every already-consumed
// slab has a disposition declared (recovered/scrapped/delivered — recovered
// alone needs an area, capped server-side at the parent's remaining area).
// This dialog starts at a plain confirm step; a 409 flips it into disposition
// mode, which stays open until every consumed slab is accounted for, then
// retries the cancel automatically.
//
// The job-slabs response carries no "already has a disposition" flag (a known
// backend gap), so this dialog tracks which slabs it has personally recorded
// in `doneIds` for this session; if a row 400s because its disposition was
// already recorded elsewhere, that's treated as satisfied, not an error.
export function CancelFabricationJobDialog({ job, disabled, onCancelled }: {
  job: Pick<FabricationJob, 'id' | 'statusCode' | 'cancelRequested'>;
  disabled?: boolean;
  onCancelled: (updated: FabricationJob) => void;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'confirm' | 'disposition'>(job.cancelRequested ? 'disposition' : 'confirm');
  const [drafts, setDrafts] = useState<Record<string, RowDraft>>({});
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set());
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const { data: slabs = [], isFetching } = useQuery({
    queryKey: ['fabrication-job-slabs', job.id],
    queryFn: () => fabricationService.getJobSlabs(job.id),
    enabled: open && step === 'disposition',
  });

  const pending = slabs.filter((s) => s.status === 'consumed' && !doneIds.has(s.id));

  const cancelMutation = useMutation({
    mutationFn: () => fabricationService.requestCancel(job.id),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['fabrication-job', job.id] });
      queryClient.invalidateQueries({ queryKey: ['fabrication-jobs'] });
      setOpen(false);
      onCancelled(updated);
    },
    onError: (err) => {
      if (isConflict(err)) {
        setStep('disposition');
        queryClient.invalidateQueries({ queryKey: ['fabrication-job-slabs', job.id] });
      }
    },
  });

  const dispositionMutation = useMutation({
    mutationFn: ({ slabId, input }: { slabId: string; input: RowDraft }) =>
      fabricationService.recordDisposition(job.id, slabId, {
        disposition: input.disposition as SlabDisposition,
        recoveredArea: input.disposition === 'recovered' ? parseFloat(input.recoveredArea) || 0 : undefined,
        lengthMm: input.lengthMm ? parseFloat(input.lengthMm) : undefined,
        widthMm: input.widthMm ? parseFloat(input.widthMm) : undefined,
        thicknessMm: input.thicknessMm ? parseFloat(input.thicknessMm) : undefined,
      }),
    onSuccess: (_void, { slabId }) => {
      setDoneIds((prev) => new Set(prev).add(slabId));
      setRowErrors((prev) => {
        const next = { ...prev };
        delete next[slabId];
        return next;
      });
    },
    onError: (err, { slabId }) => {
      const msg = apiErrorMessage(err, 'Failed to record disposition.');
      // Already declared (e.g. by another user, or a prior attempt) — the
      // slab is in the state we want, so this is satisfied, not a failure.
      if (/already.*recorded/i.test(msg)) {
        setDoneIds((prev) => new Set(prev).add(slabId));
        return;
      }
      setRowErrors((prev) => ({ ...prev, [slabId]: msg }));
    },
  });

  function updateDraft(slabId: string, patch: Partial<RowDraft>) {
    setDrafts((prev) => ({ ...prev, [slabId]: { ...(prev[slabId] ?? EMPTY_ROW), ...patch } }));
  }

  function submitRow(slab: FabricationSlab) {
    const draft = drafts[slab.id] ?? EMPTY_ROW;
    if (!draft.disposition) return;
    if (draft.disposition === 'recovered' && !(parseFloat(draft.recoveredArea) > 0)) {
      setRowErrors((prev) => ({ ...prev, [slab.id]: 'Recovered area must be greater than 0.' }));
      return;
    }
    dispositionMutation.mutate({ slabId: slab.id, input: draft });
  }

  function close() {
    setOpen(false);
    setStep(job.cancelRequested ? 'disposition' : 'confirm');
    setDrafts({});
    setRowErrors({});
    setDoneIds(new Set());
  }

  // Move focus into the dialog on open and back to its trigger on close —
  // a createPortal overlay isn't natively part of the DOM's focus order, so
  // neither happens for free.
  useEffect(() => {
    if (open) {
      panelRef.current?.focus();
    } else {
      triggerRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !cancelMutation.isPending) close();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, cancelMutation.isPending]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        aria-label="Cancel fabrication job"
        className="flex items-center gap-2.5 hover:bg-destructive/5 rounded-lg px-3 py-2 cursor-pointer text-xs text-destructive w-full transition-colors text-left disabled:opacity-50"
      >
        <Ban className="size-4 shrink-0" />
        Cancel job
      </button>

      {open && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cancel-fj-dialog-title"
          onClick={(e) => e.target === e.currentTarget && !cancelMutation.isPending && close()}
        >
          <div ref={panelRef} tabIndex={-1} className="mx-4 w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl outline-none">
            <div className="mb-4 flex items-center gap-3" aria-live="polite">
              <div className="flex size-9 flex-shrink-0 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="size-4 text-destructive" />
              </div>
              <div>
                <h3 id="cancel-fj-dialog-title" className="text-sm font-bold text-stone-900">
                  {step === 'confirm' ? 'Cancel this fabrication job?' : 'Declare the fate of cut material'}
                </h3>
                <p className="text-xs text-stone-400 mt-0.5">
                  {step === 'confirm'
                    ? 'Any reserved slabs will be released. This cannot be undone.'
                    : 'Every already-cut slab needs a disposition before the job can be cancelled.'}
                </p>
              </div>
            </div>

            {step === 'confirm' && (
              <>
                {cancelMutation.isError && !isConflict(cancelMutation.error) && (
                  <p className="mb-3 text-xs text-destructive">
                    {apiErrorMessage(cancelMutation.error, 'Failed to cancel fabrication job.')}
                  </p>
                )}
                <div className="flex flex-wrap justify-end gap-2">
                  <button type="button" onClick={close} disabled={cancelMutation.isPending}
                    className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-50">
                    Back
                  </button>
                  <button type="button" onClick={() => cancelMutation.mutate()} disabled={cancelMutation.isPending}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-destructive px-3 py-1.5 text-xs font-semibold text-white hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-all">
                    {cancelMutation.isPending && <Loader2 className="size-3 animate-spin" />}
                    {cancelMutation.isPending ? 'Cancelling…' : 'Cancel job'}
                  </button>
                </div>
              </>
            )}

            {step === 'disposition' && (
              <>
                {isFetching && pending.length === 0 && (
                  <p className="py-4 text-center text-xs text-stone-400">Loading slabs…</p>
                )}

                {!isFetching && pending.length === 0 && (
                  <div className="mb-4 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2.5 text-xs text-emerald-700">
                    <CheckCircle2 className="size-4 shrink-0" />
                    Every cut slab is accounted for. Ready to finish cancelling.
                  </div>
                )}

                <div className="space-y-3 max-h-80 overflow-y-auto modal-scrollbar pr-1">
                  {pending.map((slab) => {
                    const draft = drafts[slab.id] ?? EMPTY_ROW;
                    return (
                      <div key={slab.id} className="rounded-lg border border-stone-200 p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs font-semibold text-stone-800">{slab.serial}</span>
                          <span className="text-2xs text-stone-400 tabular-nums">{slab.area} sq. area</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <select
                            value={draft.disposition}
                            onChange={(e) => updateDraft(slab.id, { disposition: e.target.value as SlabDisposition })}
                            className={cn(fieldCls, 'h-8 py-1 w-48')}
                            aria-label={`Disposition for slab ${slab.serial}`}
                          >
                            <option value="">— Select disposition —</option>
                            {DISPOSITION_OPTIONS.map((opt) => (
                              <option key={opt} value={opt}>{DISPOSITION_LABELS[opt]}</option>
                            ))}
                          </select>
                          {draft.disposition === 'recovered' && (
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={draft.recoveredArea}
                              onChange={(e) => updateDraft(slab.id, { recoveredArea: e.target.value })}
                              placeholder="Recovered area *"
                              className={cn(fieldCls, 'h-8 py-1 w-32')}
                              aria-label={`Recovered area for slab ${slab.serial}`}
                            />
                          )}
                          <button
                            type="button"
                            onClick={() => submitRow(slab)}
                            disabled={!draft.disposition || dispositionMutation.isPending}
                            aria-label={`Record disposition for slab ${slab.serial}`}
                            className="inline-flex items-center gap-1 rounded-md bg-brand px-2.5 py-1.5 text-2xs font-semibold text-stone-900 hover:bg-brand-hover disabled:opacity-50 transition-colors"
                          >
                            {dispositionMutation.isPending && dispositionMutation.variables?.slabId === slab.id
                              ? <Loader2 className="size-3 animate-spin" /> : null}
                            Record
                          </button>
                        </div>
                        {rowErrors[slab.id] && (
                          <p className="text-2xs text-destructive">{rowErrors[slab.id]}</p>
                        )}
                      </div>
                    );
                  })}
                </div>

                {cancelMutation.isError && (
                  <p className="mt-3 text-xs text-destructive">
                    {apiErrorMessage(cancelMutation.error, 'Failed to cancel fabrication job.')}
                  </p>
                )}

                <div className="mt-4 flex flex-wrap justify-end gap-2">
                  <button type="button" onClick={close} disabled={cancelMutation.isPending}
                    className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-50">
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={() => cancelMutation.mutate()}
                    disabled={pending.length > 0 || cancelMutation.isPending}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-destructive px-3 py-1.5 text-xs font-semibold text-white hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-all"
                  >
                    {cancelMutation.isPending && <Loader2 className="size-3 animate-spin" />}
                    {cancelMutation.isPending ? 'Cancelling…' : 'Finish cancelling'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
