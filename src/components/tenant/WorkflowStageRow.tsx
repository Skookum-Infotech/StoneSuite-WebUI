import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import type { WorkflowStageView } from '@/lib/workflowStages';
import { STAGE_ICONS } from '@/components/tenant/workflowStageIcons';
import { progressStatusColor } from '@/lib/progressStatusColor';
import { stagePalette } from '@/components/tenant/workflowStagePalette';
import { WorkflowStagePanel } from '@/components/tenant/WorkflowStagePanel';

interface WorkflowStageRowProps {
  stage: WorkflowStageView;
  isLast: boolean;
  hereStatusCode: string;
  /** Colour of the line down to the next stage; grey when absent. */
  lineColor?: string;
}

const UPCOMING_RING = '#e8e8e8';
const UPCOMING_ICON = '#c9c5c0';
const WHITE = '#ffffff';

/** Ring, fill and icon colours for a marker. A finished stage (or a viewed
 *  record at its last status) gets the pale fill, mid-tone ring and dark icon;
 *  a live one a white fill with a ring-coloured icon; an unstarted one grey. */
function markerColors(stage: WorkflowStageView): { ring: string; fill: string; icon: string } {
  const pal = stagePalette(stage);
  if (stage.state === 'upcoming') return { ring: UPCOMING_RING, fill: WHITE, icon: UPCOMING_ICON };
  if (stage.state === 'done' || stage.state === 'void' || (stage.state === 'here' && stage.complete)) {
    return { ring: pal.ring, fill: pal.tint, icon: pal.ink };
  }
  return { ring: pal.ring, fill: WHITE, icon: pal.ring };
}

/** The subtitle with its status word in that status's own pill colour, so the
 *  last active status reads the same here as on the record's page. */
function withStatusColour(stage: WorkflowStageView, number: string | undefined, statusCode: string) {
  const status = stage.state === 'here' ? stage.subtitle : stage.records[0]?.status;
  const coloured = <span className="font-medium" style={{ color: progressStatusColor(stage.module, statusCode) }}>{status}</span>;
  return stage.state === 'here' || !number ? coloured : <>{number} · {coloured}</>;
}

/** One row of the progress card: icon marker, stage name, linked record + status.
 *  Hovering or focusing it opens the sub-status panel; a single linked record
 *  is a link to that record. The marker is a 20px grid cell with a centred icon.
 *  The colours come from a per-stage palette (data), so they are set inline like
 *  the shared Badge does. */
export function WorkflowStageRow({ stage, isLast, hereStatusCode, lineColor }: WorkflowStageRowProps) {
  const single = stage.records.length === 1 ? stage.records[0] : undefined;
  const hasPanel = stage.state === 'here' || stage.records.length > 0;
  const href = single && stage.state !== 'here' ? `${stage.route}/${single.id}` : undefined;
  const rowCls = cn(
    'group relative flex min-h-9 gap-2.5 rounded-lg px-1.5 py-1 -mx-1.5 outline-none focus-visible:ring-2 focus-visible:ring-brand-dark',
    hasPanel && 'hover:bg-stone-50',
  );
  const pal = stagePalette(stage);
  const { ring, fill, icon } = markerColors(stage);
  const Icon = STAGE_ICONS[stage.key];
  const statusCode = stage.state === 'here' ? hereStatusCode : single?.statusCode;

  const body = (
    <>
      {!isLast && (
        <span
          aria-hidden="true"
          className={cn('absolute left-[15px] top-7 -bottom-1 w-0.5', !lineColor && 'bg-stone-200')}
          style={lineColor ? { backgroundColor: lineColor } : undefined}
        />
      )}
      <span
        className="relative z-10 mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border-2"
        style={{ borderColor: ring, backgroundColor: fill }}
      >
        <Icon className="size-3" style={{ color: icon }} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-1.5">
          <span className={cn('text-xs font-medium', stage.state === 'upcoming' ? 'text-stone-400' : 'text-stone-900')}>
            {stage.label}
            {stage.state === 'done' && <span className="sr-only"> (completed)</span>}
          </span>
          {stage.state === 'here' && (
            <span
              className="rounded-full border px-1.5 text-[9.5px] font-semibold"
              style={{ backgroundColor: pal.tint, color: pal.ink, borderColor: pal.ring }}
            >
              this record
            </span>
          )}
        </span>
        <span className={cn('block truncate text-2xs', stage.state === 'void' ? 'text-red-700' : stage.state === 'upcoming' ? 'text-stone-400' : 'text-stone-500')}>
          {statusCode && stage.state !== 'void' ? withStatusColour(stage, single?.number, statusCode) : stage.subtitle}
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
