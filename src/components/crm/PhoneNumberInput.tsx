import { useMemo, useState } from 'react';
import { getCountries, getCountryCallingCode, type CountryCode } from 'libphonenumber-js';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { applyCountryCode, stripCountryCode } from './formUtils';

interface DialCode {
  iso: CountryCode;
  code: string;
  name: string;
  flag: string;
}

// Regional-indicator trick: each ISO 3166-1 alpha-2 letter maps to a Unicode
// regional-indicator symbol; the pair renders as that country's flag emoji
// in every OS/browser that supports emoji flags — no image assets needed.
function flagEmoji(iso: string): string {
  return String.fromCodePoint(...[...iso.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

const countryName = new Intl.DisplayNames(['en'], { type: 'region' });

// Real ISO country list + calling codes from libphonenumber-js (min metadata
// — plenty for a code picker, no need for its full validation tables), so
// this never needs manual upkeep as countries/codes change.
const DIAL_CODES: DialCode[] = getCountries()
  .map((iso) => ({
    iso,
    code: `+${getCountryCallingCode(iso)}`,
    name: countryName.of(iso) ?? iso,
    flag: flagEmoji(iso),
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

const DEFAULT_DIAL_CODE = DIAL_CODES.find((d) => d.iso === 'US') ?? DIAL_CODES[0];

// Small compound control: a searchable country-code popover (matching the
// app's DatePicker trigger+Popover pattern) glued to the left edge of the
// existing phone <input> so the two read as one field. Stays a drop-in for
// every call site's own value/onChange (className carries the caller's own
// fieldCls/fieldErrorCls) rather than a new form-state shape — see
// applyCountryCode for the merge rule that keeps edits of already-coded or
// legacy values from doubling up.
export function PhoneNumberInput({
  value, onChange, className, disabled, ...inputProps
}: {
  value: string;
  onChange: (next: string) => void;
  className?: string;
  disabled?: boolean;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'disabled'>) {
  const [selected, setSelected] = useState<DialCode>(DEFAULT_DIAL_CODE);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return DIAL_CODES;
    return DIAL_CODES.filter((d) => d.name.toLowerCase().includes(q) || d.code.includes(q));
  }, [query]);

  // The code lives in the trigger only — strip it back off `value` for
  // display so it isn't shown a second time inside the text box.
  const displayValue = stripCountryCode(selected.code, value);

  return (
    <div className="flex items-stretch">
      <Popover open={open} onOpenChange={(next) => { if (!disabled) { setOpen(next); if (!next) setQuery(''); } }}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            aria-label={`Country code: ${selected.name} ${selected.code}`}
            className={cn(
              'flex shrink-0 items-center gap-0.5 whitespace-nowrap rounded-l-[10px] rounded-r-none border border-r-0 border-stone-300 bg-stone-50 px-2 text-xs font-medium text-stone-600 outline-none transition-colors',
              'hover:bg-stone-100 focus-visible:z-10 focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/30',
              'disabled:cursor-not-allowed disabled:opacity-50',
            )}
          >
            <span>{selected.code}</span>
            <ChevronDown className="size-3 text-stone-400" aria-hidden="true" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 p-0">
          <div className="border-b border-stone-100 p-2">
            <input
              type="text"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search country or code…"
              aria-label="Search country"
              className="w-full rounded-lg border border-stone-200 px-2.5 py-1.5 text-xs text-stone-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
            />
          </div>
          <div role="listbox" aria-label="Country codes" className="max-h-60 overflow-y-auto p-1">
            {filtered.length === 0 && (
              <p className="px-2.5 py-2 text-xs text-stone-400">No matches</p>
            )}
            {filtered.map((d) => (
              <button
                key={d.iso}
                type="button"
                role="option"
                aria-selected={d.iso === selected.iso}
                onClick={() => {
                  setSelected(d);
                  onChange(applyCountryCode(d.code, displayValue));
                  setOpen(false);
                  setQuery('');
                }}
                className={cn(
                  'flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs text-stone-700 outline-none transition-colors hover:bg-stone-100 focus-visible:bg-stone-100',
                  d.iso === selected.iso && 'bg-brand/10 font-medium text-stone-900',
                )}
              >
                <span className="text-sm leading-none" aria-hidden="true">{d.flag}</span>
                <span className="flex-1 truncate">{d.name}</span>
                <span className="text-stone-400">{d.code}</span>
                {d.iso === selected.iso && <Check className="size-3.5 shrink-0 text-brand-dark" aria-hidden="true" />}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
      <input
        type="tel"
        value={displayValue}
        disabled={disabled}
        onChange={(e) => onChange(applyCountryCode(selected.code, e.target.value))}
        className={cn(className, 'rounded-l-none')}
        {...inputProps}
      />
    </div>
  );
}
