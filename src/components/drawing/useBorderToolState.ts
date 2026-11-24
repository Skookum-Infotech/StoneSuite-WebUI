// What the Border tool is holding between clicks: which reshape is armed (Full
// Radius Out, Bump In ...), the numbers typed so far, and the side that was
// clicked and is waiting for Apply. Lives beside the editor's own state (see
// DrawingEditorContext) so the rail, the bottom bar and the canvas layer all
// see the same thing.

import { useMemo, useState } from 'react';
import {
  DEFAULT_BORDER_PARAMS, DEFAULT_BORDER_STYLE, type BorderParams, type BorderStyle,
} from '@/lib/drawing/borders';

export interface BorderTarget {
  pieceId: string;
  edgeIndex: number;
}

export interface BorderToolState {
  style: BorderStyle;
  setStyle: (style: BorderStyle) => void;
  params: BorderParams;
  setParams: (params: BorderParams) => void;
  /** The clicked side, or null — always null while the tool is not armed. */
  target: BorderTarget | null;
  setTarget: (target: BorderTarget | null) => void;
}

export function useBorderToolState(armed: boolean): BorderToolState {
  const [style, setStyle] = useState<BorderStyle>(DEFAULT_BORDER_STYLE);
  const [params, setParams] = useState<BorderParams>(DEFAULT_BORDER_PARAMS);
  const [pickedTarget, setTarget] = useState<BorderTarget | null>(null);
  // Switching style keeps the clicked side (the bar's icon row is how you
  // change your mind about what goes on it) and the numbers typed so far.
  const target = armed ? pickedTarget : null;
  return useMemo(
    () => ({ style, setStyle, params, setParams, target, setTarget }),
    [style, params, target],
  );
}
