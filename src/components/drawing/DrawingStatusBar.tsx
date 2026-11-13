// The bar along the bottom of the editor: the active area (click it to open
// the Areas sidebar), its square footage, the zoom controls, and the map
// on/off switch.

import { useState } from 'react';
import { ZOOM_MAX, ZOOM_MIN, ZOOM_STEP } from '@/lib/drawing/constants';
import { areaMetrics, mm2ToSqFt } from '@/lib/drawing/metrics';
import { AreaSidebar } from './AreaSidebar';
import { AreaSummary } from './AreaSummary';
import { useDrawingEditor } from './DrawingEditorContext';

const SQ_FT_DECIMALS = 3;
const PERCENT = 100;

const BAR_BUTTON_CLASS = 'flex h-8 items-center justify-center rounded-md px-2.5 text-sm font-medium text-stone-200 hover:bg-stone-700 disabled:opacity-40 disabled:hover:bg-transparent aria-pressed:bg-brand aria-pressed:text-stone-900 aria-expanded:bg-brand aria-expanded:text-stone-900';

export function DrawingStatusBar() {
  const { state, dispatch, mapOpen, toggleMap } = useDrawingEditor();
  const [areasOpen, setAreasOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const activeArea = state.present.areas.find((a) => a.id === state.activeAreaId);
  const sqFt = mm2ToSqFt(areaMetrics(activeArea?.pieces ?? []).grossAreaMm2);

  return (
    <div className="relative flex items-center justify-between gap-2 rounded-lg bg-stone-900 px-2 py-1.5 text-white">
      {areasOpen && (
        <div className="absolute bottom-full left-0 z-30 mb-2">
          <AreaSidebar onClose={() => setAreasOpen(false)} />
        </div>
      )}
      {detailsOpen && (
        <div className="absolute bottom-full right-0 z-30 mb-2 rounded-lg bg-white p-3 shadow-xl">
          <AreaSummary />
        </div>
      )}

      <button
        type="button"
        aria-label={`Areas, ${activeArea?.name ?? 'none'} selected`}
        aria-expanded={areasOpen}
        onClick={() => setAreasOpen((open) => !open)}
        className={`${BAR_BUTTON_CLASS} gap-2`}
      >
        <span aria-hidden="true">☰</span>
        <span>{activeArea?.name ?? 'Area'}</span>
      </button>

      <div className="flex items-center gap-2">
        <span className="flex items-center gap-1 text-sm font-semibold">
          {sqFt.toFixed(SQ_FT_DECIMALS)} sq ft
          <button
            type="button"
            aria-label="Area details"
            aria-expanded={detailsOpen}
            onClick={() => setDetailsOpen((open) => !open)}
            className="flex h-5 w-5 items-center justify-center rounded-full text-xs text-stone-300 hover:bg-stone-700 aria-expanded:bg-brand aria-expanded:text-stone-900"
          >
            i
          </button>
        </span>

        <div role="group" aria-label="Zoom" className="flex items-center rounded-md border border-stone-700">
          <button
            type="button"
            aria-label="Zoom out"
            disabled={state.zoom <= ZOOM_MIN}
            onClick={() => dispatch({ type: 'zoomView', factor: 1 - ZOOM_STEP })}
            className={BAR_BUTTON_CLASS}
          >
            −
          </button>
          <span aria-label="Zoom level" className="min-w-12 text-center text-sm tabular-nums">
            {Math.round(state.zoom * PERCENT)}%
          </span>
          <button
            type="button"
            aria-label="Zoom in"
            disabled={state.zoom >= ZOOM_MAX}
            onClick={() => dispatch({ type: 'zoomView', factor: 1 + ZOOM_STEP })}
            className={BAR_BUTTON_CLASS}
          >
            +
          </button>
        </div>

        <button
          type="button"
          aria-label="Map"
          aria-pressed={mapOpen}
          title="Toggle Map (M)"
          onClick={toggleMap}
          className={BAR_BUTTON_CLASS}
        >
          Map
        </button>
      </div>
    </div>
  );
}
