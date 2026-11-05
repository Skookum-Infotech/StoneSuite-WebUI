import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WorkflowStageView } from '@/lib/workflowStages';
import { WorkflowStagePanel } from '@/components/tenant/WorkflowStagePanel';

interface WorkflowStageRowProps {
  stage: WorkflowStageView;
  isLast: boolean;
  hereStatusCode: string;
}

const MARKER_BY_STATE: Record<WorkflowStageView['state'], string> = {
  done: 'border-lime-800 bg-lime-800 text-white',
  here: 'border-lime-800 bg-white',
  progress: 'border-lime-800 bg-white',
  upcoming: 'border-stone-300 bg-white',
  void: 'border-red-500 bg-red-50',
};

/** One row of the workflow card: marker, stage name, linked record + status.
 *  Hovering or focusing it opens the sub-status panel; a single linked record
 *  is a link to that record. */
export function WorkflowStageRow({ stage, isLast, hereStatusCode }: WorkflowStageRowProps) {
  const single = stage.records.length === 1 ? stage.records[0] : undefined;
  const hasPanel = stage.state === 'here' || stage.records.length > 0;
  const href = single && stage.state !== 'here' ? `${stage.route}/${single.id}` : undefined;
  const rowCls = cn(
    'group relative flex min-h-9 gap-2.5 rounded-lg px-1.5 py-1 -mx-1.5 outline-none focus-visible:ring-2 focus-visible:ring-lime-700',
    hasPanel && 'hover:bg-stone-50',
  );

  const body = (
    <>
      {!isLast && (
        <span aria-hidden="true" className={cn('absolute left-[14px] top-6 -bottom-1 w-0.5', stage.state === 'done' ? 'bg-lime-800' : 'bg-stone-200')} />
      )}
      <span className={cn('relative z-10 mt-0.5 flex size-[18px] shrink-0 items-center justify-center rounded-full border-2', MARKER_BY_STATE[stage.state])}>
        {stage.state === 'done' && <Check className="size-3" aria-hidden="true" />}
        {stage.state === 'here' && <span className="size-[7px] rounded-full bg-lime-800" />}
        {stage.state === 'progress' && <span className="size-[7px] rounded-full border-[1.5px] border-lime-800" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-1.5">
          <span className={cn('text-xs font-medium', stage.state === 'upcoming' ? 'text-stone-400' : 'text-stone-900')}>
            {stage.label}
            {stage.state === 'done' && <span className="sr-only"> (completed)</span>}
          </span>
          {stage.state === 'here' && <span className="rounded-full bg-lime-100 px-1.5 text-[9.5px] text-lime-900">this record</span>}
        </span>
        <span className={cn('block truncate text-2xs', stage.state === 'void' ? 'text-red-700' : stage.state === 'upcoming' ? 'text-stone-400' : 'text-stone-500')}>
          {stage.subtitle}
        </span>
      </span>
      {hasPanel && <WorkflowStagePanel stage={stage} hereStatusCode={hereStatusCode} />}
    </>
  );

  if (href) {
    return (
      <li aria-current={undefined}>
        <Link to={href} className={rowCls} aria-label={`${stage.label}: ${stage.subtitle}`}>{body}</Link>
      </li>
    );
  }
  return (
    <li aria-current={stage.state === 'here' ? 'step' : undefined}>
      <div className={rowCls} tabIndex={hasPanel ? 0 : undefined}>{body}</div>
    </li>
  );
}
