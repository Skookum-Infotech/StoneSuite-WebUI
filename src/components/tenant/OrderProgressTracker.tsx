import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CANCELLED_STATUS_CODE, type ProgressStep } from '@/lib/orderProgress';

interface OrderProgressTrackerProps {
  steps: ProgressStep[];
  statusCode: string;
  statusLabel: string;
  ariaLabel: string;
}

/** Horizontal status stepper shown at the top of an order's Overview tab. A
 *  cancelled order leaves the forward path, so it shows a single strip instead. */
export function OrderProgressTracker({ steps, statusCode, statusLabel, ariaLabel }: OrderProgressTrackerProps) {
  if (statusCode === CANCELLED_STATUS_CODE) {
    return (
      <div role="status" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
        <span className="font-semibold">{statusLabel}.</span> No further steps apply.
      </div>
    );
  }

  return (
    <ol aria-label={ariaLabel} className="flex rounded-lg border border-stone-200 bg-white px-2 pb-3 pt-4 overflow-x-auto modal-scrollbar">
      {steps.map((step, idx) => (
        <li
          key={step.code}
          aria-current={step.state === 'current' ? 'step' : undefined}
          className="relative min-w-24 flex-1 text-center"
        >
          {idx < steps.length - 1 && (
            <span
              aria-hidden="true"
              className={cn('absolute left-1/2 top-2.5 h-0.5 w-full', step.state === 'done' ? 'bg-lime-800' : 'bg-stone-200')}
            />
          )}
          <span
            className={cn(
              'relative z-10 mx-auto mb-1.5 flex size-5 items-center justify-center rounded-full border-2 bg-white',
              step.state === 'upcoming' ? 'border-stone-300' : 'border-lime-800',
              step.state === 'done' && 'bg-lime-800 text-white',
            )}
          >
            {step.state === 'done' && <Check className="size-3" aria-hidden="true" />}
            {step.state === 'current' && <span className="size-2 rounded-full bg-lime-800" />}
          </span>
          <span className={cn('block text-2xs leading-tight', step.state === 'upcoming' ? 'text-stone-500' : 'font-semibold text-stone-900')}>
            {step.label}
            {step.state === 'done' && <span className="sr-only"> (completed)</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}
