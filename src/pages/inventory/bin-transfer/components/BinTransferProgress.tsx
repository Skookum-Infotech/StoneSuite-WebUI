import { Check, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { btProgress, type BtStepState } from '@/lib/binTransferStatus';

const DOT: Record<BtStepState, string> = {
  done: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
  current: 'bg-amber-100 text-amber-700 ring-amber-300',
  upcoming: 'bg-white text-stone-500 ring-stone-200',
};

const LABEL: Record<BtStepState, string> = {
  done: 'text-stone-500',
  current: 'font-semibold text-stone-900',
  upcoming: 'text-stone-500',
};

// Where a transfer is on its way: Draft → Pending Approval → Approved →
// Completed. A cancelled transfer is shown stopped rather than part-way along.
export function BinTransferProgress({ statusCode }: { statusCode: string }) {
  const { steps, cancelled } = btProgress(statusCode);

  return (
    <nav aria-label="Transfer progress" className="border-b border-stone-200 bg-white px-5 py-3 3xl:px-12 4xl:px-16">
      <ol className="flex items-center">
        {steps.map((step, i) => (
          <li
            key={step.code}
            aria-current={step.state === 'current' ? 'step' : undefined}
            className={cn('flex items-center gap-2', i < steps.length - 1 && 'flex-1')}
          >
            <span className={cn('flex size-6 shrink-0 items-center justify-center rounded-full text-2xs font-semibold ring-1', DOT[step.state])}>
              {step.state === 'done' ? <Check className="size-3.5" aria-hidden="true" /> : i + 1}
            </span>
            <span className={cn('whitespace-nowrap text-xs', LABEL[step.state], cancelled && 'text-stone-500')}>
              {step.label}
              <span className="sr-only">{step.state === 'done' ? ' (done)' : step.state === 'current' ? ' (current)' : ''}</span>
            </span>
            {i < steps.length - 1 && (
              <span
                aria-hidden="true"
                className={cn('mx-1 h-px min-w-4 flex-1', step.state === 'done' ? 'bg-emerald-300' : 'bg-stone-200')}
              />
            )}
          </li>
        ))}
      </ol>
      {cancelled && (
        <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-stone-500">
          <XCircle className="size-3.5" aria-hidden="true" /> This transfer was cancelled.
        </p>
      )}
    </nav>
  );
}
