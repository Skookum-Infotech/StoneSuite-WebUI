// How many slabs the whole drawing needs ("Slabs required"), worked out from every
// piece and profile piece and the size of the slabs the order holds — or a jumbo slab
// until it holds one. Worked on a slightly-late copy of the drawing so dragging a piece
// is never held up by packing it again on every frame.

import { useDeferredValue, useMemo } from 'react';
import { estimateSlabs, standardSlab, type SlabEstimate } from '@/lib/drawing/slabNesting';
import { slabPlaceables } from '@/lib/drawing/slabPlaceables';
import type { SlabSize } from '@/lib/drawing/slabs';
import { useAttachedProfileTypeList } from './AttachedProfileTypesContext';
import { useDrawingEditor } from './DrawingEditorContext';
import { useOrderSlabs } from './useOrderSlabs';

export interface SlabRequirement extends SlabEstimate {
  /** The slab size the estimate is for. */
  slab: SlabSize;
  /** True while the order holds no slab, so `slab` is the assumed jumbo size. */
  assumed: boolean;
}

export function useSlabRequirement(): SlabRequirement {
  const { state } = useDrawingEditor();
  const profileTypes = useAttachedProfileTypeList();
  const areas = useDeferredValue(state.present.areas);
  // The slab list is only read once there is something to estimate.
  const { onDrawing } = useOrderSlabs(state.present.salesOrderId, areas.some((a) => a.pieces.length > 0));
  const slab = useMemo(() => standardSlab(onDrawing), [onDrawing]);
  const estimate = useMemo(() => estimateSlabs(slabPlaceables(areas, profileTypes), slab), [areas, profileTypes, slab]);
  return { ...estimate, slab, assumed: onDrawing.length === 0 };
}
