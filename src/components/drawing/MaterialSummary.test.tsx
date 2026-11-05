// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Drawing, Piece } from '@/types/drawing';
import type { SalesOrderLine } from '@/types/salesOrder';
import { rectOutline } from '@/lib/drawing/geometry';
import { DrawingEditorProvider } from './DrawingEditorContext';
import { MaterialSummary } from './MaterialSummary';

const piece = (id: string, extra: Partial<Piece> = {}): Piece => ({
  id, label: id, shape: 'rect', outline: rectOutline(3048, 609.6), position: { x: 0, y: 0 }, rotationDeg: 0, // 10 ft x 2 ft
  thicknessMm: 30, edges: [], seams: [], cutouts: [], ...extra,
});
const line = { id: 'L1', sku: 'GRN-01', itemName: 'Granite', unitCode: 'SQFT', quantity: 25 } as SalesOrderLine;

function show(pieces: Piece[]) {
  const drawing: Drawing = {
    schemaVersion: 1, salesOrderId: 's', version: 0, displayUnit: 'mm', fractionDenominator: 32,
    areas: [{ id: 'a', name: 'A', code: '', sortOrder: 0, pieces, cabinets: [], notes: [] }],
    updatedAt: '', updatedBy: { id: 'u', name: 'U' },
  };
  render(<DrawingEditorProvider drawing={drawing} materialLines={[line]}><MaterialSummary /></DrawingEditorProvider>);
}

describe('MaterialSummary', () => {
  it('shows nothing for an empty drawing', () => {
    show([]);
    expect(screen.queryByRole('region', { name: 'Materials' })).toBeNull();
  });
  it('shows area against the ordered quantity, including backsplash', () => {
    show([piece('p1', { salesOrderLineId: 'L1', edges: [{ index: 0, splashHeightMm: 101.6 }] })]);
    expect(screen.getByText('GRN-01 — Granite')).toBeTruthy();
    expect(screen.getByText('1 piece · 23.3 sq ft')).toBeTruthy(); // 20 + 10 ft x 4 in = 3.3
    expect(screen.getByText('Ordered 25.0 sq ft')).toBeTruthy();
  });
  it('prompts for a material line when pieces have none', () => {
    show([piece('p1')]);
    expect(screen.getByText('Choose a material line for these pieces.')).toBeTruthy();
  });
});
