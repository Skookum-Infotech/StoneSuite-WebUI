// The drawing board: the 2D canvas with its tool bars, or the 3D view in its place. The board
// takes the whole width; the tool rail and the 2D/3D button float over its left edge. In 3D
// the tools are hidden, since the 3D view is for looking, not drawing.

import { lazy, Suspense, useState } from 'react';
import { cn } from '@/lib/utils';
import { BorderModeBar } from './BorderModeBar';
import { CornerModeBar } from './CornerModeBar';
import { DrawingCanvas } from './DrawingCanvas';
import { DrawModeBar } from './DrawModeBar';
import { EdgeModeBar } from './EdgeModeBar';
import { ProfileModeBar } from './ProfileModeBar';
import { InspectorPanel } from './InspectorPanel';
import { MiniMap } from './MiniMap';
import { TextControls } from './TextControls';
import { ToolRail } from './ToolRail';
import { ViewModeToggle, type ViewMode } from './ViewModeToggle';

// three.js is heavy: it is only fetched the first time someone switches to 3D.
const DrawingViewer3D = lazy(() => import('./three/DrawingViewer3D').then((m) => ({ default: m.DrawingViewer3D })));

export function DrawingBoard() {
  const [viewMode, setViewMode] = useState<ViewMode>('2d');
  const is3d = viewMode === '3d';

  return (
    <div className="relative min-h-0 min-w-0 flex-1">
      {/* Stays mounted under the 3D view so its zoom, pan and selection survive a round trip.
          Hidden and inert meanwhile: no shortcuts, no focus, and none of its bars show. */}
      <div className={cn('absolute inset-0', is3d && 'invisible')} inert={is3d}>
        <DrawingCanvas />
        <DrawModeBar />
        <BorderModeBar />
        <CornerModeBar />
        <EdgeModeBar />
        <ProfileModeBar />
        <TextControls />
        <MiniMap />
        <InspectorPanel />
      </div>
      {is3d && (
        <Suspense
          fallback={(
            <p role="status" className="absolute inset-0 z-10 grid place-items-center bg-stone-100 text-xs text-stone-500">
              Loading 3D view…
            </p>
          )}
        >
          <DrawingViewer3D />
        </Suspense>
      )}
      <div className="absolute left-3 top-3 z-20 flex flex-col items-start gap-2">
        <ViewModeToggle mode={viewMode} onChange={setViewMode} />
        {!is3d && <ToolRail />}
      </div>
    </div>
  );
}
