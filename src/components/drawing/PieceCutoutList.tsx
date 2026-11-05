// Inspector section listing the selected piece's cutouts: pick one to edit it,
// with a plain warning beside any that currently breaks a placement rule.

import type { Piece } from '@/types/drawing';
import { CUTOUT_TYPE_LABELS, cutoutArea, validateCutouts } from '@/lib/drawing/cutouts';
import { MM2_PER_FT2 } from '@/lib/drawing/metrics';
import { useDrawingEditor } from './DrawingEditorContext';
import { PanelSection } from './PanelSection';

const SQ_IN_PER_SQ_FT = 144;

export function PieceCutoutList({ piece }: { piece: Piece }) {
  const { state, dispatch } = useDrawingEditor();
  if (piece.cutouts.length === 0) return null;
  const issues = validateCutouts(piece);

  return (
    <PanelSection title={`Cutouts (${piece.cutouts.length})`} label="Cutouts on this piece">
      {piece.cutouts.map((cutout) => {
        const name = cutout.label || CUTOUT_TYPE_LABELS[cutout.type];
        const problem = issues.find((i) => i.cutoutId === cutout.id || i.otherId === cutout.id);
        const sqIn = Math.round((cutoutArea(cutout) / MM2_PER_FT2) * SQ_IN_PER_SQ_FT);
        return (
          <div key={cutout.id} className="flex flex-col">
            <button
              type="button"
              aria-label={`Edit ${name}`}
              aria-pressed={state.selectedCutoutId === cutout.id}
              onClick={() => dispatch({ type: 'selectCutout', pieceId: piece.id, cutoutId: cutout.id })}
              className="flex justify-between rounded border border-stone-200 px-2 py-1 text-left text-xs aria-pressed:border-brand aria-pressed:bg-brand/10"
            >
              <span>{name}</span>
              <span className="text-stone-500">{sqIn} sq in</span>
            </button>
            {problem && <span role="alert" className="text-2xs text-destructive">{problem.message}</span>}
          </div>
        );
      })}
    </PanelSection>
  );
}
