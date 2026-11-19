// "Select Pieces" on a slab card arms this: the cursor over the board becomes a
// target, and clicking a piece lays its outline on that slab (where it can then be
// dragged). Lives beside the editor context rather than in it because only the
// Material tab and the board's pieces care, and the editor context is already big.
//
// Outside a provider (the canvas rendered on its own in tests) nothing is armed.

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { DrawingSlabUnit } from '@/types/drawingSlab';
import { autoPlace, othersOnSlab } from '@/lib/drawing/slabs';
import { profilePlaceableId, slabPlaceables } from '@/lib/drawing/slabPlaceables';
import { useAttachedProfileTypeList } from './AttachedProfileTypesContext';
import { useDrawingEditor } from './DrawingEditorContext';
import { useOrderSlabs } from './useOrderSlabs';

/** What the board needs to draw a slab's photo inside a piece laid on it. */
export interface SlabTexture {
  photoUrl: string;
  lengthMm: number;
  widthMm: number;
}

export interface MaterialPickerValue {
  /** The slab armed for picking, or null. */
  pickingSlab: DrawingSlabUnit | null;
  startPicking: (slab: DrawingSlabUnit) => void;
  stopPicking: () => void;
  /** Lay the clicked piece on the armed slab, at the first spot it fits. */
  pickPiece: (pieceId: string) => void;
  /** Lay one painted Profiles side — its own rectangle of stone, independent
   *  of its parent piece — on the armed slab, at the first spot it fits. */
  pickProfile: (pieceId: string, edgeIndex: number) => void;
  /** The photo and size of each slab that has one, by slab id — so a piece that fits its
   *  slab can show the stone it would be cut from. */
  slabTextures: Record<string, SlabTexture>;
}

const NOT_PICKING: MaterialPickerValue = {
  pickingSlab: null,
  startPicking: () => undefined,
  stopPicking: () => undefined,
  pickPiece: () => undefined,
  pickProfile: () => undefined,
  slabTextures: {},
};

const MaterialPickerContext = createContext<MaterialPickerValue>(NOT_PICKING);

export function MaterialPickerProvider({ children }: { children: ReactNode }) {
  const { state, dispatch, workspace } = useDrawingEditor();
  const profileTypes = useAttachedProfileTypeList();
  const [pickingSlab, setPickingSlab] = useState<DrawingSlabUnit | null>(null);
  const startPicking = useCallback((slab: DrawingSlabUnit) => setPickingSlab(slab), []);
  const stopPicking = useCallback(() => setPickingSlab(null), []);

  // The slab list is only read once it matters: the Material tab is open, or a piece
  // has been laid on a slab and wants its photo.
  const anyPlaced = state.present.areas.some((a) => a.pieces.some((p) => p.slab));
  const { items } = useOrderSlabs(state.present.salesOrderId, anyPlaced || workspace === 'material');
  const slabTextures = useMemo(() => Object.fromEntries(
    items.flatMap((item) => item.units)
      .filter((u) => Boolean(u.photoUrl))
      .map((u) => [u.id, { photoUrl: u.photoUrl as string, lengthMm: u.lengthMm, widthMm: u.widthMm }]),
  ), [items]);

  // Picking only makes sense on the Material tab; Escape lets go of it.
  const armed = pickingSlab !== null && workspace === 'material';
  useEffect(() => {
    if (!armed) return undefined;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPickingSlab(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [armed]);

  // A piece and a profile piece share one id space and one collision check
  // (lib/drawing/slabPlaceables.ts), so placing either avoids both kinds of
  // item already on the slab.
  const pickPiece = useCallback((pieceId: string) => {
    if (!pickingSlab) return;
    const areaId = state.activeAreaId;
    const placeables = slabPlaceables(state.present.areas, profileTypes);
    const target = placeables.find((it) => it.id === pieceId);
    if (!target) return;
    // Already on this slab: leave it where the user put it.
    if (target.slab?.slabId === pickingSlab.id) return;
    const placement = autoPlace(target, pickingSlab.id, pickingSlab, othersOnSlab(placeables, pickingSlab.id, target.id));
    dispatch({ type: 'updatePiece', areaId, pieceId, patch: { slab: placement } });
  }, [pickingSlab, state.activeAreaId, state.present.areas, profileTypes, dispatch]);

  const pickProfile = useCallback((pieceId: string, edgeIndex: number) => {
    if (!pickingSlab) return;
    const areaId = state.activeAreaId;
    const placeables = slabPlaceables(state.present.areas, profileTypes);
    const id = profilePlaceableId(pieceId, edgeIndex);
    const target = placeables.find((it) => it.id === id);
    if (!target) return;
    if (target.slab?.slabId === pickingSlab.id) return;
    const placement = autoPlace(target, pickingSlab.id, pickingSlab, othersOnSlab(placeables, pickingSlab.id, target.id));
    dispatch({ type: 'updateAttachedProfileSlab', areaId, pieceId, edgeIndex, slab: placement });
  }, [pickingSlab, state.activeAreaId, state.present.areas, profileTypes, dispatch]);

  const value = useMemo<MaterialPickerValue>(
    () => ({ pickingSlab: armed ? pickingSlab : null, startPicking, stopPicking, pickPiece, pickProfile, slabTextures }),
    [armed, pickingSlab, startPicking, stopPicking, pickPiece, pickProfile, slabTextures],
  );
  return <MaterialPickerContext.Provider value={value}>{children}</MaterialPickerContext.Provider>;
}

// Provider and hook live together on purpose, like DrawingEditorContext.
// eslint-disable-next-line react-refresh/only-export-components
export function useMaterialPicker(): MaterialPickerValue {
  return useContext(MaterialPickerContext);
}
