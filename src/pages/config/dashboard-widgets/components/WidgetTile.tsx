import { Check, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WidgetDefinition } from '@/types/dashboardWidgets';

export function WidgetTile({
  widget,
  checked,
  onToggle,
  disabled = false,
}: {
  widget: WidgetDefinition;
  checked: boolean;
  onToggle: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => onToggle(!checked)}
      disabled={disabled}
      aria-pressed={checked}
      aria-label={`${checked ? 'Remove' : 'Add'} ${widget.title}`}
      title={widget.description}
      className={cn(
        'flex w-full items-start justify-between gap-2 rounded-lg border px-3 py-2.5 text-left transition-colors',
        checked
          ? 'border-brand/40 bg-brand/10'
          : 'border-dashed border-stone-300 hover:border-brand-dark/50 hover:bg-stone-50',
        disabled && 'pointer-events-none opacity-70',
      )}
    >
      <div className="min-w-0">
        <p className={cn('truncate text-xs font-semibold', checked ? 'text-brand-dark' : 'text-stone-700')}>
          {widget.title}
        </p>
        <p className="truncate text-2xs text-stone-500">{widget.description}</p>
      </div>
      {checked ? (
        <Check className="mt-0.5 size-3.5 shrink-0 text-brand-dark" aria-hidden="true" />
      ) : (
        <Plus className="mt-0.5 size-3.5 shrink-0 text-stone-400" aria-hidden="true" />
      )}
    </button>
  );
}
