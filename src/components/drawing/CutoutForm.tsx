// The body of the Cutout dialog: type, name, shape and size, edges, faucet
// holes (sinks only) and distance lines. It keeps what is typed as text until
// Save, then turns it into a cutout on the piece (cutoutForm.ts) and checks it
// fits there — a cutout is real geometry, so one that does not fit is refused
// with the reason and the dialog stays open. Given a `cutout` it edits that one
// in place (and can delete it) instead of adding a new one.

import { useState } from 'react';
import { Select } from '@/components/ui/select';
import type { Cutout, CutoutType, Piece } from '@/types/drawing';
import type { CutoutTypeOption } from '@/services/drawingService';
import {
  cutoutPatch, defaultCutoutName, defaultSizeText, draftFromCutout, draftToCutout, FAUCET_HOLE_TYPE, newDraft,
  type CutoutDraft, type DraftErrors,
} from '@/lib/drawing/cutoutForm';
import { CUTOUT_TYPE_LABELS, cutoutPatchProblem, validateCutouts } from '@/lib/drawing/cutouts';
import { bounds } from '@/lib/drawing/geometry';
import { DistanceLinesPicker } from './DistanceLinesPicker';
import { useDrawingEditor } from './DrawingEditorContext';
import { useEdgeCodes } from './useEdgeCodes';

const FIELD_CLASS = 'w-full rounded border border-stone-300 bg-white px-2 py-1.5 text-xs text-stone-900';
const SECTION_TITLE_CLASS = 'text-xs font-semibold text-stone-900';

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 text-xs text-stone-700">
      <span>{label}</span>
      {children}
      {error && <span role="alert" className="text-2xs text-destructive">{error}</span>}
    </div>
  );
}

function HideToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex items-center gap-1 text-xs text-stone-700">
      <input type="checkbox" aria-label={label} checked={checked} onChange={(e) => onChange(e.target.checked)} />
      Hide
    </label>
  );
}

