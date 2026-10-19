import { FAUCET_SPREAD_OPTIONS } from '@/lib/createdOrderAreas';
import type { FaucetSpreadScale } from '@/lib/createdOrderAreas';
import { cn } from '@/lib/utils';
import type { FaucetSpreadPosition } from '@/types/createdOrder';

interface FaucetSpreadSelectorProps {
  areaName: string;
  scale: FaucetSpreadScale;
  value: readonly FaucetSpreadPosition[];
  onChange: (next: FaucetSpreadPosition[]) => void;
}

const SIDE_NAMES: Record<string, string> = { L: 'left', R: 'right' };

/** "8 inches left of centre", "centre" — what a chip means, for screen readers. */
function positionName(position: FaucetSpreadPosition): string {
  if (position === 'C') return 'centre';
  return `${position.slice(1)} inches ${SIDE_NAMES[position[0]]} of centre`;
}

// The printed form's Faucet Spread row, as toggle chips laid out in the same
// left-to-right order so the customer recognises it. The paper form has a tick
// box under each position and some orders tick more than one (a double-bowl
// vanity), so every chip toggles independently.
export function FaucetSpreadSelector({ areaName, scale, value, onChange }: FaucetSpreadSelectorProps) {
  const options = FAUCET_SPREAD_OPTIONS[scale];

  const toggle = (position: FaucetSpreadPosition): void => {
    onChange(value.includes(position) ? value.filter((p) => p !== position) : [...value, position]);
  };

  return (
    <div
      role="group"
      aria-label={`Faucet spread for ${areaName}`}
      className="flex flex-wrap items-center gap-1.5"
    >
      {options.map((option) => {
        const selected = value.includes(option.value);
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            aria-label={`${positionName(option.value)}${selected ? ', selected' : ''}`}
            onClick={() => toggle(option.value)}
            className={cn(
              'h-9 min-w-11 rounded-lg border px-2.5 text-xs font-semibold outline-none transition-all',
              'focus-visible:ring-2 focus-visible:ring-brand/40',
              option.value === 'C' && 'min-w-12',
              selected
                ? 'border-brand bg-brand text-stone-950 shadow-sm'
                : 'border-stone-300 bg-white text-stone-600 hover:border-stone-400 hover:bg-stone-50',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
