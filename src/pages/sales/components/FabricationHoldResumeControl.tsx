import { useMutation } from '@tanstack/react-query';
import { Pause, Play, Loader2 } from 'lucide-react';
import { fabricationService } from '@/services/fabricationService';
import { apiErrorMessage } from '@/api/tenantClient';
import { canHold } from '@/lib/fabricationForm';
import type { FabricationJob } from '@/types/fabrication';

// Hold and Resume are their own buttons, not status-select options (see
// FabricationStatusControl's doc comment). Resume in particular takes no
// target — POST /resume restores whatever status the job was held from,
// stored server-side, never caller-supplied — so there is nothing to pick
// here, just a single action.
export function FabricationHoldResumeControl({ job, disabled, onChanged }: {
  job: Pick<FabricationJob, 'id' | 'statusCode'>;
  disabled?: boolean;
  onChanged: (updated: FabricationJob) => void;
}) {
  const hold = useMutation({
    mutationFn: () => fabricationService.hold(job.id),
    onSuccess: onChanged,
  });
  const resume = useMutation({
    mutationFn: () => fabricationService.resume(job.id),
    onSuccess: onChanged,
  });

  if (job.statusCode === 'HOLD') {
    return (
      <div className="space-y-1.5">
        <button
          type="button"
          onClick={() => resume.mutate()}
          disabled={disabled || resume.isPending}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-50 transition-all"
        >
          {resume.isPending ? <Loader2 className="size-3 animate-spin" /> : <Play className="size-3" />}
          {resume.isPending ? 'Resuming…' : 'Resume Job'}
        </button>
        {resume.error && (
          <p className="text-2xs text-destructive">{apiErrorMessage(resume.error, 'Failed to resume job.')}</p>
        )}
      </div>
    );
  }

  if (!canHold(job.statusCode)) return null;

  return (
    <div className="space-y-1.5">
      <button
        type="button"
        onClick={() => hold.mutate()}
        disabled={disabled || hold.isPending}
        className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-50 transition-all"
      >
        {hold.isPending ? <Loader2 className="size-3 animate-spin" /> : <Pause className="size-3" />}
        {hold.isPending ? 'Placing on hold…' : 'Hold Job'}
      </button>
      {hold.error && (
        <p className="text-2xs text-destructive">{apiErrorMessage(hold.error, 'Failed to place job on hold.')}</p>
      )}
    </div>
  );
}
