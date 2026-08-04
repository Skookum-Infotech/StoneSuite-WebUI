import { ChevronRight } from 'lucide-react';
import type { PipelineStage } from '../mockData';

export function PipelineFunnel({ stages }: { stages: PipelineStage[] }) {
  const maxCount = Math.max(...stages.map((s) => s.count));

  return (
    <div className="rounded-2xl border border-stone-300/70 bg-card p-6 ring-1 ring-foreground/5">
      <div className="flex items-baseline justify-between">
        <h2 className="font-brand text-lg text-foreground">Pipeline this month</h2>
        <p className="text-xs text-muted-foreground">Lead → Prospect → Customer</p>
      </div>

      <div className="mt-6 flex flex-col gap-5">
        {stages.map((stage, i) => {
          const widthPct = Math.max((stage.count / maxCount) * 100, 12);
          const prev = stages[i - 1];
          const conversion = prev ? Math.round((stage.count / prev.count) * 100) : null;

          return (
            <div key={stage.id}>
              {conversion !== null && (
                <div className="mb-2 flex items-center gap-1.5 pl-1 text-2xs font-semibold text-muted-foreground">
                  <ChevronRight className="size-3" aria-hidden="true" />
                  <span>{conversion}% advanced to {stage.label.toLowerCase()}</span>
                </div>
              )}
              <div className="flex items-center gap-3">
                <span className={`w-24 shrink-0 text-xs font-semibold ${stage.textClassName}`}>
                  {stage.label}
                </span>
                <div className="h-8 flex-1 overflow-hidden rounded-full bg-stone-100 dark:bg-white/5">
                  <div
                    className={`flex h-full items-center justify-end rounded-full px-3 ${stage.barClassName} transition-all duration-500`}
                    style={{ width: `${widthPct}%` }}
                  >
                    <span className={`text-xs font-bold tabular-nums ${stage.barTextClassName}`}>
                      {stage.count}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
