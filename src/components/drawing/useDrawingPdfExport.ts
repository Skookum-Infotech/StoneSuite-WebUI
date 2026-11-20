// Exports a drawing as a PDF from wherever a button for it lives (the editor's top
// bar, the Sales Order's Drawing tab). It gathers what the PDF names — the shop's
// edge and profile types, and the slabs on the drawing when anything is laid on one
// — and loads the exporter only when pressed, so jsPDF stays out of the page's bundle.

import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { drawingSlabService } from '@/services/drawingSlabService';
import { slabsOnDrawing } from '@/lib/drawing/slabHolds';
import type { Drawing } from '@/types/drawing';
import type { DrawingSlabUnit } from '@/types/drawingSlab';
import { useAttachedProfileTypes } from './useAttachedProfileTypes';
import { useEdgeTypes } from './useEdgeTypes';
import { orderSlabsQueryKey } from './useOrderSlabs';

/** A slab list read this recently is reused instead of asked for again. */
const SLAB_LIST_FRESH_MS = 30_000;

function hasSlabPlacement(drawing: Drawing): boolean {
  return drawing.areas.some((area) => area.pieces.some((piece) => (
    piece.slab !== undefined || piece.edges.some((edge) => edge.attachedProfile?.slab !== undefined)
  )));
}

export function useDrawingPdfExport(orderNumber: string): { exportPdf: (drawing: Drawing) => Promise<void>; isExporting: boolean } {
  const queryClient = useQueryClient();
  const { types: edgeTypes } = useEdgeTypes();
  const { types: profileTypes } = useAttachedProfileTypes();
  const [isExporting, setIsExporting] = useState(false);

  const exportPdf = useCallback(async (drawing: Drawing) => {
    setIsExporting(true);
    try {
      let slabs: DrawingSlabUnit[] = [];
      if (hasSlabPlacement(drawing)) {
        try {
          const items = await queryClient.fetchQuery({
            queryKey: orderSlabsQueryKey(drawing.salesOrderId),
            queryFn: () => drawingSlabService.listOptions(drawing.salesOrderId),
            staleTime: SLAB_LIST_FRESH_MS,
          });
          slabs = slabsOnDrawing(items, drawing.salesOrderId);
        } catch {
          // The sketch and tables do not depend on slab sizes; export without the layout pages.
          toast.warning('Could not load the slabs, so the slab layout pages are left out.');
        }
      }
      const { exportDrawingToPdf } = await import('@/lib/drawingPdfExport');
      await exportDrawingToPdf({ drawing, orderNumber, edgeTypes, profileTypes, slabs });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not create the drawing PDF.');
    } finally {
      setIsExporting(false);
    }
  }, [queryClient, edgeTypes, profileTypes, orderNumber]);

  return { exportPdf, isExporting };
}
