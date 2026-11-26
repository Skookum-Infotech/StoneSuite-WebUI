import { AlertTriangle, CheckCircle2, OctagonAlert } from 'lucide-react';
import type { HealthProblem } from '@/types/systemHealth';
import { HealthCard } from './HealthCard';

interface ProblemsCardProps {
  problems: HealthProblem[];
}

/** Open problems, critical first. Each one is also emailed (once a day). */
export function ProblemsCard({ problems }: ProblemsCardProps) {
  const sorted = [...problems].sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'critical' ? -1 : 1));
  return (
    <HealthCard title="Problems" subtitle="Each problem is emailed to the team once a day while it lasts.">
      {sorted.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="size-4" aria-hidden="true" />
          No problems found.
        </p>
      ) : (
        <ul className="space-y-3">
          {sorted.map((p) => (
            <li
              key={p.key}
              className={
                p.severity === 'critical'
                  ? 'flex gap-3 rounded-lg bg-red-50 p-3 text-red-900 dark:bg-red-950/40 dark:text-red-200'
                  : 'flex gap-3 rounded-lg bg-amber-50 p-3 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200'
              }
            >
              {p.severity === 'critical' ? (
                <OctagonAlert className="mt-0.5 size-4 shrink-0" aria-label="Critical" />
              ) : (
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-label="Warning" />
              )}
              <div>
                <p className="text-sm font-semibold">{p.title}</p>
                <p className="mt-0.5 text-xs">{p.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </HealthCard>
  );
}
