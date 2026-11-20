import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Drawing, Piece } from '@/types/drawing';
import type { DrawingSlabUnit } from '@/types/drawingSlab';
import { rectOutline } from './drawing/geometry';

vi.mock('@/services/companyProfileService', () => ({
  companyProfileService: { get: vi.fn().mockRejectedValue(new Error('no company in tests')) },
}));

const { buildDrawingPdf, drawingPdfFileName, EMPTY_DRAWING_MESSAGE } = await import('./drawingPdfExport');

function piece(id: string, patch: Partial<Piece> = {}): Piece {
  return {
    id, label: id, shape: 'rect', outline: rectOutline(1000, 500), position: { x: 0, y: 0 },
    rotationDeg: 0, thicknessMm: 30, edges: [], seams: [], cutouts: [], ...patch,
  };
}

function drawing(areas: Array<Piece[]>): Drawing {
  return {
    schemaVersion: 1, salesOrderId: 'so1', version: 0, displayUnit: 'in', fractionDenominator: 32,
    areas: areas.map((pieces, i) => ({ id: `a${i}`, name: `Area ${i + 1}`, code: '', sortOrder: i, cabinets: [], notes: [], pieces })),
    updatedAt: '2026-11-20T10:00:00Z', updatedBy: { id: 'u', name: 'U' },
  };
}

beforeEach(() => {
  // No real network in jsdom: the masthead's logo fetches reject and are caught inside it.
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('no network in tests')));
});

describe('drawingPdfFileName', () => {
  it.each([
    ['SO-0001', 'drawing-SO-0001.pdf'],
    ['SO 0001/2', 'drawing-SO-0001-2.pdf'],
    ['', 'drawing-order.pdf'],
  ])('names %j as %s', (orderNumber, expected) => {
    expect(drawingPdfFileName(orderNumber)).toBe(expected);
  });
});

describe('buildDrawingPdf', () => {
  const params = { orderNumber: 'SO-1', edgeTypes: [], profileTypes: [] };

  it('refuses a drawing with no pieces in any area', async () => {
    await expect(buildDrawingPdf({ ...params, drawing: drawing([[], []]) })).rejects.toThrow(EMPTY_DRAWING_MESSAGE);
  });

  it('makes one landscape page per area that has pieces and skips empty areas', async () => {
    const doc = await buildDrawingPdf({ ...params, drawing: drawing([[piece('A-1')], [], [piece('C-1'), piece('C-2')]]) });
    expect(doc.getNumberOfPages()).toBe(2);
    expect(doc.internal.pageSize.getWidth()).toBeGreaterThan(doc.internal.pageSize.getHeight());
  });

  it('adds a page for each slab that has pieces laid on it', async () => {
    const slab = { id: 's1', serial: 'SL-1', lengthMm: 3000, widthMm: 1500 } as DrawingSlabUnit;
    const placed = piece('A-1', { slab: { slabId: 's1', x: 0, y: 0, rotationDeg: 0 } });
    const doc = await buildDrawingPdf({ ...params, drawing: drawing([[placed]]), slabs: [slab] });
    expect(doc.getNumberOfPages()).toBe(2);
  });

  it('gives the pieces table more pages when it runs long', async () => {
    const many = Array.from({ length: 60 }, (_, i) => piece(`A-${i + 1}`));
    const doc = await buildDrawingPdf({ ...params, drawing: drawing([many]) });
    expect(doc.getNumberOfPages()).toBeGreaterThan(1);
  });
});
