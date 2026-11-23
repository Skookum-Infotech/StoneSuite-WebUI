// Whether a piece shows the slab it is laid on: only when it sits on a slab that has a
// photo and actually fits there. A piece that runs off the slab or overlaps another
// keeps its plain fill — the red outline in the Material tab is the warning, and a
// photo of stone the piece would not really be cut from would mislead.

import { useMemo } from 'react';
import type { Piece } from '@/types/drawing';
import { othersOnSlab, placedOutline, slabFit } from '@/lib/drawing/slabs';
import { useDrawingEditor } from './DrawingEditorContext';
import { useMaterialPicker, type SlabTexture } from './MaterialPickerContext';

export function usePieceSlabTexture(piece: Piece): SlabTexture | null {
  const { state } = useDrawingEditor();
  const { slabTextures } = useMaterialPicker();
  const placement = piece.slab;
  const texture = placement ? slabTextures[placement.slabId] : undefined;
  const areas = state.present.areas;

  return useMemo(() => {
    if (!placement || !texture) return null;
    const allPieces = areas.flatMap((a) => a.pieces);
    const fit = slabFit(
      placedOutline(piece, placement), texture, othersOnSlab(allPieces, placement.slabId, piece.id),
    );
    return fit === 'fits' ? texture : null;
  }, [placement, texture, areas, piece]);
}
