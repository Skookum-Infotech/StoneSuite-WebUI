import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  attachStepHistory,
  buildProgressSteps,
  OFF_PATH_STATUS_CODES,
  PROGRESS_PATHS,
  PROGRESS_STATUS_ALIASES,
  type ProgressModule,
  type ProgressStep,
} from '@/lib/orderProgress';
import { RECORD_PROGRESS_CONFIG } from '@/lib/recordProgressConfig';

interface RecordProgressCardProps {
  module: ProgressModule;
  recordId: string;
  statusCode: string;
  statusLabel: string;
}

const SHORT_DATE: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
const LONG_DATE: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' };

function stepTooltip(step: ProgressStep): string | undefined {
  if (!step.at) return undefined;
  const when = new Date(step.at).toLocaleString(undefined, LONG_DATE);
  return step.actor ? `${step.label} · ${step.actor} · ${when}` : `${step.label} · ${when}`;
}

/** Compact status stepper for the right sidebar, shown above Quick Actions on
 *  every Sales and Purchases document. Each reached step shows the date the
 *  record entered it (hover for who); the current step is bold. A record that
 *  has left the forward path (Cancelled, Void, Rejected...) shows one strip. */
export function RecordProgressCard({ module, recordId, statusCode, statusLabel }: RecordProgressCardProps) {
  const config = RECORD_PROGRESS_CONFIG[module];
  const { data: audit } = useQuery({
    queryKey: ['record-progress-audit', module, recordId],
    queryFn: () => config.fetchAudit!(recordId),
    enabled: Boolean(recordId) && Boolean(config.fetchAudit),
    // A failed audit read only costs the dates, never the card.
    retry: false,
  });

  const steps = useMemo(() => {
    const built = buildProgressSteps(PROGRESS_PATHS[module], config.catalog, statusCode, PROGRESS_STATUS_ALIASES[module]);
    return audit ? attachStepHistory(built, audit) : built;
  }, [module, config.catalog, statusCode, audit]);

  if (OFF_PATH_STATUS_CODES.has(statusCode)) {
    return (
      <div role="status" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-700">
        <span className="font-semibold">{statusLabel}.</span> No further steps apply.
      </div>
    );
  }

  const currentIdx = steps.findIndex((s) => s.state === 'current');

  return (
    <div className="mb-4 rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="mb-2.5 flex items-center justify-between">
        <p className="text-xs font-semibold text-stone-500">Progress</p>
        {currentIdx >= 0 && <span className="text-2xs text-stone-500">Step {currentIdx + 1} of {steps.length}</span>}
      </div>
      <ol aria-label={config.title}>
        {steps.map((step, idx) => (
          <li
            key={step.code}
            title={stepTooltip(step)}
            aria-current={step.state === 'current' ? 'step' : undefined}
            className="relative flex h-6.5 items-center gap-2.5"
          >
            {idx < steps.length - 1 && (
              <span
                aria-hidden="true"
                className={cn('absolute left-[7px] top-5 h-3 w-0.5', step.state === 'done' ? 'bg-lime-800' : 'bg-stone-200')}
              />
            )}
            <span
              className={cn(
                'relative z-10 flex size-4 shrink-0 items-center justify-center rounded-full border-2 bg-white',
                step.state === 'upcoming' ? 'border-stone-300' : 'border-lime-800',
                step.state === 'done' && 'bg-lime-800 text-white',
              )}
            >
              {step.state === 'done' && <Check className="size-2.5" aria-hidden="true" />}
              {step.state === 'current' && <span className="size-1.5 rounded-full bg-lime-800" />}
            </span>
            <span
              className={cn(
                'flex-1 truncate text-xs',
                step.state === 'upcoming' ? 'text-stone-400' : 'text-stone-900',
                step.state === 'current' && 'font-semibold',
              )}
            >
              {step.label}
              {step.state === 'done' && <span className="sr-only"> (completed)</span>}
            </span>
            {step.at && (
              <span className={cn('whitespace-nowrap text-2xs', step.state === 'current' ? 'font-medium text-lime-800' : 'text-stone-400')}>
                {new Date(step.at).toLocaleDateString(undefined, SHORT_DATE)}
              </span>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
