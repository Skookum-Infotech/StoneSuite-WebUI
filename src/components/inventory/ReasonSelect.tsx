import { LookupSelect } from './LookupSelect';
import type { LookupItem } from '@/types/inventory';

// `reasons` is load-bearing, not decorative — every adjustment line and
// count variance needs one. Thin, named wrapper over LookupSelect so every
// call site reads clearly as "the reason code", with inline add offered by
// default (writable vocabulary).
export function ReasonSelect({
  reasons, value, onChange, required = true, label = 'Reason',
}: {
  reasons: LookupItem[];
  value: string;
  onChange: (id: string) => void;
  required?: boolean;
  label?: string;
}) {
  return (
    <LookupSelect
      kind="reasons"
      items={reasons}
      value={value}
      onChange={onChange}
      label={label}
      required={required}
      allowInlineAdd
    />
  );
}
