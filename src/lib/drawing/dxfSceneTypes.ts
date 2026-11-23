// What the viewer needs from a parsed DXF, with no dependency on the parser
// itself, which stays in the worker's chunk (see dxfScene.worker.ts).

export type DxfPath = { d: string; dashed: boolean; filled: boolean };
export type DxfTextAnchor = 'start' | 'middle' | 'end';
export type DxfTextBaseline = 'auto' | 'middle' | 'hanging' | 'text-after-edge';
export type DxfText = {
  text: string; x: number; y: number; height: number; rotationDeg: number;
  anchor: DxfTextAnchor; baseline: DxfTextBaseline;
};
export type DxfBounds = { minX: number; minY: number; maxX: number; maxY: number };

/** In SVG screen space: y already flipped. Shapes of one style share a path. */
export type DxfScene = {
  paths: DxfPath[];
  texts: DxfText[];
  bounds: DxfBounds;
  /** Entity type → how many could not be drawn. */
  unsupported: Record<string, number>;
};

export class DxfUnreadableError extends Error {
  constructor(message = 'This file could not be read as a DXF.') {
    super(message);
    this.name = 'DxfUnreadableError';
  }
}

export class DxfTooComplexError extends Error {
  constructor(message = 'This drawing is too large to preview.') {
    super(message);
    this.name = 'DxfTooComplexError';
  }
}
