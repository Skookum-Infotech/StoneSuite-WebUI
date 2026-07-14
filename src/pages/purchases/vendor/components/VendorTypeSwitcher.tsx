import { User, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { VendorType } from '@/types/vendor';

const OPTIONS: { value: VendorType; label: string; icon: typeof User; description: string }[] = [
  { value: 'Person', label: 'Person', icon: User, description: 'An individual supplier or contractor' },
  { value: 'Organization', label: 'Organization', icon: Building2, description: 'A registered business or company' },
];

// Prominent top-of-form switcher between the two vendor profile shapes —
// swapping it re-renders the Person/Organization-only sections below.
export function VendorTypeSwitcher({ value, onChange }: {
  value: VendorType;
  onChange: (type: VendorType) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Vendor Type"
      className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3"
    >
      {OPTIONS.map(({ value: optionValue, label, icon: Icon, description }) => {
        const active = value === optionValue;
        return (
          <button
            key={optionValue}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(optionValue)}
            className={cn(
              'flex items-center gap-3 rounded-[10px] border px-4 py-3 text-left transition-all',
              active
                ? 'border-brand bg-brand/10 ring-1 ring-brand/40'
                : 'border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50',
            )}
          >
            <div
              className={cn(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors',
                active ? 'bg-brand text-stone-900' : 'bg-stone-100 text-stone-500',
              )}
            >
              <Icon className="size-4" />
            </div>
            <div className="min-w-0">
              <p className={cn('text-sm font-semibold', active ? 'text-stone-900' : 'text-stone-700')}>
                {label}
              </p>
              <p className="text-2xs text-stone-400 truncate">{description}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
