// The countertop drawing editor's own full-screen page, at
// /sales/sales_order/:id/drawing. Loads the order (for the breadcrumb and
// the inspector's material-line list) and any saved drawing — falling back
// to a blank one when none exists yet. Autosaves 3s after each change (or
// immediately on Ctrl/Cmd+S), with a conflict dialog on a 409 and a
// beforeunload guard while a save is pending (build spec §5 Task 5).

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { salesOrderService } from '@/services/salesOrderService';
import { drawingService } from '@/services/drawingService';
import { useBreadcrumbStore } from '@/store/useBreadcrumbStore';
import { DRAWING_SCHEMA_VERSION, type Drawing } from '@/types/drawing';
import type { SalesOrder } from '@/types/salesOrder';
import { DrawingEditorProvider, useDrawingEditor } from '@/components/drawing/DrawingEditorContext';
import { DrawingToolbar } from '@/components/drawing/DrawingToolbar';
import { AreaTabs } from '@/components/drawing/AreaTabs';
import { DrawingCanvas } from '@/components/drawing/DrawingCanvas';
import { PieceInspector } from '@/components/drawing/PieceInspector';
import { AreaSummary } from '@/components/drawing/AreaSummary';
import { ConflictDialog } from '@/components/drawing/ConflictDialog';
import { SquareFootageBanner } from '@/components/drawing/SquareFootageBanner';
import { useDrawingAutosave } from '@/components/drawing/useDrawingAutosave';
import { useFillViewport } from '@/hooks/useFillViewport';

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
  const queryClient = useQueryClient();

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
  if (!orderQuery.data) {
    return <p className="p-4 text-xs text-destructive">Failed to load the sales order.</p>;
  }
  // drawingQuery.data is `null` on a real, successful "no drawing saved
  // yet" (404) — that's the only case that falls back to a blank drawing.
  // An actual fetch error must surface, not be swallowed into a blank
  // editor the user could then build on and lose (found in the final
  // review).
  if (drawingQuery.isError) {
    return <p className="p-4 text-xs text-destructive">Failed to load the drawing.</p>;
  }

  const drawing = drawingQuery.data ?? blankDrawing(id);

  return (
    <DrawingEditorProvider drawing={drawing} materialLines={orderQuery.data.items}>
      <DrawingEditorBody
        salesOrderId={id}
        order={orderQuery.data}
        onOrderUpdated={(updated) => queryClient.setQueryData(['sales-order', id], updated)}
      />
    </DrawingEditorProvider>
  );
}

function DrawingEditorBody({ salesOrderId, order, onOrderUpdated }: {
  salesOrderId: string; order: SalesOrder; onOrderUpdated: (order: SalesOrder) => void;
}) {
  const { state, dispatch } = useDrawingEditor();
  const [conflictOpen, setConflictOpen] = useState(false);
  const fillRef = useFillViewport<HTMLDivElement>();

  const onSaved = useCallback((saved: Drawing) => {
    dispatch({ type: 'drawingSaved', version: saved.version, updatedAt: saved.updatedAt, updatedBy: saved.updatedBy });
  }, [dispatch]);
  const onConflict = useCallback(() => setConflictOpen(true), []);

  // Narrowed to just the drawable content, and memoized on it — a
  // successful save (the `drawingSaved` action) replaces `state.present`
  // wholesale to update version/updatedAt/updatedBy, but keeps `areas`'s
  // own reference unchanged. Passing `state.present` itself here would make
  // every post-save re-render look like a fresh edit to the debounce
  // effect (keyed on reference equality), re-triggering it forever.
  const { areas, displayUnit, fractionDenominator } = state.present;
  const presentForAutosave = useMemo(
    () => ({ areas, displayUnit, fractionDenominator }),
    [areas, displayUnit, fractionDenominator],
  );

  const { status } = useDrawingAutosave({
    salesOrderId,
    present: presentForAutosave,
    recordVersion: state.present.version,
    onSaved,
    onConflict,
    paused: conflictOpen,
  });

  // Warn before leaving with unsaved changes (build spec §5 Task 5) — not
  // once a save has actually landed.
  useEffect(() => {
    if (status !== 'dirty' && status !== 'saving') return undefined;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [status]);

  const reloadLatest = () => {
    setConflictOpen(false);
    drawingService.getDrawing(salesOrderId).then((latest) => {
      if (latest) dispatch({ type: 'loadDrawing', drawing: latest });
    });
  };

  // The deliberate escape hatch the spec names: force the local edits
  // through as the new current version anyway. Learns the server's actual
  // current version first (the 409 body doesn't carry it) and sends it as
  // this save's own recordVersion directly — calling the autosave hook's
  // saveNow() right after a dispatch would race its own ref-mirror effect,
  // which only picks up the new version on the next render, not this tick.
  const saveAsCopy = () => {
    setConflictOpen(false);
    drawingService
      .getDrawing(salesOrderId)
      .then((latest) => drawingService.saveDrawing(salesOrderId, {
        areas: state.present.areas,
        displayUnit: state.present.displayUnit,
        fractionDenominator: state.present.fractionDenominator,
        recordVersion: latest?.version ?? state.present.version,
      }))
      .then(onSaved);
  };

  return (
    <div
      ref={fillRef}
      data-testid="drawing-editor"
      className="flex h-[calc(100dvh-var(--fill-top))] flex-col gap-2 overflow-hidden p-2"
    >
      <DrawingToolbar saveStatus={status} />
      <AreaTabs />
      <SquareFootageBanner areas={state.present.areas} order={order} onLineUpdated={onOrderUpdated} />
      <div className="flex min-h-0 flex-1 gap-2">
        <div className="min-h-0 min-w-0 flex-1">
          <DrawingCanvas />
        </div>
        <div className="w-64 shrink-0 overflow-y-auto border-l border-stone-200 pl-2">
          <PieceInspector />
        </div>
      </div>
      <AreaSummary />
      {conflictOpen && (
        <ConflictDialog onReloadLatest={reloadLatest} onSaveAsCopy={saveAsCopy} onClose={() => setConflictOpen(false)} />
      )}
    </div>
  );
}
