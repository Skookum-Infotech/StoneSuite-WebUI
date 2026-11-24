// The Material tab's "Nest all": lays every piece and painted profile side that is not
// on a slab yet onto the slabs this order holds, as one undo step. What is already on a
// slab stays put. It never adds a slab itself — that would hold stock in Inventory — so
// anything that does not fit is left off and reported.

import { useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { nestOnSlabs } from '@/lib/drawing/slabNesting';
import { slabPlaceables } from '@/lib/drawing/slabPlaceables';
import type { DrawingSlabUnit } from '@/types/drawingSlab';
import { useAttachedProfileTypeList } from './AttachedProfileTypesContext';
import { useDrawingEditor } from './DrawingEditorContext';

export function useNestAll(slabs: DrawingSlabUnit[]): { nestAll: () => void; unplacedCount: number } {
  const { state, dispatch } = useDrawingEditor();
  const profileTypes = useAttachedProfileTypeList();
  const items = useMemo(() => slabPlaceables(state.present.areas, profileTypes), [state.present.areas, profileTypes]);
  const unplacedCount = items.filter((it) => it.slab === undefined).length;

  const nestAll = useCallback(() => {
    const { placements, unplaced } = nestOnSlabs(items, slabs);
    dispatch({
      type: 'placeOnSlabs',
      placements: placements.map(({ item, slab }) => ({
        areaId: item.areaId, pieceId: item.pieceId, edgeIndex: item.edgeIndex, slab,
      })),
    });
    if (unplaced.length === 0) {
      toast.success(`Laid ${placements.length} ${placements.length === 1 ? 'piece' : 'pieces'} on your slabs.`);
    } else {
      toast.warning(
        `Laid ${placements.length} of ${placements.length + unplaced.length} pieces. `
        + `${unplaced.length} would not fit — add another slab from Inventory.`,
      );
    }
  }, [items, slabs, dispatch]);

  return { nestAll, unplacedCount };
}
