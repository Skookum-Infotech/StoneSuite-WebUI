// The profile editor: opened by the pencil in the Profiles bar to change the
// picked attached-profile type, or by "Add new" to make another. Name, how it
// is priced, the rate, a short alias, the colour it is drawn in, the preset
// measurements it offers, the angle it stands at in 3D, and the finish of the
// corner where two painted sides meet. Save writes it to the shop's list (the
// server checks the name is not taken); Back closes without saving. Same
// hand-rolled useModalDialog + createPortal shape as EdgeTypeDialog.

import { useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Trash2, X } from 'lucide-react';
import { apiErrorMessage } from '@/api/tenantClient';
import { Select } from '@/components/ui/select';
import { useModalDialog } from '@/hooks/useModalDialog';
import type { AttachedProfileType, ProfilePricingType } from '@/types/drawing';
import {
  blankAttachedProfileTypeDraft, checkAttachedProfileTypeDraft, draftFromAttachedProfileType, MAX_PROFILE_ALIAS_LENGTH,
  MAX_PROFILE_MEASUREMENT_PRESETS, MAX_PROFILE_NAME_LENGTH, PROFILE_PRICING_TYPES, type AttachedProfileTypeDraft,
} from '@/lib/drawing/attachedProfileTypes';
import { ProfileAnglePicker } from './ProfileAnglePicker';
import { ProfileFinishPicker } from './ProfileFinishPicker';
import { useSaveAttachedProfileType } from './useAttachedProfileTypes';

const FIELD_CLASS = 'w-full rounded border border-stone-300 bg-white px-2 py-1.5 text-xs text-stone-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/30';
const COLOR_FIELD_CLASS = 'h-8 w-14 cursor-pointer rounded border border-stone-300 bg-white p-0.5';
const BUTTON_CLASS = 'rounded-lg px-4 py-1.5 text-xs font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand disabled:opacity-60';

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-stone-700">
      <span>{label}</span>
      {children}
    </label>
  );
}

function MeasurementsField({ presets, onChange }: { presets: string[]; onChange: (presets: string[]) => void }) {
  const setAt = (i: number, value: string) => onChange(presets.map((p, j) => (j === i ? value : p)));
  const removeAt = (i: number) => onChange(presets.filter((_, j) => j !== i));
  const add = () => onChange([...presets, '']);
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-stone-700">Measurements</span>
      <div className="flex flex-wrap items-center gap-2">
        {presets.map((value, i) => (
          <div key={i} className="flex items-center gap-1">
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              aria-label={`Measurement ${i + 1}`}
              value={value}
              onChange={(e) => setAt(i, e.target.value)}
              className={`${FIELD_CLASS} w-24 text-right`}
            />
            <button
              type="button"
              aria-label={`Remove measurement ${i + 1}`}
              onClick={() => removeAt(i)}
              disabled={presets.length <= 1}
              className="text-stone-500 hover:text-destructive disabled:opacity-40"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        ))}
        <button
          type="button"
          aria-label="Add measurement"
          onClick={add}
          disabled={presets.length >= MAX_PROFILE_MEASUREMENT_PRESETS}
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-stone-900 hover:bg-brand-dark disabled:opacity-40"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

export function ProfileTypeDialog({ type, types, onSaved, onClose }: {
  /** The profile type being changed; left out to make a new one. */
  type?: AttachedProfileType;
  /** The whole list, so a name already in use is caught before saving. */
  types: AttachedProfileType[];
  onSaved: (saved: AttachedProfileType) => void;
  onClose: () => void;
}) {
  const contentRef = useModalDialog(onClose);
  const save = useSaveAttachedProfileType();
  const [draft, setDraft] = useState<AttachedProfileTypeDraft>(() => (type ? draftFromAttachedProfileType(type) : blankAttachedProfileTypeDraft()));
  const [error, setError] = useState<string | null>(null);
  const patch = (change: Partial<AttachedProfileTypeDraft>) => setDraft((d) => ({ ...d, ...change }));

  const submit = () => {
    const checked = checkAttachedProfileTypeDraft(draft, types, type?.id);
    if (!checked.ok) {
      setError(checked.error);
      return;
    }
    setError(null);
    save.mutate({ id: type?.id, input: checked.input }, {
      onSuccess: (saved) => {
        onSaved(saved);
        onClose();
      },
      onError: (err) => setError(apiErrorMessage(err, 'The profile could not be saved. Please try again.')),
    });
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-type-dialog-title"
      // z-50 like the Edge dialog, so the pricing-type dropdown (a z-50 popover) opens above it.
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div ref={contentRef} tabIndex={-1} className="mx-4 flex max-h-[90dvh] w-full max-w-2xl flex-col rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3">
          <h2 id="profile-type-dialog-title" className="text-sm font-bold text-stone-900">{type ? 'Edit profile' : 'New profile'}</h2>
          <button type="button" aria-label="Close profile dialog" onClick={onClose} className="text-stone-500 hover:text-stone-800">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="flex flex-col gap-4 overflow-y-auto px-4 py-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_9rem_7rem_6rem_auto]">
              <Field label="Name">
                <input
                  type="text"
                  value={draft.name}
                  maxLength={MAX_PROFILE_NAME_LENGTH}
                  onChange={(e) => patch({ name: e.target.value })}
                  className={FIELD_CLASS}
                />
              </Field>
              <div className="flex flex-col gap-1 text-xs text-stone-700">
                <span>Type</span>
                <Select
                  aria-label="Pricing type" value={draft.pricingType}
                  onChange={(e) => patch({ pricingType: e.target.value as ProfilePricingType })} className={FIELD_CLASS}
                >
                  {PROFILE_PRICING_TYPES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                </Select>
              </div>
              <Field label="Price">
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={draft.price}
                  onChange={(e) => patch({ price: e.target.value })}
                  className={`${FIELD_CLASS} text-right`}
                />
              </Field>
              <Field label="Alias">
                <input
                  type="text"
                  value={draft.alias}
                  maxLength={MAX_PROFILE_ALIAS_LENGTH}
                  onChange={(e) => patch({ alias: e.target.value })}
                  className={FIELD_CLASS}
                />
              </Field>
              <Field label="Color">
                <input type="color" value={draft.color} onChange={(e) => patch({ color: e.target.value })} className={COLOR_FIELD_CLASS} />
              </Field>
            </div>

            <MeasurementsField presets={draft.measurementPresets} onChange={(measurementPresets) => patch({ measurementPresets })} />

            <div className="flex flex-col flex-wrap gap-4 sm:flex-row">
              <div className="flex flex-col gap-2">
                <span className="text-xs font-semibold text-stone-900">Angle (3D)</span>
                <ProfileAnglePicker value={draft.angle} onChange={(angle) => patch({ angle })} />
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-xs font-semibold text-stone-900">Finish (3D)</span>
                <ProfileFinishPicker value={draft.finish} onChange={(finish) => patch({ finish })} />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-stone-200 px-4 py-3">
            {error ? <p role="alert" className="text-xs text-destructive">{error}</p> : <span />}
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className={`${BUTTON_CLASS} border border-stone-300 bg-white text-stone-700 hover:bg-stone-50`}>
                Back
              </button>
              <button type="submit" disabled={save.isPending} className={`${BUTTON_CLASS} bg-brand font-semibold text-stone-900 hover:bg-brand-dark`}>
                {save.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
