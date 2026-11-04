// The DXF proof: before building the editor, confirm the one open-source
// read-side dependency the build spec names (dxf-parser) actually reads a
// real Stone Profit Systems export — not just our own writer's output.
// See src/test/fixtures/dxf/README.md for what this file told us.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { IPolylineEntity } from 'dxf-parser';
import DxfParser from 'dxf-parser';

const FIXTURE_PATH = join(import.meta.dirname, '..', '..', 'test', 'fixtures', 'dxf', 'SO_9073_Kitchen_P1.dxf');
const fixture = readFileSync(FIXTURE_PATH, 'utf8');

describe('dxf-parser reading a real SPS export', () => {
  it('parses the whole file without throwing', () => {
    const parser = new DxfParser();
    expect(() => parser.parseSync(fixture)).not.toThrow();
  });

  const parsed = new DxfParser().parseSync(fixture);

  it('recovers every top-level entity, including legacy POLYLINE/VERTEX', () => {
    const byType: Record<string, number> = {};
    for (const entity of parsed?.entities ?? []) byType[entity.type] = (byType[entity.type] ?? 0) + 1;
    expect(byType).toEqual({ POLYLINE: 6, TEXT: 20, LINE: 30, DIMENSION: 10 });
  });

  it('resolves vertices on every POLYLINE (not just the header)', () => {
    const polylines = (parsed?.entities ?? []).filter((e): e is IPolylineEntity => e.type === 'POLYLINE');
    for (const polyline of polylines) {
      expect(polyline.vertices.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('resolves the anonymous dimension block for every DIMENSION entity', () => {
    const dimensionBlockNames = [...Array(10).keys()].map((i) => `*D${i}`);
    for (const name of dimensionBlockNames) {
      expect(parsed?.blocks[name], `block ${name}`).toBeDefined();
    }
  });
});
