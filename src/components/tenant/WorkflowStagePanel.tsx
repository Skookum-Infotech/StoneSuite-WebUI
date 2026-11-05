import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { buildPanelSteps, type WorkflowStageView } from '@/lib/workflowStages';
import type { ProgressModule } from '@/lib/orderProgress';

interface WorkflowStagePanelProps {
  stage: WorkflowStageView;
  /** The viewed record's own status; used when the stage is the current page. */
  hereStatusCode: string;
}

/** Hover/focus panel for one workflow stage: the sub-statuses of its record, or
 *  a short list of records when the stage holds several. */
export function WorkflowStagePanel({ stage, hereStatusCode }: WorkflowStagePanelProps) {
  const single = stage.records.length === 1 ? stage.records[0] : undefined;
  const statusCode = stage.state === 'here' ? hereStatusCode : single?.statusCode;

  return (
    <div
      role="tooltip"
      className="absolute right-full top-0 z-30 mr-2 hidden w-52 rounded-xl border border-stone-200 bg-white p-3 shadow-md group-hover:block group-focus-within:block"
    >
      {statusCode ? <SubStatusList module={stage.module} statusCode={statusCode} title={single ? `${stage.label} ${single.number}` : stage.label} /> : (
        <>
          <p className="mb-1.5 text-2xs font-semibold text-stone-500">{stage.label} records</p>
          <ul className="space-y-1">
            {stage.records.map((r) => (
              <li key={r.id} className="flex justify-between gap-2 text-xs">
                <Link to={`${stage.route}/${r.id}`} className="font-medium text-stone-900 hover:underline">{r.number}</Link>
                <span className="text-stone-500">{r.status}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      {stage.hidden && <p className="mt-1.5 text-2xs text-stone-400">Some records are not shown.</p>}
    </div>
  );
}

function SubStatusList({ module, statusCode, title }: { module: ProgressModule; statusCode: string; title: string }) {
  const { steps, hiddenCount } = buildPanelSteps(module, statusCode);
  return (
    <>
      <p className="mb-1.5 text-2xs font-semibold text-stone-500">{title}</p>
      <ul>
        {steps.map((s) => (
          <li key={s.code} className={cn('flex h-5 items-center gap-2 text-xs', s.state === 'upcoming' ? 'text-stone-400' : 'text-stone-900', s.state === 'current' && 'font-semibold')}>
            <span
              aria-hidden="true"
              className={cn('size-2 shrink-0 rounded-full', s.state === 'upcoming' ? 'bg-stone-300' : 'bg-lime-800', s.state === 'current' && 'ring-2 ring-lime-200')}
            />
            {s.label}
            {s.state === 'current' && <span className="sr-only"> (current)</span>}
          </li>
        ))}
        {hiddenCount > 0 && (
          <li className="flex h-5 items-center gap-2 text-xs text-stone-400">
            <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-stone-300" />
            + {hiddenCount} more steps
          </li>
        )}
      </ul>
    </>
  );
}
