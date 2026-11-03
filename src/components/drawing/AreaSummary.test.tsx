import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Drawing, Piece } from '@/types/drawing';
import { rectOutline } from '@/lib/drawing/geometry';
import { DrawingEditorProvider } from './DrawingEditorContext';
import { AreaSummary } from './AreaSummary';

const FT_TO_MM = 304.8;

function makePiece(id: string, label: string, lengthFt: number, widthFt: number): Piece {
  return {
    id,
    label,
    shape: 'rect',
    outline: rectOutline(lengthFt * FT_TO_MM, widthFt * FT_TO_MM),
    position: { x: 0, y: 0 },
    rotationDeg: 0,
    thicknessMm: 30,
    edges: [],
    seams: [],
    cutouts: [],
  };
}

function drawing(): Drawing {
  return {
    schemaVersion: 1,
    salesOrderId: 'so1',
    version: 0,
    displayUnit: 'in',
    fractionDenominator: 32,
    areas: [
      {
        id: 'area-1',
        name: 'Kitchen',
        code: '',
        sortOrder: 0,
        cabinets: [],
        notes: [],
        pieces: [makePiece('p1', 'A-1', 10, 2), makePiece('p2', 'A-2', 5, 2)],
      },
      { id: 'area-2', name: 'Island', code: '', sortOrder: 1, pieces: [], cabinets: [], notes: [] },
    ],
    updatedAt: '2026-11-03T00:00:00.000Z',
    updatedBy: { id: 'u1', name: 'Test User' },
  };
}

describe('AreaSummary', () => {
  it('shows the active area\'s piece count, its own sq ft, and the drawing-wide total', () => {
    render(
      <DrawingEditorProvider drawing={drawing()} materialLines={[]}>
        <AreaSummary />
      </DrawingEditorProvider>,
    );
    expect(screen.getByText('2 pieces')).toBeDefined();
    expect(screen.getByText('30 sq ft')).toBeDefined();
    expect(screen.getByText('30 sq ft total')).toBeDefined();
  });
});
