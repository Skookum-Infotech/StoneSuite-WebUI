import { fieldCls } from '@/components/crm/formUtils';
import type { Bin } from '@/types/inventory';
import { cn } from '@/lib/utils';

interface FlatBin {
  id: string;
  path: string;
  depth: number;
  unitCount: number;
  overCapacity: boolean;
}

function flatten(bins: Bin[], out: FlatBin[] = []): FlatBin[] {
  for (const b of bins) {
    out.push({ id: b.id, path: b.path || b.name, depth: b.depth, unitCount: b.unitCount, overCapacity: b.overCapacity });
    if (b.children?.length) flatten(b.children, out);
  }
  return out;
}

// Bin <select> built from the tree endpoint's nested shape, flattened and
// indented by depth (max 4) so the path reads as a breadcrumb. Capacity is
// shown as a plain suffix — advisory only, never disables an option: a yard
// crew that already placed a slab cannot be blocked by a row count.
export function BinPicker({
  bins, value, onChange, label = 'Bin', required, allowEmpty = true, emptyLabel = '— No bin —',
}: {
  bins: Bin[];
  value: string;
  onChange: (uuid: string) => void;
  label?: string;
  required?: boolean;
  allowEmpty?: boolean;
  emptyLabel?: string;
}) {
  const flat = flatten(bins);
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={required}
      aria-label={label}
      className={cn(fieldCls)}
    >
      {allowEmpty && <option value="">{emptyLabel}</option>}
      {!allowEmpty && <option value="">— Select {label} —</option>}
      {flat.map((b) => (
        <option key={b.id} value={b.id}>
          {'  '.repeat(Math.max(0, b.depth - 1))}{b.path}
          {b.unitCount > 0 ? ` (${b.unitCount}${b.overCapacity ? ' · over capacity' : ''})` : ''}
        </option>
      ))}
    </select>
  );
}
