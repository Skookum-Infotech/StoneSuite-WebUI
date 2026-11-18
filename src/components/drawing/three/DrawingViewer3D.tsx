// The 3D view of the area being drawn: a read-only render of the same pieces the 2D
// board shows. Lazy-loaded (three.js is heavy), so the 2D editor never pays for it.

import { useCallback, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import type { ViewPreset } from '@/lib/drawing/three/cameraViews';
import { viewerNotices } from '@/lib/drawing/three/notices';
import { downloadBlob, snapshotFileName } from '@/lib/drawing/three/snapshot';
import { buildAreaSolids } from '@/lib/drawing/three/solids';
import { useDrawingEditor } from '../DrawingEditorContext';
import { useEdgeTypeList } from '../EdgeTypesContext';
import { useMaterialPicker } from '../MaterialPickerContext';
import { useSlabTextures } from './useSlabTextures';
import { ViewerScene, type CaptureFn, type ViewRequest } from './ViewerScene';
import { ViewPresetBar } from './ViewPresetBar';

/** Vertical field of view, in degrees. */
const CAMERA_FOV = 40;
const CAMERA_NEAR = 0.05;
const CAMERA_FAR = 200;

export function DrawingViewer3D() {
  const { state } = useDrawingEditor();
  const { slabTextures } = useMaterialPicker();
  const edgeTypes = useEdgeTypeList();
  const { areas } = state.present;
  // Slabs are shared by every area, so a piece's fit on its slab is judged against all pieces.
  const solids = useMemo(() => buildAreaSolids(
    areas.find((a) => a.id === state.activeAreaId),
    { allPieces: areas.flatMap((a) => a.pieces), photos: slabTextures, edgeTypes },
  ), [areas, state.activeAreaId, slabTextures, edgeTypes]);
  const photoUrls = useMemo(
    () => solids.pieces.flatMap((p) => (p.texture ? [p.texture.photoUrl] : [])),
    [solids],
  );
  const { textures, failed } = useSlabTextures(photoUrls);
  const notices = viewerNotices(solids, failed);
  const [view, setView] = useState<ViewRequest>({ preset: 'iso', nonce: 0 });
  const [capture, setCapture] = useState<CaptureFn | null>(null);
  // A function as state needs the updater form, or React would call it.
  const onCaptureReady = useCallback((fn: CaptureFn) => setCapture(() => fn), []);
  const areaName = areas.find((a) => a.id === state.activeAreaId)?.name ?? '';

  const pick = (preset: ViewPreset) => setView((v) => ({ preset, nonce: v.nonce + 1 }));
  const save = () => {
    capture?.().then((blob) => {
      if (blob) downloadBlob(snapshotFileName(areaName), blob);
    }).catch((error: unknown) => console.warn('3D view: could not save the picture.', error));
  };

  return (
    <div data-testid="drawing-viewer-3d" className="absolute inset-0 z-40 bg-stone-100">
      <Canvas camera={{ fov: CAMERA_FOV, near: CAMERA_NEAR, far: CAMERA_FAR }} dpr={[1, 2]}>
        <ViewerScene solids={solids} view={view} photos={textures} onCaptureReady={onCaptureReady} />
      </Canvas>
      {solids.pieces.length === 0 && (
        <p role="status" className="pointer-events-none absolute inset-x-0 top-1/2 text-center text-sm text-stone-500">
          Nothing to show yet — draw a piece in 2D first.
        </p>
      )}
      {notices.length > 0 && (
        <div role="status" className="absolute left-3 top-3 flex max-w-sm flex-col gap-1">
          {notices.map((notice) => (
            <p key={notice} className="rounded-md bg-amber-50 px-3 py-1.5 text-xs text-amber-900 shadow">{notice}</p>
          ))}
        </div>
      )}
      <ViewPresetBar onPick={pick} onSave={save} />
    </div>
  );
}
