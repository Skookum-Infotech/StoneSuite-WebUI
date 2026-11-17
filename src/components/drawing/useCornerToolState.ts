// What the Corner tool is holding between clicks: which change is armed (Clip,
// Radius ...), the numbers typed so far, and the corner that was clicked and is
// waiting for Apply. Lives beside the editor's own state (see
// DrawingEditorContext) so the rail, the bottom bar and the canvas layer all
// see the same thing.

import { useMemo, useState } from 'react';
import {
  DEFAULT_CORNER_PARAMS, DEFAULT_CORNER_STYLE, type CornerParams, type CornerStyle,
} from '@/lib/drawing/corners';

export interface CornerTarget {
  pieceId: string;
  vertexIndex: number;
}

export interface CornerToolState {
  style: CornerStyle;
  setStyle: (style: CornerStyle) => void;
  params: CornerParams;
  setParams: (params: CornerParams) => void;
  /** The clicked corner, or null — always null while the tool is not armed. */
  target: CornerTarget | null;
  setTarget: (target: CornerTarget | null) => void;
}

export function useCornerToolState(armed: boolean): CornerToolState {
  const [style, setStyle] = useState<CornerStyle>(DEFAULT_CORNER_STYLE);
  const [params, setParams] = useState<CornerParams>(DEFAULT_CORNER_PARAMS);
  const [pickedTarget, setTarget] = useState<CornerTarget | null>(null);
  // Switching style keeps the clicked corner and the numbers typed so far.
  const target = armed ? pickedTarget : null;
  return useMemo(
    () => ({ style, setStyle, params, setParams, target, setTarget }),
    [style, params, target],
  );
}
