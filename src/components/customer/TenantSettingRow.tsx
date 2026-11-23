import { useId } from 'react';
import { Loader2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';

export interface TenantSettingRowProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  /** Saving, or not changeable for this customer; `note` says why when set. */
  state?: { saving?: boolean; disabled?: boolean; note?: string };
}

/**
 * One on/off feature control on a customer's Settings tab. Every per-customer
 * feature switch (single session today; AI, anomaly checks, ... later) is one
 * of these rows, so the tab grows by adding rows, not layouts.
 */
export function TenantSettingRow({ label, description, checked, onChange, state }: TenantSettingRowProps) {
  const labelId = useId();
  const descId = useId();
  const saving = state?.saving ?? false;
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3.5">
      <div className="min-w-0">
        <p id={labelId} className="text-sm font-semibold text-stone-900">{label}</p>
        <p id={descId} className="mt-0.5 text-xs text-stone-500">{description}</p>
        {state?.note && <p className="mt-1 text-xs font-medium text-stone-600">{state.note}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2 pt-0.5">
        {saving && <Loader2 className="size-3.5 animate-spin text-stone-400" aria-hidden="true" />}
        <Switch
          checked={checked}
          onCheckedChange={onChange}
          disabled={saving || state?.disabled}
          aria-labelledby={labelId}
          aria-describedby={descId}
          aria-label={label}
        />
      </div>
    </div>
  );
}
