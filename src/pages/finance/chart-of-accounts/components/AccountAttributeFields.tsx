import { attrFieldsFor, BANK_ACCOUNT_NUMBER_KEY } from '@/lib/coaAttributes';
import { fieldCls, fieldLabelCls } from '@/components/crm/formUtils';
import { cn } from '@/lib/utils';
import type { AccountType } from '@/types/chartOfAccounts';

// Renders the fixed, per-type attribute fields (chartofaccounts.attrSchema).
// general/ar/ap/inventory render nothing. The bank account number field is
// write-only: it is never prefilled from a loaded account (the server never
// returns it), and a blank value on edit means "leave unchanged," not
// "clear" — clearing requires an explicit request, which this form does not
// offer (there is no legitimate reason to blank out a bank account's number).
export function AccountAttributeFields({
  type,
  value,
  onChange,
  currentLast4,
  showErrors,
}: {
  type: AccountType;
  value: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
  /** The masked last-4 hint from the currently-saved account (bank accounts
   *  only). Display-only — there is no unmask affordance. */
  currentLast4?: string;
  showErrors?: boolean;
}) {
  const fields = attrFieldsFor(type);
  if (fields.length === 0) return null;

  function set(key: string, v: string) {
    onChange({ ...value, [key]: v });
  }

  return (
    <div className="space-y-4">
      {fields.map((f) => {
        const isBankNumber = f.key === BANK_ACCOUNT_NUMBER_KEY;
        const missing = showErrors && f.required && !(value[f.key] ?? '').trim();
        return (
          <div key={f.key} className="space-y-1.5">
            <label className={fieldLabelCls} htmlFor={`coa-attr-${f.key}`}>
              {f.label}
              {f.required && <span className="ml-0.5 text-destructive">*</span>}
            </label>
            <input
              id={`coa-attr-${f.key}`}
              type="text"
              value={value[f.key] ?? ''}
              onChange={(e) => set(f.key, e.target.value)}
              placeholder={isBankNumber && currentLast4 ? `On file, ending •••• ${currentLast4} — enter to replace` : undefined}
              className={cn(fieldCls, missing && 'border-red-400 focus:border-red-500 focus:ring-red-200')}
              aria-label={f.label}
              aria-required={f.required}
              aria-invalid={missing || undefined}
              aria-describedby={missing ? `coa-attr-${f.key}-error` : undefined}
            />
            {isBankNumber && currentLast4 && (
              <p className="text-2xs text-stone-400">
                Currently on file, ending •••• {currentLast4}. Leave blank to keep it unchanged.
              </p>
            )}
            {missing && (
              <p id={`coa-attr-${f.key}-error`} className="text-2xs text-destructive">{f.label} is required.</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
