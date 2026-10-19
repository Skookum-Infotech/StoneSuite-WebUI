import { Check, Plus } from 'lucide-react';
import { AREA_KINDS } from '@/lib/createdOrderAreas';
import { MAX_AREAS } from '@/lib/createdOrderForm';
import type { AreaDraft } from '@/lib/createdOrderForm';
import { cn } from '@/lib/utils';
import type { AreaKind } from '@/types/createdOrder';

interface AreaPickerProps {
  areas: readonly AreaDraft[];
  onAdd: (kind: AreaKind) => void;
}

// "Which parts of the house is this order for?" — one chip per area type. A
// customer taps the ones they need and a card appears for each, so nothing is
// shown that they do not use. Single-use areas turn into a tick once added;
// Bath and Custom area can be added again for each one.
export function AreaPicker({ areas, onAdd }: AreaPickerProps) {
  const limitReached = areas.length >= MAX_AREAS;

  return (
    <div>
      <div role="group" aria-label="Add an area to this order" className="flex flex-wrap gap-2">
        {AREA_KINDS.map(({ kind, label, repeatable }) => {
          const count = areas.filter((area) => area.kind === kind).length;
          const added = count > 0 && !repeatable;
          const disabled = added || limitReached;
          return (
            <button
              key={kind}
              type="button"
              disabled={disabled}
              aria-label={added ? `${label} already added` : `Add ${label}`}
              onClick={() => onAdd(kind)}
              className={cn(
                'inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-xs font-semibold outline-none transition-all',
                'focus-visible:ring-2 focus-visible:ring-brand/40',
                added
                  ? 'border-brand/50 bg-brand/15 text-stone-700'
                  : 'border-stone-300 bg-white text-stone-700 hover:border-brand hover:bg-brand/10 active:scale-95',
                limitReached && !added && 'cursor-not-allowed opacity-50 hover:border-stone-300 hover:bg-white',
              )}
            >
              {added ? (
                <Check className="size-3.5 text-brand-dark" aria-hidden="true" />
              ) : (
                <Plus className="size-3.5" aria-hidden="true" />
              )}
              {label}
              {repeatable && count > 0 && <span className="text-stone-400">×{count}</span>}
            </button>
          );
        })}
      </div>
      {limitReached && (
        <p className="mt-2 text-xs text-stone-500">
          An order can have up to {MAX_AREAS} areas. Remove one to add another.
        </p>
      )}
    </div>
  );
}
