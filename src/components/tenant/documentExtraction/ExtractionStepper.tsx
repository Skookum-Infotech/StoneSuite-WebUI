import * as React from 'react';
import { AlertCircle, Check, Circle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  STEP_ORDER,
  stepStatuses,
  type ExtractionState,
  type StepKey,
  type StepStatus,
} from '@/lib/documentExtractionMachine';

const STEP_LABEL: Record<StepKey, string> = {
  upload: 'Upload',
  read: 'Read',
  match: 'Match',
  review: 'Review',
};

const STATUS_TEXT: Record<StepStatus, string> = {
  complete: 'Done',
  current: 'In progress',
  pending: 'Waiting',
  error: 'Failed',
};

const STATUS_STYLE: Record<StepStatus, string> = {
  complete: 'bg-accent text-accent-foreground ring-accent-foreground/20',
  current: 'bg-brand text-stone-950 ring-brand-dark/30',
  pending: 'bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400 ring-stone-200 dark:ring-stone-700',
  error: 'bg-destructive/10 text-destructive ring-destructive/30',
};

function StepIcon({ status }: { status: StepStatus }): React.JSX.Element {
  if (status === 'complete') return <Check className="size-3.5" aria-hidden="true" />;
  if (status === 'error') return <AlertCircle className="size-3.5" aria-hidden="true" />;
  if (status === 'current') return <Loader2 className="size-3.5 motion-safe:animate-spin" aria-hidden="true" />;
  return <Circle className="size-3.5" aria-hidden="true" />;
}

interface ExtractionStepperProps {
  stage: ExtractionState['stage'];
  failedAt: ExtractionState['failedAt'];
}

/** Upload -> Read -> Match -> Review progress. Every step pairs an icon with a
 *  text status, so state never relies on colour alone; a polite live region
 *  announces the current step to screen readers. */
export function ExtractionStepper({ stage, failedAt }: ExtractionStepperProps): React.JSX.Element {
  const statuses = stepStatuses({ stage, failedAt });
  const active = STEP_ORDER.find((k) => statuses[k] === 'current' || statuses[k] === 'error');
  const announcement = active
    ? `Step ${STEP_ORDER.indexOf(active) + 1} of ${STEP_ORDER.length}: ${STEP_LABEL[active]}, ${STATUS_TEXT[statuses[active]].toLowerCase()}`
    : '';

  return (
    <div>
      <ol role="list" aria-label="Document progress" className="flex items-start gap-1">
        {STEP_ORDER.map((key, i) => {
          const status = statuses[key];
          return (
            <li
              key={key}
              aria-current={status === 'current' ? 'step' : undefined}
              className="flex min-w-0 flex-1 flex-col items-center gap-1 text-center"
            >
              <div className="flex w-full items-center">
                <span
                  aria-hidden="true"
                  className={cn('h-px flex-1', i === 0 ? 'bg-transparent' : 'bg-stone-200 dark:bg-stone-700')}
                />
                <span className={cn('flex size-6 shrink-0 items-center justify-center rounded-full ring-1 transition-colors', STATUS_STYLE[status])}>
                  <StepIcon status={status} />
                </span>
                <span
                  aria-hidden="true"
                  className={cn('h-px flex-1', i === STEP_ORDER.length - 1 ? 'bg-transparent' : 'bg-stone-200 dark:bg-stone-700')}
                />
              </div>
              <span className="text-xs font-semibold text-stone-900 dark:text-stone-100">{STEP_LABEL[key]}</span>
              <span className="text-[11px] text-stone-500 dark:text-stone-400">{STATUS_TEXT[status]}</span>
            </li>
          );
        })}
      </ol>
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}
