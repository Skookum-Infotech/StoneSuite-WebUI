// The sales order's slabs for the Material tab: what the order can use, which are
// already on its drawing, and adding or giving one back. Adding reserves the slab
// for the order on the server; the list is read fresh after every change so it
// never drifts from what Inventory shows.

import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { drawingSlabService } from '@/services/drawingSlabService';
import { slabsOnDrawing } from '@/lib/drawing/slabHolds';
import type { DrawingSlabItem, DrawingSlabUnit } from '@/types/drawingSlab';

export const orderSlabsQueryKey = (salesOrderId: string) => ['sales-order-slab-options', salesOrderId] as const;

export interface OrderSlabs {
  items: DrawingSlabItem[];
  /** The slabs already on the drawing, in serial order. */
  onDrawing: DrawingSlabUnit[];
  isLoading: boolean;
  error: unknown;
  addSlab: (slabId: string) => Promise<DrawingSlabUnit>;
  removeSlab: (slabId: string) => Promise<void>;
  /** The slab being added right now, so its row can show it. */
  addingId: string | null;
  mutationError: unknown;
}

/** The photo links the server hands out live ten minutes; refresh well inside that. */
const PHOTO_LINK_REFRESH_MS = 5 * 60 * 1000;

/** `enabled` false leaves the list unread (the board only needs it once a piece is placed). */
export function useOrderSlabs(salesOrderId: string, enabled = true): OrderSlabs {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: orderSlabsQueryKey(salesOrderId),
    queryFn: () => drawingSlabService.listOptions(salesOrderId),
    enabled: enabled && Boolean(salesOrderId),
    refetchInterval: PHOTO_LINK_REFRESH_MS,
  });

  function refresh() {
    queryClient.invalidateQueries({ queryKey: orderSlabsQueryKey(salesOrderId) });
    // Inventory screens show the hold too.
    queryClient.invalidateQueries({ queryKey: ['inventory-units'] });
    queryClient.invalidateQueries({ queryKey: ['inventory-unit'] });
  }

  const add = useMutation({
    mutationFn: (slabId: string) => drawingSlabService.hold(salesOrderId, slabId),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: (slabId: string) => drawingSlabService.release(salesOrderId, slabId),
    onSuccess: refresh,
  });

  const items = useMemo(() => query.data ?? [], [query.data]);
  const onDrawing = useMemo(() => slabsOnDrawing(items, salesOrderId), [items, salesOrderId]);

  return {
    items,
    onDrawing,
    isLoading: query.isLoading,
    error: query.error,
    addSlab: add.mutateAsync,
    removeSlab: remove.mutateAsync,
    addingId: add.isPending ? add.variables ?? null : null,
    mutationError: add.error ?? remove.error,
  };
}
