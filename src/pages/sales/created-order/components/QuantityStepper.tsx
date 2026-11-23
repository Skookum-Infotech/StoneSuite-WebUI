import { Minus, Plus } from 'lucide-react';
import { MAX_QTY } from '@/lib/createdOrderForm';

interface QuantityStepperProps {
  /** The field's visible label — used to name the +/- buttons. */
  label: string;
  value: number;
  onChange: (next: number) => void;
}

const BUTTON_CLS =
  'flex size-10 shrink-0 items-center justify-center text-stone-600 outline-none transition-colors hover:bg-stone-100 focus-visible:bg-stone-100 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand/40 disabled:cursor-not-allowed disabled:text-stone-300 disabled:hover:bg-transparent';

// A whole-number stepper (0–MAX_QTY). Tapping +/- beats typing into a number
// box on a phone, and it cannot hold a fraction or a negative.
export function QuantityStepper({ label, value, onChange }: QuantityStepperProps) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex items-stretch overflow-hidden rounded-[10px] border border-stone-300 bg-white"
    >
      <button
        type="button"
        aria-label={`Decrease ${label}`}
        disabled={value <= 0}
        onClick={() => onChange(value - 1)}
        className={BUTTON_CLS}
      >
        <Minus className="size-3.5" aria-hidden="true" />
      </button>
      <output
        aria-live="polite"
        aria-label={`${label} quantity`}
        className="flex min-w-10 items-center justify-center border-x border-stone-200 px-2 text-sm font-semibold tabular-nums text-stone-900"
      >
        {value}
      </output>
      <button
        type="button"
        aria-label={`Increase ${label}`}
        disabled={value >= MAX_QTY}
        onClick={() => onChange(value + 1)}
        className={BUTTON_CLS}
      >
        <Plus className="size-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}
