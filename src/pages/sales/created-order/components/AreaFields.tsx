import { fieldCls, fieldErrorCls } from '@/components/crm/formUtils';
import { Switch } from '@/components/ui/switch';
import { AREA_FIELD_LABELS as FIELD_LABELS, areaKindConfig } from '@/lib/createdOrderAreas';
import type { AreaFieldKey } from '@/lib/createdOrderAreas';
import {
  AREA_NAME_MAX_LENGTH,
  BACKSPLASH_HEIGHT_STEP,
  MAX_BACKSPLASH_HEIGHT_IN,
  NAME_MAX_LENGTH,
} from '@/lib/createdOrderForm';
import type { AreaDraft, AreaErrorField, AreaFieldChange } from '@/lib/createdOrderForm';
import { Field } from './Field';
import { QuantityStepper } from './QuantityStepper';

interface AreaFieldsProps {
  area: AreaDraft;
  errors: Partial<Record<AreaErrorField, string>>;
  onChange: AreaFieldChange;
}

type TextFieldKey = 'color' | 'finish' | 'edge' | 'sinkModel' | 'cooktopModel' | 'location';

const TEXT_PLACEHOLDERS: Record<TextFieldKey, string> = {
  color: 'e.g. Serene',
  finish: 'e.g. Polished',
  edge: 'e.g. Flat',
  sinkModel: 'Model or description',
  cooktopModel: 'Model number',
  location: 'e.g. Window sill',
};

// Fields that sit in the three-up row of inputs, versus the toggles and
// steppers that get their own compact row underneath.
const COUNTER_FIELDS: readonly AreaFieldKey[] = ['waterfallQty', 'popUpOutlet', 'halfWall'];

// The inputs one area shows — driven entirely by the area catalog, so Kitchen
// gets a Cooktop Model, a Master Bath a Half Wall switch, and so on, without
// this component knowing about any kind by name.
export function AreaFields({ area, errors, onChange }: AreaFieldsProps) {
  const { fields, repeatable } = areaKindConfig(area.kind);
  const inputFields = fields.filter((field) => !COUNTER_FIELDS.includes(field));
  const counterFields = fields.filter((field) => COUNTER_FIELDS.includes(field));

  const renderInput = (field: AreaFieldKey) => {
    if (field === 'backsplashHeight') {
      return (
        <Field key={field} label={FIELD_LABELS[field]} error={errors.backsplashHeight}>
          {(control) => (
            <div className="relative">
              <input
                {...control}
                type="number"
                inputMode="decimal"
                min={0}
                max={MAX_BACKSPLASH_HEIGHT_IN}
                step={BACKSPLASH_HEIGHT_STEP}
                value={area.backsplashHeight}
                placeholder="0"
                onChange={(e) => onChange('backsplashHeight', e.target.value)}
                className={`${errors.backsplashHeight ? fieldErrorCls : fieldCls} pr-9`}
              />
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-stone-500"
              >
                in
              </span>
            </div>
          )}
        </Field>
      );
    }

    const key = field as TextFieldKey;
    const error = key === 'color' ? errors.color : undefined;
    return (
      <Field key={field} label={FIELD_LABELS[field]} required={key === 'color'} error={error}>
        {(control) => (
          <input
            {...control}
            type="text"
            value={area[key]}
            maxLength={NAME_MAX_LENGTH}
            placeholder={TEXT_PLACEHOLDERS[key]}
            onChange={(e) => onChange(key, e.target.value)}
            className={error ? fieldErrorCls : fieldCls}
          />
        )}
      </Field>
    );
  };

  const renderCounter = (field: AreaFieldKey) => {
    if (field === 'halfWall') {
      return (
        <Field key={field} label={FIELD_LABELS[field]}>
          {(control) => (
            <div className="flex h-10 items-center gap-2">
              <Switch
                id={control.id}
                checked={area.halfWall}
                onCheckedChange={(checked) => onChange('halfWall', checked)}
              />
              <span className="text-xs text-stone-600">{area.halfWall ? 'Yes' : 'No'}</span>
            </div>
          )}
        </Field>
      );
    }
    const key = field as 'waterfallQty' | 'popUpOutlet';
    return (
      <Field key={field} label={FIELD_LABELS[field]} selfLabelled>
        {() => (
          <QuantityStepper
            label={`${FIELD_LABELS[field]} for ${area.name}`}
            value={area[key]}
            onChange={(next) => onChange(key, next)}
          />
        )}
      </Field>
    );
  };

  return (
    <div className="space-y-4">
      {repeatable && (
        <Field label="Area name" required error={errors.name}>
          {(control) => (
            <input
              {...control}
              type="text"
              value={area.name}
              maxLength={AREA_NAME_MAX_LENGTH}
              placeholder="e.g. Bath 12"
              onChange={(e) => onChange('name', e.target.value)}
              className={errors.name ? fieldErrorCls : fieldCls}
            />
          )}
        </Field>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{inputFields.map(renderInput)}</div>
      {counterFields.length > 0 && (
        <div className="flex flex-wrap gap-x-8 gap-y-4">{counterFields.map(renderCounter)}</div>
      )}
    </div>
  );
}
