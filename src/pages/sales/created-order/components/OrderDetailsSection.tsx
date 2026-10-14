import { useCallback } from 'react';
import { PhoneNumberInput } from '@/components/crm/PhoneNumberInput';
import { fieldCls, fieldErrorCls, textareaCls } from '@/components/crm/formUtils';
import { DatePicker } from '@/components/ui/date-picker';
import {
  ADDRESS_MAX_LENGTH,
  HEADER_FIELD_LABELS,
  INSTRUCTIONS_MAX_LENGTH,
  NAME_MAX_LENGTH,
  ZIP_MAX_LENGTH,
} from '@/lib/createdOrderForm';
import type { CreatedOrderErrors, CreatedOrderFormState, HeaderField } from '@/lib/createdOrderForm';
import { Field } from './Field';

interface OrderDetailsSectionProps {
  form: CreatedOrderFormState;
  errors: CreatedOrderErrors['header'];
  onChange: (field: HeaderField, value: string) => void;
}

const SPECIAL_INSTRUCTIONS_ROWS = 3;

// Step 1 — everything that describes the job as a whole, grouped the way a
// customer thinks about it: who and where, how to reach them, and when.
export function OrderDetailsSection({ form, errors, onChange }: OrderDetailsSectionProps) {
  const cls = (field: HeaderField): string => (errors[field] ? fieldErrorCls : fieldCls);
  const setPhone = useCallback((next: string) => onChange('phone', next), [onChange]);

  const text = (field: HeaderField, required: boolean, placeholder: string, maxLength = NAME_MAX_LENGTH) => (
    <Field label={HEADER_FIELD_LABELS[field]} required={required} error={errors[field]}>
      {(control) => (
        <input
          {...control}
          type="text"
          value={form[field]}
          maxLength={maxLength}
          placeholder={placeholder}
          onChange={(e) => onChange(field, e.target.value)}
          className={cls(field)}
        />
      )}
    </Field>
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        {text('builder', true, 'e.g. Highland Homes')}
        {text('community', true, 'e.g. Sandbrock Ranch')}
        {text('plan', false, 'e.g. 214')}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={HEADER_FIELD_LABELS.phone} required error={errors.phone}>
          {(control) => (
            <PhoneNumberInput
              {...control}
              value={form.phone}
              onChange={setPhone}
              placeholder="Phone number"
              className={cls('phone')}
            />
          )}
        </Field>
        <Field label={HEADER_FIELD_LABELS.email} required error={errors.email}>
          {(control) => (
            <input
              {...control}
              type="email"
              value={form.email}
              maxLength={ADDRESS_MAX_LENGTH}
              placeholder="name@company.com"
              onChange={(e) => onChange('email', e.target.value)}
              className={cls('email')}
            />
          )}
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-6">
        <div className="sm:col-span-6">
          {text('installAddress', true, 'Street address of the job', ADDRESS_MAX_LENGTH)}
        </div>
        <div className="sm:col-span-4">{text('city', true, 'City')}</div>
        <div className="sm:col-span-2">{text('zip', true, 'ZIP / postal code', ZIP_MAX_LENGTH)}</div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={HEADER_FIELD_LABELS.measureDate} required error={errors.measureDate} selfLabelled>
          {() => (
            <DatePicker
              value={form.measureDate}
              onChange={(iso) => onChange('measureDate', iso)}
              label={HEADER_FIELD_LABELS.measureDate}
              required
            />
          )}
        </Field>
        <Field label={HEADER_FIELD_LABELS.installDate} required error={errors.installDate} selfLabelled>
          {() => (
            <DatePicker
              value={form.installDate}
              onChange={(iso) => onChange('installDate', iso)}
              label={HEADER_FIELD_LABELS.installDate}
              required
              minDate={form.measureDate || undefined}
            />
          )}
        </Field>
      </div>

      <Field label={HEADER_FIELD_LABELS.specialInstructions} error={errors.specialInstructions}>
        {(control) => (
          <textarea
            {...control}
            rows={SPECIAL_INSTRUCTIONS_ROWS}
            value={form.specialInstructions}
            maxLength={INSTRUCTIONS_MAX_LENGTH}
            placeholder="Anything the fabricator should know about the whole job. Use each area's notes for area-specific details."
            onChange={(e) => onChange('specialInstructions', e.target.value)}
            className={textareaCls}
          />
        )}
      </Field>
    </div>
  );
}
