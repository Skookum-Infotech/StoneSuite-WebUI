import { PLANNER_CLOCK } from '@/lib/plannerPlacement';
import { formatWallClock } from '@/lib/salesOrderSchedule';
import type { Conflict, ConflictResponse } from '@/types/installSchedule';

interface Props {
  conflicts: ConflictResponse;
  onBookAnyway: () => void;
  onChangeTime: () => void;
  busy?: boolean;
}

function whenOf(c: Conflict): string {
  const start = formatWallClock(c.startLocal, PLANNER_CLOCK) || c.startLocal;
  const end = formatWallClock(c.endLocal, PLANNER_CLOCK) || c.endLocal;
  return `${start} to ${end}`;
}

function lineFor(c: Conflict): string {
  const job = c.jobNumber ? ` on ${c.jobNumber}` : '';
  if (c.type === 'crew') return `${c.employeeName ?? 'A crew member'} is already booked${job}, ${whenOf(c)}.`;
  return `This job already has a visit${job}, ${whenOf(c)}.`;
}

/** The overlaps a booking would create. An alert, so a screen reader announces
 *  it; the person either books anyway (acknowledging them) or changes the time. */
export function InstallConflictNotice({ conflicts, onBookAnyway, onChangeTime, busy = false }: Props) {
  return (
    <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
      <p className="font-semibold">{conflicts.message}</p>
      <ul className="mt-1 list-disc space-y-0.5 pl-4">
        {conflicts.conflicts.map((c, i) => (
          <li key={`${c.type}:${c.employeeId ?? ''}:${c.appointmentId ?? i}`}>{lineFor(c)}</li>
        ))}
      </ul>
      {Boolean(conflicts.moreConflicts) && <p className="mt-1">and {conflicts.moreConflicts} more.</p>}
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onBookAnyway}
          disabled={busy}
          className="rounded-md bg-amber-600 px-2.5 py-1 font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
        >
          Book anyway
        </button>
        <button
          type="button"
          onClick={onChangeTime}
          disabled={busy}
          className="rounded-md border border-amber-300 bg-white px-2.5 py-1 font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50"
        >
          Change time
        </button>
      </div>
    </div>
  );
}
