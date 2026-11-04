// Generic ASCII-DXF group-code formatting, handle allocation, and the 2D
// point math the dimension-block builder needs. Shared by dxfWriter.ts and
// dxfDimensionBlock.ts — neither file hand-rolls this twice.

import type { Point } from '@/types/drawing';

export type DxfValue = string | number;

function formatCode(code: number): string {
  const text = String(code);
  return text.length >= 3 ? text : ' '.repeat(3 - text.length) + text;
}

/** One (code, value) line pair, CRLF-terminated to match the real SPS
 *  sample's line endings. */
export function pair(code: number, value: DxfValue): string {
  return `${formatCode(code)}\r\n${value}\r\n`;
}

/** Allocates small, unique hex handles (DXF group codes 5/105/330).
 *  Handles only need to be unique within the file — nothing reads their
 *  value. */
export class HandleAllocator {
  private next = 1;
  alloc(): string {
    const handle = this.next.toString(16).toUpperCase();
    this.next += 1;
    return handle;
  }
}

export function addPoint(a: Point, b: Point): Point {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function scalePoint(p: Point, factor: number): Point {
  return { x: p.x * factor, y: p.y * factor };
}
