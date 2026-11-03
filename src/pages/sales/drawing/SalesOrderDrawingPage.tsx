// The countertop drawing editor's own full-screen page, at
// /sales/sales_order/:id/drawing. Loads the order (for the breadcrumb and
// the inspector's material-line list) and any saved drawing — falling
// back to a blank one, since StoneSuite-Backend doesn't have the drawing
// endpoint yet (drawingService.getDrawing always resolves null today).
// Saving/autosave/versions are a later build spec task — this page only
// holds in-memory, undo/redo-backed state.

import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { salesOrderService } from '@/services/salesOrderService';
import { drawingService } from '@/services/drawingService';
import { useBreadcrumbStore } from '@/store/useBreadcrumbStore';
import { DRAWING_SCHEMA_VERSION, type Drawing } from '@/types/drawing';
import { DrawingEditorProvider } from '@/components/drawing/DrawingEditorContext';
import { DrawingToolbar } from '@/components/drawing/DrawingToolbar';
import { AreaTabs } from '@/components/drawing/AreaTabs';
import { DrawingCanvas } from '@/components/drawing/DrawingCanvas';
import { PieceInspector } from '@/components/drawing/PieceInspector';
import { AreaSummary } from '@/components/drawing/AreaSummary';

function blankDrawing(salesOrderId: string): Drawing {
  return {
    schemaVersion: DRAWING_SCHEMA_VERSION,
    salesOrderId,
    version: 0,
    displayUnit: 'in',
    fractionDenominator: 32,
    areas: [{ id: crypto.randomUUID(), name: 'Area 1', code: '', sortOrder: 0, pieces: [], cabinets: [], notes: [] }],
    updatedAt: new Date().toISOString(),
    updatedBy: { id: '', name: '' },
  };
}

export default function SalesOrderDrawingPage() {
  const { id = '' } = useParams<{ id: string }>();
  const setLabel = useBreadcrumbStore((s) => s.setLabel);
  const clearLabel = useBreadcrumbStore((s) => s.clearLabel);

  const orderQuery = useQuery({
    queryKey: ['sales-order', id],
    queryFn: () => salesOrderService.getOrder(id),
    retry: false,
  });
  const drawingQuery = useQuery({
    queryKey: ['drawing', id],
    queryFn: () => drawingService.getDrawing(id),
    retry: false,
  });

  useEffect(() => {
    if (!orderQuery.data) return;
    setLabel(id, orderQuery.data.salesOrderNumber);
    return () => clearLabel(id);
  }, [id, orderQuery.data, setLabel, clearLabel]);

  if (orderQuery.isLoading || drawingQuery.isLoading) {
    return <p className="p-4 text-xs text-stone-500">Loading…</p>;
  }
  if (orderQuery.isError || !orderQuery.data) {
    return <p className="p-4 text-xs text-destructive">Failed to load the sales order.</p>;
  }

  const drawing = drawingQuery.data ?? blankDrawing(id);

  return (
    <DrawingEditorProvider drawing={drawing} materialLines={orderQuery.data.items}>
      <div className="flex h-full flex-col gap-2 p-2">
        <DrawingToolbar />
        <AreaTabs />
        <div className="flex flex-1 gap-2 overflow-hidden">
          <div className="flex-1">
            <DrawingCanvas />
          </div>
          <div className="w-64 shrink-0 overflow-y-auto border-l border-stone-200 pl-2">
            <PieceInspector />
          </div>
        </div>
        <AreaSummary />
      </div>
    </DrawingEditorProvider>
  );
}