export function CutoutForm({ piece, cutout, types: masterTypes, onClose }: {
  piece: Piece; cutout?: Cutout; types: CutoutTypeOption[]; onClose: () => void;
}) {
  const { state, dispatch } = useDrawingEditor();
  const edgeCodes = useEdgeCodes();
  const format = { unit: state.present.displayUnit, fractionDenominator: state.present.fractionDenominator };
  // A cutout from before the types became master data (a soap dispenser, an
  // outlet) keeps its own type in the list, so editing it does not blank it.
  const types = cutout && !masterTypes.some((t) => t.code === cutout.type)
    ? [...masterTypes, { code: cutout.type, label: CUTOUT_TYPE_LABELS[cutout.type] }]
    : masterTypes;
  const labelOf = (code: CutoutType) => types.find((t) => t.code === code)?.label ?? code;
  const [draft, setDraft] = useState<CutoutDraft>(() => (
    cutout ? draftFromCutout(cutout, labelOf(cutout.type), format) : newDraft(types[0].code, types[0].label, format)
  ));
  const [errors, setErrors] = useState<DraftErrors>({});
  const [placement, setPlacement] = useState<string | null>(null);

  const patch = (change: Partial<CutoutDraft>) => setDraft((d) => ({ ...d, ...change }));

  // Switching type renames and resizes the draft to the new type's starting
  // values — but only the parts still untouched, so typed work is never lost.
  const changeType = (code: CutoutType) => setDraft((d) => {
    const next: CutoutDraft = { ...d, type: code };
    if (d.name === defaultCutoutName(labelOf(d.type))) next.name = defaultCutoutName(labelOf(code));
    const before = defaultSizeText(d.type, format);
    if (d.length === before.length && d.height === before.height) Object.assign(next, defaultSizeText(code, format));
    return next;
  });

  const save = () => {
    const b = bounds(piece.outline);
    const centre = cutout?.center ?? { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 };
    const result = draftToCutout(draft, cutout?.id ?? crypto.randomUUID(), centre);
    if (result.errors) {
      setErrors(result.errors);
      setPlacement(null);
      return;
    }
    setErrors({});
    if (cutout) {
      const patch = cutoutPatch(result.cutout);
      const problem = cutoutPatchProblem(piece, cutout, patch);
      if (problem) {
        setPlacement(problem);
        return;
      }
      dispatch({ type: 'updateCutout', areaId: state.activeAreaId, pieceId: piece.id, cutoutId: cutout.id, patch });
      onClose();
      return;
    }
    const issues = validateCutouts({ outline: piece.outline, cutouts: [...piece.cutouts, result.cutout] });
    if (issues.length > 0) {
      setPlacement(issues[issues.length - 1].message);
      return;
    }
    dispatch({ type: 'addCutout', areaId: state.activeAreaId, pieceId: piece.id, cutout: result.cutout });
    onClose();
  };

  const remove = () => {
    if (!cutout) return;
    dispatch({ type: 'deleteCutout', areaId: state.activeAreaId, pieceId: piece.id, cutoutId: cutout.id });
    onClose();
  };

  return (
    <>
      <div className="flex flex-col gap-4 overflow-y-auto px-4 py-3">
        <div className="grid grid-cols-[12rem_1fr] gap-3">
          <Field label="Type">
            <Select aria-label="Cutout type" value={draft.type} onChange={(e) => changeType(e.target.value as CutoutType)} className={FIELD_CLASS}>
              {types.map((t) => <option key={t.code} value={t.code}>{t.label}</option>)}
            </Select>
          </Field>
          <div className="flex flex-col gap-1 text-xs text-stone-700">
            <div className="flex items-center justify-between">
              <span>Name</span>
              <HideToggle label="Hide name" checked={draft.hideName} onChange={(hideName) => patch({ hideName })} />
            </div>
            <input aria-label="Cutout name" value={draft.name} onChange={(e) => patch({ name: e.target.value })} className={FIELD_CLASS} />
          </div>
        </div>

        <section aria-label="Shape" className="flex flex-col gap-2 border-t border-stone-200 pt-3">
          <h3 className={SECTION_TITLE_CLASS}>Shape</h3>
          <div className="grid grid-cols-[8rem_1fr] gap-3">
            <div className="flex flex-col items-center gap-1.5 rounded border border-stone-200 p-2 text-xs text-stone-600">
              <svg viewBox="0 0 60 40" className="h-16 w-full rounded bg-white" role="img" aria-label="Rectangle shape">
                <rect x="6" y="6" width="48" height="28" className="fill-none stroke-stone-900" strokeWidth={1.5} />
              </svg>
              No Picture
              <button
                type="button"
                disabled
                title="More shapes arrive in the next update"
                className="rounded bg-brand px-3 py-0.5 text-2xs font-medium text-stone-900 disabled:opacity-50"
              >
                Change
              </button>
            </div>
            <div className="grid grid-cols-[1fr_8rem] gap-x-3 gap-y-2">
              <div className="flex flex-col gap-1 text-xs text-stone-700">
                <div className="flex items-center justify-between">
                  <span>Measurements (Length x Height)</span>
                  <HideToggle label="Hide measurements" checked={draft.hideMeasurements} onChange={(hideMeasurements) => patch({ hideMeasurements })} />
                </div>
                <div className="flex items-center gap-1.5">
                  <input aria-label="Length" value={draft.length} onChange={(e) => patch({ length: e.target.value })} className={`${FIELD_CLASS} text-right`} />
                  <span className="text-stone-500">x</span>
                  <input aria-label="Height" value={draft.height} onChange={(e) => patch({ height: e.target.value })} className={`${FIELD_CLASS} text-right`} />
                </div>
                {(errors.length || errors.height) && (
                  <span role="alert" className="text-2xs text-destructive">{errors.length ?? errors.height}</span>
                )}
              </div>
              <Field label="Edges">
                <Select aria-label="Edges" value={draft.edgeCode} onChange={(e) => patch({ edgeCode: e.target.value })} className={FIELD_CLASS}>
                  <option value="">— none —</option>
                  {edgeCodes.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
                </Select>
              </Field>
              {draft.type === FAUCET_HOLE_TYPE && (
                <>
                  <Field label="Faucet Hole Count" error={errors.faucetHoleCount}>
                    <input aria-label="Faucet hole count" value={draft.faucetHoleCount} inputMode="numeric" onChange={(e) => patch({ faucetHoleCount: e.target.value })} className={FIELD_CLASS} />
                  </Field>
                  <Field label="Faucet Hole Radius" error={errors.faucetHoleRadius}>
                    <input aria-label="Faucet hole radius" value={draft.faucetHoleRadius} onChange={(e) => patch({ faucetHoleRadius: e.target.value })} className={`${FIELD_CLASS} text-right`} />
                  </Field>
                </>
              )}
            </div>
          </div>
        </section>

        <section aria-label="Distance lines" className="flex flex-col gap-2 border-t border-stone-200 pt-3">
          <h3 className={SECTION_TITLE_CLASS}>Distance Lines</h3>
          <DistanceLinesPicker value={draft.distanceLines} onChange={(distanceLines) => patch({ distanceLines })} />
        </section>

        {placement && <p role="alert" className="text-xs text-destructive">{placement}</p>}
      </div>

      <div className="flex justify-end gap-2 border-t border-stone-200 px-4 py-3">
        {cutout && (
          <button type="button" onClick={remove} className="mr-auto rounded-lg border border-stone-300 bg-white px-4 py-1.5 text-xs font-medium text-destructive">
            Delete
          </button>
        )}
        <button type="button" onClick={onClose} className="rounded-lg border border-stone-300 bg-white px-4 py-1.5 text-xs font-medium text-stone-700">
          Back
        </button>
        <button type="button" onClick={save} className="rounded-lg bg-brand px-4 py-1.5 text-xs font-semibold text-stone-900">
          Save
        </button>
      </div>
    </>
  );
}
