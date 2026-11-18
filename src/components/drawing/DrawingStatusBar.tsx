// The dock bar fixed to the bottom of the whole editor (SalesOrderDrawingPage
// renders it as a sibling of the canvas column and the Material/Cutout
// WorkspacePanel, not inside either, so opening that panel never resizes or
// repositions it — see SalesOrderDrawingPage.tsx): the active area (click it
// to open the Areas sidebar), its square footage (click to pin open the
// Countertop/Fabrication breakdown — it stays open until clicked again, not
// just while hovering), the zoom controls, and the Dimensions / Properties /
// Map on-off switches.

import { useState } from 'react';
import { Ruler } from 'lucide-react';
import { ZOOM_MAX, ZOOM_MIN, ZOOM_STEP } from '@/lib/drawing/constants';
import { areaMetrics, mm2ToSqFt } from '@/lib/drawing/metrics';
import { AreaSidebar } from './AreaSidebar';
import { AreaSummary } from './AreaSummary';
import { useDrawingEditor } from './DrawingEditorContext';

const SQ_FT_DECIMALS = 3;
const PERCENT = 100;

const BAR_BUTTON_CLASS = 'flex h-7 items-center justify-center rounded px-2.5 text-sm font-medium text-stone-200 hover:bg-stone-700 disabled:opacity-40 disabled:hover:bg-transparent aria-pressed:bg-brand aria-pressed:text-stone-900 aria-expanded:bg-brand aria-expanded:text-stone-900';

export function DrawingStatusBar() {
  const {
    state, dispatch, mapOpen, toggleMap, dimensionsOn, toggleDimensions, propertiesOpen, toggleProperties,
  } = useDrawingEditor();
  const [areasOpen, setAreasOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const activeArea = state.present.areas.find((a) => a.id === state.activeAreaId);
  const sqFt = mm2ToSqFt(areaMetrics(activeArea?.pieces ?? []).grossAreaMm2);

  return (
    <div className="absolute inset-x-0 bottom-0 z-30 flex items-center justify-between gap-2 bg-stone-900 px-2 py-1 text-white">
      {areasOpen && (
        <div className="absolute bottom-full left-0 z-30 mb-1">
          <AreaSidebar onClose={() => setAreasOpen(false)} />
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
        <div className="relative">
          {detailsOpen && (
            <div className="absolute bottom-full right-0 z-30 mb-1">
              <AreaSummary />
            </div>
          )}
          <button
            type="button"
            aria-label="Sq ft: Countertop and Fabrication by area and piece"
            aria-expanded={detailsOpen}
            onClick={() => setDetailsOpen((open) => !open)}
            className={`${BAR_BUTTON_CLASS} gap-1.5`}
          >
            <Ruler className="size-3.5" aria-hidden="true" />
            {sqFt.toFixed(SQ_FT_DECIMALS)} sq ft
          </button>
        </div>

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
          aria-label="Dimensions"
          aria-pressed={dimensionsOn}
          title="Toggle dimensions"
          onClick={toggleDimensions}
          className={BAR_BUTTON_CLASS}
        >
          Dimensions
        </button>

        <button
          type="button"
          aria-label="Properties"
          aria-pressed={propertiesOpen}
          title="Toggle properties panel"
          onClick={toggleProperties}
          className={BAR_BUTTON_CLASS}
        >
          Properties
        </button>

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
