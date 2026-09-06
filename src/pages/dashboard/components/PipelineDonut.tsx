import { WidgetCard } from './WidgetCard';
import { Spinner, ErrorNote } from '@/components/tenant/ui';
import type { PipelineMix, PipelineMixSegment } from '@/types/dashboardData';

const RADIUS = 60;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

// Presentation (label, color) stays client-side; the backend returns only
// stage ids + counts (see dashboardDataService.getPipelineMix). A stage
// missing from data.segments means the caller holds no read grant on it
// (controllers/dashboard_pipeline.go omits ungranted stages rather than
// reporting them as zero), so it's simply absent here too.
const STAGE_META: Record<PipelineMixSegment['id'], { label: string; color: string }> = {
  lead: { label: 'Lead', color: '#a855f7' },
  prospect: { label: 'Prospect', color: '#3b82f6' },
  customer: { label: 'Customer', color: '#c2f589' },
};

export function PipelineDonut({
  data,
  isLoading,
  isError,
}: {
  data: PipelineMix | undefined;
  isLoading: boolean;
  isError: boolean;
}) {
  if (isLoading) {
    return (
      <WidgetCard title="Pipeline mix">
        <Spinner label="Loading pipeline mix…" />
      </WidgetCard>
    );
  }

  if (isError || !data) {
    return (
      <WidgetCard title="Pipeline mix">
        <ErrorNote>Couldn&apos;t load pipeline mix.</ErrorNote>
      </WidgetCard>
    );
  }

  const segments = data.segments;
  const total = segments.reduce((sum, s) => sum + s.count, 0);

  const arcs = segments.map((s, i) => {
    const priorCount = segments.slice(0, i).reduce((sum, x) => sum + x.count, 0);
    const length = total > 0 ? (s.count / total) * CIRCUMFERENCE : 0;
    const offset = total > 0 ? -(priorCount / total) * CIRCUMFERENCE : 0;
    return { ...s, ...STAGE_META[s.id], length, offset };
  });

  return (
    <WidgetCard title="Pipeline mix" subtitle={`${total} records`}>
      <div className="flex items-center gap-[18px]">
        <div className="relative h-[142px] w-[142px] shrink-0">
          <svg viewBox="0 0 140 140" className="h-full w-full" aria-hidden="true">
            <g transform="rotate(-90 70 70)" fill="none" strokeWidth="15">
              <circle cx="70" cy="70" r={RADIUS} stroke="#f0f0ef" />
              {arcs.map((a) => (
                <circle
                  key={a.id}
                  cx="70"
                  cy="70"
                  r={RADIUS}
                  stroke={a.color}
                  strokeDasharray={`${a.length} ${CIRCUMFERENCE - a.length}`}
                  strokeDashoffset={a.offset}
                />
              ))}
            </g>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold leading-none tracking-[-0.02em] text-stone-950 tabular-nums">
              {data.closeRate}%
            </span>
            <span className="mt-0.5 text-[10px] text-stone-500">close rate</span>
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-[11px]">
          {arcs.map((s) => (
            <div key={s.id} className="flex items-center gap-[9px]">
              <span className="h-[9px] w-[9px] shrink-0 rounded-[3px]" style={{ background: s.color }} aria-hidden="true" />
              <span className="flex-1 text-[13px] font-semibold text-stone-950">{s.label}</span>
              <span className="text-xs font-bold text-stone-500 tabular-nums">{s.count}</span>
            </div>
          ))}
        </div>
      </div>
    </WidgetCard>
  );
}
