import { useId } from 'react';
import { Input } from '@/components/ui/input';

export interface TenantNumberSettingRowProps {
  label: string;
  description: string;
  /** The text in the box (kept as typed so a half-edited value is not lost). */
  value: string;
  onChange: (next: string) => void;
  /** Unit shown after the box, e.g. "minutes"; and a validation error, if any. */
  extra: { unit?: string; error?: string | null; max: number };
}

/**
 * One number-valued feature control on a customer's Settings tab — the
 * counterpart of TenantSettingRow. The caller owns saving (one Save button can
 * cover several rows).
 */
export function TenantNumberSettingRow({ label, description, value, onChange, extra }: TenantNumberSettingRowProps) {
  const inputId = useId();
  const descId = useId();
  const errorId = useId();
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3.5">
      <div className="min-w-0">
        <label htmlFor={inputId} className="text-sm font-semibold text-stone-900">
          {label}
        </label>
        <p id={descId} className="mt-0.5 text-xs text-stone-500">{description}</p>
        {extra.error && (
          <p id={errorId} role="alert" className="mt-1 text-xs font-medium text-destructive">{extra.error}</p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2 pt-0.5">
        <Input
          id={inputId}
          type="number"
          inputMode="numeric"
          min={0}
          max={extra.max}
          step={1}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-describedby={extra.error ? `${descId} ${errorId}` : descId}
          aria-invalid={Boolean(extra.error)}
          className="h-8 w-20 text-right text-sm"
        />
        {extra.unit && <span className="w-14 text-xs text-stone-500">{extra.unit}</span>}
      </div>
    </div>
  );
}
