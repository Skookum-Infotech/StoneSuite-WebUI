import { Select } from '@/components/ui/select';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Save } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fieldCls } from '@/components/crm/formUtils';
import { fabricationService } from '@/services/fabricationService';
import { apiErrorMessage } from '@/api/tenantClient';
import { STEP_LABELS, STEP_STATUS_OPTIONS, STEP_STATUS_LABELS, STEP_STATUS_COLORS } from '@/lib/fabricationForm';
import type { FabricationJobStep } from '@/types/fabrication';

import { buttonVariants } from '@/components/ui/button';
import { StatusPill } from '@/components/ui/StatusPill';
// The 16-step checklist. Piece-grain steps (templating, cutting, edging,
// etc.) are seeded once per piece, so several rows share a step code and are
// told apart by `pieceUuid`. Each row saves independently: the PATCH carries
// that row's pieceUuid, so completing a step for one piece leaves the others
// untouched. Whole-job steps have no pieceUuid and omit it.
//
// Drafts and errors are keyed per row (`rowKey`), not per step code — keying
// by code would make every piece's row of a step share one draft.
function rowKey(step: Pick<FabricationJobStep, 'code' | 'pieceUuid'>): string {
  return `${step.code}:${step.pieceUuid ?? ''}`;
}

export function FabricationStepsTab({ jobId, steps, canEdit }: {
  jobId: string;
  steps: FabricationJobStep[];
  canEdit: boolean;
}) {
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, { status: string; notes: string }>>({});
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});

  const update = useMutation({
    mutationFn: ({ step, status, notes }: { step: FabricationJobStep; status: string; notes: string }) =>
      fabricationService.updateStep(jobId, step.code, {
        status,
        notes: notes || undefined,
        pieceUuid: step.pieceUuid,
      }),
    onSuccess: (_step, { step }) => {
      queryClient.invalidateQueries({ queryKey: ['fabrication-job', jobId] });
      // Drop the saved draft so the row shows the server's value again.
      setDrafts((prev) => { const n = { ...prev }; delete n[rowKey(step)]; return n; });
      setRowErrors((prev) => { const n = { ...prev }; delete n[rowKey(step)]; return n; });
    },
    onError: (err, { step }) => {
      setRowErrors((prev) => ({ ...prev, [rowKey(step)]: apiErrorMessage(err, 'Failed to update step.') }));
    },
  });

  function draftFor(step: FabricationJobStep) {
    return drafts[rowKey(step)] ?? { status: step.status, notes: step.notes ?? '' };
  }

  function setDraft(step: FabricationJobStep, patch: Partial<{ status: string; notes: string }>) {
    const key = rowKey(step);
    setDrafts((prev) => ({ ...prev, [key]: { ...(prev[key] ?? draftFor(step)), ...patch } }));
  }

  function save(step: FabricationJobStep) {
    const draft = draftFor(step);
    if (draft.status === 'skipped' && !draft.notes.trim()) {
      setRowErrors((prev) => ({ ...prev, [rowKey(step)]: 'A skipped step requires a note explaining why.' }));
      return;
    }
    update.mutate({ step, status: draft.status, notes: draft.notes });
  }

  const isSaving = (step: FabricationJobStep) =>
    update.isPending && update.variables !== undefined && rowKey(update.variables.step) === rowKey(step);

  // Running per-code counter so duplicate piece-grain rows read as "2 of 4"
  // rather than looking like unexplained repeats.
  const seenCounts: Record<string, number> = {};
  const totalByCode: Record<string, number> = {};
  for (const s of steps) totalByCode[s.code] = (totalByCode[s.code] ?? 0) + 1;

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto modal-scrollbar rounded-lg border border-stone-200 bg-white">
        <table className="w-full text-left type-cell">
          <thead className="bg-stone-50 border-b border-stone-200">
            <tr>
              {['Step', 'Status', 'Notes', 'Started', 'Completed', canEdit ? '' : undefined].filter(Boolean).map((h) => (
                <th key={h} className="px-3 py-2.5 whitespace-nowrap type-th">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {steps.map((step, i) => {
              seenCounts[step.code] = (seenCounts[step.code] ?? 0) + 1;
              const dup = totalByCode[step.code] > 1;
              const draft = draftFor(step);
              const dirty = draft.status !== step.status || draft.notes !== (step.notes ?? '');
              const stepLabel = STEP_LABELS[step.code] ?? step.code;
              // Disambiguates duplicate piece-grain rows in every accessible
              // name below — otherwise several rows sharing one step code
              // would announce identically to a screen reader.
              const rowLabel = dup ? `${stepLabel} (piece ${seenCounts[step.code]} of ${totalByCode[step.code]})` : stepLabel;
              return (
                <tr key={`${rowKey(step)}-${i}`} className="hover:bg-stone-50/50 align-top">
                  <td className="px-3 py-2.5">
                    <p className="font-medium text-ink-strong">{stepLabel}</p>
                    {dup && <p className="type-helper">piece {seenCounts[step.code]} of {totalByCode[step.code]}</p>}
                  </td>
                  <td className="px-3 py-2.5">
                    {canEdit ? (
                      <Select
                        value={draft.status}
                        onChange={(e) => setDraft(step, { status: e.target.value })}
                        className={cn(fieldCls, 'h-8 py-1 w-36')}
                        aria-label={`Status for ${rowLabel}`}
                      >
                        {STEP_STATUS_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>{STEP_STATUS_LABELS[opt]}</option>
                        ))}
                      </Select>
                    ) : (
                      <StepStatusBadge status={step.status} />
                    )}
                  </td>
                  <td className="px-3 py-2.5 min-w-[160px]">
                    {canEdit ? (
                      <input
                        type="text"
                        value={draft.notes}
                        onChange={(e) => setDraft(step, { notes: e.target.value })}
                        placeholder={draft.status === 'skipped' ? 'Required — why was this skipped?' : 'Optional note'}
                        className={cn(fieldCls, 'h-8 py-1')}
                        aria-label={`Notes for ${rowLabel}`}
                      />
                    ) : (
                      <span className="text-ink-muted">{step.notes || '—'}</span>
                    )}
                    {rowErrors[rowKey(step)] && <p className="mt-1 type-error">{rowErrors[rowKey(step)]}</p>}
                  </td>
                  <td className="type-cell px-3 py-2.5 whitespace-nowrap">
                    {step.startedAt ? new Date(step.startedAt).toLocaleDateString() : '—'}
                  </td>
                  <td className="type-cell px-3 py-2.5 whitespace-nowrap">
                    {step.completedAt ? new Date(step.completedAt).toLocaleDateString() : '—'}
                  </td>
                  {canEdit && (
                    <td className="px-3 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => save(step)}
                        disabled={!dirty || isSaving(step)}
                        aria-label={`Save ${rowLabel}`}
                        className={buttonVariants({ size: 'sm' })}
                      >
                        {isSaving(step)
                          ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
                        Save
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
            {steps.length === 0 && (
              <tr><td colSpan={6} className="type-cell py-8 text-center">No checklist steps found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StepStatusBadge({ status }: { status: string }) {
  return (
    <StatusPill color={STEP_STATUS_COLORS[status] ?? '#a8a29e'}>{STEP_STATUS_LABELS[status] ?? status}</StatusPill>
  );
}
