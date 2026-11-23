// Inspector fields for how a piece sits in the drawing: its kind (countertop,
// island, peninsula) and its rotation in degrees. Rotation takes any angle,
// not just quarter turns.

import { Select } from '@/components/ui/select';
import type { Piece, PieceKind } from '@/types/drawing';
import { DegreesInput } from './DegreesInput';
import { useDrawingEditor } from './DrawingEditorContext';

const KIND_LABELS: Record<PieceKind, string> = {
  countertop: 'Countertop',
  island: 'Island',
  peninsula: 'Peninsula',
};

export function PieceTransformFields({ piece }: { piece: Piece }) {
  const { state, dispatch } = useDrawingEditor();

  return (
    <>
      <label className="flex flex-col gap-0.5">
        Type
        <Select
          aria-label="Piece type"
          value={piece.kind ?? 'countertop'}
          onChange={(e) => dispatch({
            type: 'updatePiece', areaId: state.activeAreaId, pieceId: piece.id, patch: { kind: e.target.value as PieceKind },
          })}
          className="rounded border border-stone-200 px-1.5 py-1"
        >
          {(Object.keys(KIND_LABELS) as PieceKind[]).map((kind) => <option key={kind} value={kind}>{KIND_LABELS[kind]}</option>)}
        </Select>
      </label>
      <DegreesInput
        label="Rotation (degrees)"
        valueDeg={piece.rotationDeg}
        onCommit={(deg) => {
          dispatch({ type: 'setPieceRotation', areaId: state.activeAreaId, pieceIds: [piece.id], rotationDeg: deg });
          return null;
        }}
      />
    </>
  );
}
