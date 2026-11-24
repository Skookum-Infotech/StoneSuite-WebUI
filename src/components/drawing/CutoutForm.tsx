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
  cutoutPatch, defaultCutoutName, defaultSizeText, draftFromCutout, draftToCutout, FAUCET_HOLE_TYPE, geometryOf, newDraft,
  shapeCodeFor, tabFor, type CutoutDraft, type DraftErrors,
} from '@/lib/drawing/cutoutForm';
import { findShape, tabsForType, shapesForType, type ShapeTab } from '@/lib/drawing/cutoutShapes';
import { CUTOUT_TYPE_LABELS, cutoutPatchProblem } from '@/lib/drawing/cutouts';
import { bounds } from '@/lib/drawing/geometry';
import { CutoutShapePicker } from './CutoutShapePicker';
import { CutoutShapeThumb } from './CutoutShapeThumb';
import { DistanceLinesPicker } from './DistanceLinesPicker';
import { useDrawingEditor } from './DrawingEditorContext';
import { useEdgeCodes } from './useEdgeCodes';

import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
const FIELD_CLASS = 'w-full rounded border border-stone-300 bg-white px-2 py-1.5 text-xs text-ink-strong';
const SECTION_TITLE_CLASS = 'text-xs font-semibold text-ink-strong';

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 text-xs text-ink">
      <span>{label}</span>
      {children}
      {error && <span role="alert" className="text-micro text-danger-ink">{error}</span>}
    </div>
  );
}

function HideToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex items-center gap-1 type-field-label">
      <input type="checkbox" aria-label={label} checked={checked} onChange={(e) => onChange(e.target.checked)} />
      Hide
    </label>
  );
}

export function CutoutForm({ piece, cutout, types: masterTypes, onClose }: {
  piece: Piece; cutout?: Cutout; types: CutoutTypeOption[]; onClose: () => void;
}) {
  const { state, dispatch, startPlacing } = useDrawingEditor();
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
  const [picking, setPicking] = useState(false);

  const patch = (change: Partial<CutoutDraft>) => setDraft((d) => ({ ...d, ...change }));

  // Resizes the draft to the starting size of what it now is (a type, or a
  // type's picture) — but only if the size is still the old starting size, so
  // typed work is never lost.
  const resized = (d: CutoutDraft, next: CutoutDraft): CutoutDraft => {
    const before = defaultSizeText(d.type, format, d.shapeCode);
    return d.length === before.length && d.height === before.height
      ? { ...next, ...defaultSizeText(next.type, format, next.shapeCode) }
      : next;
  };

  // Switching type renames the draft to the new type's name (if it still has
  // the old one) and drops a picture the new type does not have.
  const changeType = (code: CutoutType) => setDraft((d) => {
    // A draft still on its old type's first tab (and no picture) moves to the
    // new type's first tab — a fireplace opens on Arc, a bathtub on Ellipse;
    // one the user steered elsewhere keeps its tab where the new type has it.
    const onFirstTab = d.shapeCode === '' && d.shapeTab === (tabsForType(d.type)[0] ?? 'rectangle');
    const next: CutoutDraft = {
      ...d,
      type: code,
      shapeTab: onFirstTab ? tabFor(code, tabsForType(code)[0] ?? 'rectangle') : tabFor(code, d.shapeTab),
      shapeCode: shapeCodeFor(code, d.shapeCode),
    };
    if (d.name === defaultCutoutName(labelOf(d.type))) next.name = defaultCutoutName(labelOf(code));
    return resized(d, next);
  });

  const pickShape = (shapeTab: ShapeTab, shapeCode: string) => {
    setDraft((d) => resized(d, { ...d, shapeTab, shapeCode }));
    setPicking(false);
  };

  // Change is for a type with a picture to choose, or more than one outline.
  const canChange = shapesForType(draft.type).length > 0 || tabsForType(draft.type).length > 1;
  const shape = findShape(draft.shapeCode) ?? null;

  const save = () => {
    const b = bounds(piece.outline);
    // A new cutout starts in the middle of the piece; where it ends up is the
    // user's click (below).
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
    // The cursor turns into a target: the cutout follows it over the piece and
    // is added where the user clicks (CutoutPlacementLayer).
    startPlacing(piece.id, result.cutout);
    onClose();
  };

  const remove = () => {
    if (!cutout) return;
    dispatch({ type: 'deleteCutout', areaId: state.activeAreaId, pieceId: piece.id, cutoutId: cutout.id });
    onClose();
  };

  if (picking) {
    return (
      <CutoutShapePicker type={draft.type} tab={draft.shapeTab} value={draft.shapeCode} onPick={pickShape} onBack={() => setPicking(false)} />
    );
  }

  return (
    <>
      <div className="flex flex-col gap-4 overflow-y-auto px-4 py-3">
        <div className="grid grid-cols-[12rem_1fr] gap-3">
          <Field label="Type">
            <Select aria-label="Cutout type" value={draft.type} onChange={(e) => changeType(e.target.value as CutoutType)} className={FIELD_CLASS}>
              {types.map((t) => <option key={t.code} value={t.code}>{t.label}</option>)}
            </Select>
          </Field>
          <div className="flex flex-col gap-1 text-xs text-ink">
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
            <div className="flex flex-col items-center gap-1.5 rounded border border-stone-200 p-2 text-xs text-ink">
              <CutoutShapeThumb shape={shape} geometry={geometryOf(draft)} className="h-16 w-full rounded bg-white" />
              <span className="text-center">{shape ? shape.name : 'No Picture'}</span>
              <button
                type="button"
                disabled={!canChange}
                title={canChange ? 'Choose a shape' : 'This type has no shapes yet'}
                onClick={() => setPicking(true)}
                className={buttonVariants({ size: 'sm' })}
              >
                Change
              </button>
            </div>
            <div className="grid grid-cols-[1fr_8rem] gap-x-3 gap-y-2">
              <div className="flex flex-col gap-1 text-xs text-ink">
                <div className="flex items-center justify-between">
                  <span>Measurements (Length x Height)</span>
                  <HideToggle label="Hide measurements" checked={draft.hideMeasurements} onChange={(hideMeasurements) => patch({ hideMeasurements })} />
                </div>
                <div className="flex items-center gap-1.5">
                  <input aria-label="Length" value={draft.length} onChange={(e) => patch({ length: e.target.value })} className={`${FIELD_CLASS} text-right`} />
                  <span className="text-ink-muted">x</span>
                  <input aria-label="Height" value={draft.height} onChange={(e) => patch({ height: e.target.value })} className={`${FIELD_CLASS} text-right`} />
                </div>
                {(errors.length || errors.height) && (
                  <span role="alert" className="text-micro text-danger-ink">{errors.length ?? errors.height}</span>
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

        {placement && <p role="alert" className="type-error">{placement}</p>}
      </div>

      <div className="flex justify-end gap-2 border-t border-stone-200 px-4 py-3">
        {cutout && (
          <button type="button" onClick={remove} className={cn(buttonVariants({ variant: 'outline' }), 'mr-auto')}>
            Delete
          </button>
        )}
        <button type="button" onClick={onClose} className={buttonVariants({ variant: 'outline' })}>
          Back
        </button>
        <button type="button" onClick={save} className={buttonVariants()}>
          Save
        </button>
      </div>
    </>
  );
}
