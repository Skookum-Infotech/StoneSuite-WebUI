// Where the 3D viewer's camera stands for each of its preset views. Pure maths on the
// bounds of the pieces, in scene units (metres), so the poses can be tested without WebGL.

import { CAMERA_DISTANCE_FACTOR, COUNTER_HEIGHT_MM, MM_TO_SCENE } from './constants';
import type { SolidsBounds } from './solids';

export type ViewPreset = 'iso' | 'top' | 'front';

export const VIEW_PRESETS: ReadonlyArray<{ id: ViewPreset; label: string }> = [
  { id: 'iso', label: 'Iso' },
  { id: 'top', label: 'Top' },
  { id: 'front', label: 'Front' },
];

export type Vec3 = [number, number, number];

export interface CameraPose {
  position: Vec3;
  target: Vec3;
}

/** Straight-down views are nudged this far off the vertical so the camera's "up"
 *  direction stays defined. */
const TOP_VIEW_TILT = 0.001;

export function cameraPose(preset: ViewPreset, bounds: SolidsBounds): CameraPose {
  // The editor's y-up becomes scene -z (see solids.ts), so "north" is away from the viewer.
  const target: Vec3 = [bounds.centerX * MM_TO_SCENE, COUNTER_HEIGHT_MM * MM_TO_SCENE, -bounds.centerY * MM_TO_SCENE];
  const distance = bounds.sizeMm * MM_TO_SCENE * CAMERA_DISTANCE_FACTOR;
  const offsets: Record<ViewPreset, Vec3> = {
    iso: [distance * 0.6, distance * 0.7, distance * 0.8],
    top: [0, distance, distance * TOP_VIEW_TILT],
    front: [0, distance * 0.25, distance],
  };
  const [dx, dy, dz] = offsets[preset];
  return { target, position: [target[0] + dx, target[1] + dy, target[2] + dz] };
}
