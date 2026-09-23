import { useMemo, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { SelectOption } from '@/lib/companyInfoLookupOptions';

// Searchable Popover-trigger picker over real lookup-table data (Country,
// Currency) for the onboarding form -- matching PhoneNumberInput/DatePicker's
// trigger+Popover pattern rather than a bare native <select>, per
// feedback_prefer_real_data_and_app_patterns. `options` is expected to
// already include the current value as its own entry when it doesn't match
// a lookup row (see lib/companyInfoLookupOptions.ts's withCurrentValue) --
// this component only falls back to the raw value so it never goes missing
// from the trigger if a caller doesn't provide that.
export function OnboardingSelectField({
  label, value, onChange, options, placeholder, className,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  options: SelectOption[];
  placeholder: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [query, options]);

  const selected = options.find((o) => o.value === value);
  const displayText = selected?.label ?? (value || placeholder);

  return (
    <Popover open={open} onOpenChange={(next) => { setOpen(next); if (!next) setQuery(''); }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${label}: ${displayText}`}
          className={cn(
            'flex w-full items-center justify-between gap-2 text-left outline-none transition',
            !selected && 'text-stone-400',
            className,
          )}
        >
          <span className="truncate">{displayText}</span>
          <ChevronDown className="size-3.5 shrink-0 text-stone-400" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0">
        <div className="border-b border-stone-100 p-2">
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search…"
            aria-label={`Search ${label.toLowerCase()}`}
            className="w-full rounded-lg border border-stone-200 px-2.5 py-1.5 text-xs text-stone-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
          />
        </div>
        <div role="listbox" aria-label={label} className="max-h-60 overflow-y-auto p-1">
          {filtered.length === 0 && (
            <p className="px-2.5 py-2 text-xs text-stone-400">No matches</p>
          )}
          {filtered.map((o) => (
            <button
              key={o.value}
              type="button"
              role="option"
              aria-selected={o.value === value}
              onClick={() => { onChange(o.value); setOpen(false); setQuery(''); }}
              className={cn(
                'flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-xs text-stone-700 outline-none transition-colors hover:bg-stone-100 focus-visible:bg-stone-100',
                o.value === value && 'bg-brand/10 font-medium text-stone-900',
              )}
            >
              <span className="truncate">{o.label}</span>
              {o.value === value && <Check className="size-3.5 shrink-0 text-brand-dark" aria-hidden="true" />}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
