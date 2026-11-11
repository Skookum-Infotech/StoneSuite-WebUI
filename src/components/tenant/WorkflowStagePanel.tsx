import { useState } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { buildPanelSteps, type WorkflowStageView } from '@/lib/workflowStages';
import { progressStatusColor } from '@/lib/progressStatusColor';
import { STAGE_ICONS } from '@/components/tenant/workflowStageIcons';
import { stagePalette } from '@/components/tenant/workflowStagePalette';

const UPCOMING_RING = '#e0dedb';
const WHITE = '#ffffff';
/** Hex alpha suffixes: a done step's faded ring, its pale fill, and the
 *  connector between two done steps. */
const DONE_RING_ALPHA = '66';
const DONE_FILL_ALPHA = '1f';
const CONNECTOR_ALPHA = '88';

interface WorkflowStagePanelProps {
  stage: WorkflowStageView;
  /** The viewed record's own status; used when the stage is the current page. */
  hereStatusCode: string;
  /** Pinned open by a click on the stage row. */
  open: boolean;
}

/** Click-pinned panel for one workflow stage: the sub-statuses of its record, or
 *  a short list of records when the stage holds several. Stays open while the
 *  cursor moves into it, so its link and "more steps" control are reachable. */
export function WorkflowStagePanel({ stage, hereStatusCode, open }: WorkflowStagePanelProps) {
  const single = stage.records.length === 1 ? stage.records[0] : undefined;
  const statusCode = stage.state === 'here' ? hereStatusCode : single?.statusCode;

  return (
    <div
      role="tooltip"
      className={cn('absolute right-full top-0 z-30 mr-2 w-52 rounded-xl border border-stone-200 bg-white p-3 shadow-md', !open && 'hidden')}
    >
      {statusCode ? (
        <SubStatusList
          stage={stage}
          statusCode={statusCode}
          title={single ? `${stage.label} ${single.number}` : stage.label}
          href={single && stage.state !== 'here' ? `${stage.route}/${single.id}` : undefined}
          linkLabel={`${stage.label}: ${stage.subtitle}`}
          linkText={single ? `Open ${single.number}` : ''}
        />
      ) : (
        <>
          <p className="mb-1.5 text-xs font-semibold text-stone-500">{stage.label} records</p>
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

interface SubStatusListProps {
  stage: WorkflowStageView;
  statusCode: string;
  title: string;
  /** Route of the stage's record; absent on the viewed record's own stage. */
  href?: string;
  linkLabel: string;
  linkText: string;
}

/** Sub-statuses as a dot list. Every marker is a 16px circle with its dot
 *  centred: a passed status a faded ring with a dot in its own status colour (the
 *  one its pill uses), the current one a crisp ring with a larger dot, anything
 *  not reached yet an empty grey ring. The connector runs only in the gap between
 *  two circles (8px, touching both), so it never draws inside one. The header
 *  keeps the stage's palette. */
function SubStatusList({ stage, statusCode, title, href, linkLabel, linkText }: SubStatusListProps) {
  const [expanded, setExpanded] = useState(false);
  const { steps, hiddenCount } = buildPanelSteps(stage.module, statusCode, stage.window, expanded);
  const pal = stagePalette(stage);
  const Icon = STAGE_ICONS[stage.key];
  return (
    <>
      <div className="mb-1.5 flex items-center gap-1.5">
        <span className="grid size-[18px] place-items-center rounded-[5px]" style={{ backgroundColor: pal.tint }}>
          <Icon className="size-3" style={{ color: pal.ink }} aria-hidden="true" />
        </span>
        <p className="text-xs font-semibold" style={{ color: pal.ink }}>{title}</p>
      </div>
      {href && (
        <Link to={href} aria-label={linkLabel} className="mb-1.5 block text-xs font-medium text-stone-900 hover:underline">{linkText} →</Link>
      )}
      <ul>
        {steps.map((s, i) => {
          const color = progressStatusColor(stage.module, s.code);
          const reached = s.state !== 'upcoming';
          return (
            <li key={s.code} className={cn('relative flex h-6 items-center gap-2.5 text-xs', reached ? 'text-stone-900' : 'text-stone-400')}>
              {(i < steps.length - 1 || hiddenCount > 0) && (
                <span
                  aria-hidden="true"
                  className={cn('absolute left-[7px] top-5 h-2 w-0.5', s.state !== 'done' && 'bg-stone-200')}
                  style={s.state === 'done' ? { backgroundColor: `${color}${CONNECTOR_ALPHA}` } : undefined}
                />
              )}
              <span
                aria-hidden="true"
                className="relative z-10 grid size-4 shrink-0 place-items-center rounded-full border-2"
                style={{
                  borderColor: s.state === 'done' ? `${color}${DONE_RING_ALPHA}` : reached ? color : UPCOMING_RING,
                  backgroundColor: s.state === 'done' ? `${color}${DONE_FILL_ALPHA}` : WHITE,
                }}
              >
                {s.state === 'done' && <span className="size-1.5 rounded-full" style={{ backgroundColor: color }} />}
                {s.state === 'current' && <span className="size-2 rounded-full" style={{ backgroundColor: color }} />}
              </span>
              <span className={cn(s.state === 'current' && 'font-semibold')}>{s.label}</span>
              {s.state === 'current' && <span className="sr-only"> (current)</span>}
            </li>
          );
        })}
        {(hiddenCount > 0 || expanded) && (
          <li className="flex h-6 items-center text-xs text-stone-500">
            <button type="button" onClick={() => setExpanded(!expanded)} className="flex items-center gap-2.5 hover:text-stone-900">
              <span aria-hidden="true" className="size-4 shrink-0 rounded-full border-2 border-stone-200 bg-white" />
              {expanded ? 'Show fewer' : `+ ${hiddenCount} more steps`}
            </button>
          </li>
        )}
      </ul>
    </>
  );
}
