import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { lifecycleSteps } from '@/lib/unitConsumption';
import type { InventoryUnit } from '@/types/inventory';

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString();
}

// A unit's life so far, oldest first: how it arrived, whether a job held it, what
// became of it, and — as the last, highlighted step — where it is now.
export function UnitLifecycle({ unit }: { unit: InventoryUnit }) {
  const navigate = useNavigate();
  const steps = lifecycleSteps(unit);

  return (
    <ol aria-label="Lifecycle" className="relative ml-2 space-y-5 border-l border-stone-200 pl-6">
      {steps.map((step) => {
        const link = step.link;
        return (
          <li key={step.key} className="relative" aria-current={step.current ? 'step' : undefined}>
            <span
              aria-hidden="true"
              className={cn(
                'absolute -left-[31px] top-1 size-3 rounded-full border-2 border-white ring-1',
                step.current ? 'bg-emerald-500 ring-emerald-500' : 'bg-stone-300 ring-stone-300',
              )}
            />
            <p className="text-sm font-semibold text-stone-900">
              {step.title}
              {link && (
                <>
                  {' '}
                  <button
                    type="button"
                    onClick={() => navigate(link.to)}
                    aria-label={`Open ${link.label}`}
                    className="font-semibold text-stone-900 underline decoration-stone-300 underline-offset-2 hover:text-accent-foreground hover:decoration-current transition-colors"
                  >
                    {link.label}
                  </button>
                </>
              )}
            </p>
            {step.detail && <p className="text-xs text-stone-600">{step.detail}</p>}
            {step.at && <p className="text-2xs text-stone-400">{fmtDateTime(step.at)}</p>}
          </li>
        );
      })}
    </ol>
  );
}
