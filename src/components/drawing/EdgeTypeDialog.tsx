// The edge editor: opened by the pencil in the Edges bar to change the picked
// edge type, or by "Add new" to make another. Name, how it is priced, the rate,
// a short alias, the colour it is drawn in, and the finish it will show in 3D.
// Save writes it to the shop's list (the server checks the name is not taken);
// Back closes without saving. Same hand-rolled useModalDialog + createPortal
// shape as CutoutDialog.

import { useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { apiErrorMessage } from '@/api/tenantClient';
import { Select } from '@/components/ui/select';
import { useModalDialog } from '@/hooks/useModalDialog';
import type { EdgePricingType, EdgeType } from '@/types/drawing';
import {
  blankEdgeTypeDraft, checkEdgeTypeDraft, draftFromEdgeType, EDGE_PRICING_TYPES, MAX_EDGE_ALIAS_LENGTH, MAX_EDGE_NAME_LENGTH,
  type EdgeTypeDraft,
} from '@/lib/drawing/edgeTypes';
import { EdgeFinishPicker } from './EdgeFinishPicker';
import { useSaveEdgeType } from './useEdgeTypes';

const FIELD_CLASS = 'w-full rounded border border-stone-300 bg-white px-2 py-1.5 type-input outline-none focus:border-brand focus:ring-2 focus:ring-brand/30';
const COLOR_FIELD_CLASS = 'h-8 w-14 cursor-pointer rounded border border-stone-300 bg-white p-0.5';
const BUTTON_CLASS = 'rounded-lg px-4 py-1.5 text-xs font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand disabled:opacity-60';

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 type-field-label">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function EdgeTypeDialog({ type, types, onSaved, onClose }: {
  /** The edge type being changed; left out to make a new one. */
  type?: EdgeType;
  /** The whole list, so a name already in use is caught before saving. */
  types: EdgeType[];
  onSaved: (saved: EdgeType) => void;
  onClose: () => void;
}) {
  const contentRef = useModalDialog(onClose);
  const save = useSaveEdgeType();
  const [draft, setDraft] = useState<EdgeTypeDraft>(() => (type ? draftFromEdgeType(type) : blankEdgeTypeDraft()));
  const [error, setError] = useState<string | null>(null);
  const patch = (change: Partial<EdgeTypeDraft>) => setDraft((d) => ({ ...d, ...change }));

  const submit = () => {
    const checked = checkEdgeTypeDraft(draft, types, type?.id);
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
      onError: (err) => setError(apiErrorMessage(err, 'The edge could not be saved. Please try again.')),
    });
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="edge-type-dialog-title"
      // z-50 like the Cutout dialog, so the pricing-type dropdown (a z-50 popover) opens above it.
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div ref={contentRef} tabIndex={-1} className="mx-4 flex max-h-[90dvh] w-full max-w-2xl flex-col rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3">
          <h2 id="edge-type-dialog-title" className="type-card-title">{type ? 'Edit edge' : 'New edge'}</h2>
          <button type="button" aria-label="Close edge dialog" onClick={onClose} className="text-ink-muted hover:text-ink-strong">
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
                  maxLength={MAX_EDGE_NAME_LENGTH}
                  onChange={(e) => patch({ name: e.target.value })}
                  className={FIELD_CLASS}
                />
              </Field>
              <div className="flex flex-col gap-1 text-xs text-ink">
                <span>Type</span>
                <Select aria-label="Pricing type" value={draft.pricingType} onChange={(e) => patch({ pricingType: e.target.value as EdgePricingType })} className={FIELD_CLASS}>
                  {EDGE_PRICING_TYPES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
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
                  maxLength={MAX_EDGE_ALIAS_LENGTH}
                  onChange={(e) => patch({ alias: e.target.value })}
                  className={FIELD_CLASS}
                />
              </Field>
              <Field label="Color">
                <input type="color" value={draft.color} onChange={(e) => patch({ color: e.target.value })} className={COLOR_FIELD_CLASS} />
              </Field>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold text-ink-strong">Finish (3D)</span>
              <EdgeFinishPicker value={draft.finish} onChange={(finish) => patch({ finish })} />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-stone-200 px-4 py-3">
            {error ? <p role="alert" className="type-error">{error}</p> : <span />}
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className={`${BUTTON_CLASS} border border-stone-300 bg-white text-ink hover:bg-stone-50`}>
                Back
              </button>
              <button type="submit" disabled={save.isPending} className={`${BUTTON_CLASS} bg-brand font-semibold text-ink-strong hover:bg-brand-dark`}>
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
