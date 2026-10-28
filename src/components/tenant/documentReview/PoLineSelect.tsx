import { Select } from '@/components/ui/select';
import * as React from 'react';
import type { PoLineChoice } from '@/hooks/documentReviewView';

interface PoLineSelectProps {
  /** The bill line's label, e.g. "Line 2", for the accessible name. */
  label: string;
  choices: PoLineChoice[];
  /** The chosen purchase-order line id, or '' for none. */
  value: string;
  onChange: (poItemId: string) => void;
}

/** Picks which purchase-order line a vendor-bill line is billed against, when
 *  more than one fits (the same item twice on the order). */
export function PoLineSelect({ label, choices, value, onChange }: PoLineSelectProps): React.JSX.Element {
  return (
    <label className="flex flex-wrap items-center gap-1.5 text-stone-600 dark:text-stone-300">
      <span>Purchase order line</span>
      <Select
        value={value}
        aria-label={`Purchase order line for ${label}`}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 px-1.5 py-0.5 text-xs text-stone-800 dark:text-stone-200"
      >
        <option value="">Not linked</option>
        {choices.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
      </Select>
    </label>
  );
}
