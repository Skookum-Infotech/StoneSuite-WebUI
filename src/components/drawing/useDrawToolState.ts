// What the Draw tool's bottom bar (DrawModeBar) is armed with: which shape a
// click on the canvas drops (Square or Circle — Points leaves the Draw tool
// for the editor's own point-by-point polygon tool, so it never needs a
// drawShape of its own), and Circle's own armed radius. Lives beside the
// editor's own state (see DrawingEditorContext), same as Border/Corner's own
// per-tool state.

import { useMemo, useState } from 'react';
import { DEFAULT_CIRCLE_RADIUS_MM } from '@/lib/drawing/constants';

export type DrawShape = 'square' | 'circle';

export interface DrawToolState {
  shape: DrawShape;
  setShape: (shape: DrawShape) => void;
  circleRadiusMm: number;
  setCircleRadiusMm: (radiusMm: number) => void;
}

export function useDrawToolState(): DrawToolState {
  const [shape, setShape] = useState<DrawShape>('square');
  const [circleRadiusMm, setCircleRadiusMm] = useState(DEFAULT_CIRCLE_RADIUS_MM);
  return useMemo(
    () => ({ shape, setShape, circleRadiusMm, setCircleRadiusMm }),
    [shape, circleRadiusMm],
  );
}
