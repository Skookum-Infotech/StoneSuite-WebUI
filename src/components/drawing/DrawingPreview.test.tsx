import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Drawing, Piece } from '@/types/drawing';

import { DrawingPreview } from './DrawingPreview';

function piece(id: string, label: string): Piece {
  return {
    id, label, shape: 'rect',
    outline: [{ x: 0, y: 0 }, { x: 600, y: 0 }, { x: 600, y: -400 }, { x: 0, y: -400 }],
    position: { x: 0, y: 0 }, rotationDeg: 0, thicknessMm: 30, edges: [], seams: [], cutouts: [],
  };
}

function drawing(overrides: Partial<Drawing> = {}): Drawing {
  return {
    schemaVersion: 1, salesOrderId: 'so1', version: 1, displayUnit: 'in', fractionDenominator: 32,
    areas: [{ id: 'a1', name: 'Kitchen', code: '', sortOrder: 0, pieces: [piece('p1', 'A-1')], cabinets: [], notes: [] }],
    updatedAt: '2026-11-03T00:00:00.000Z', updatedBy: { id: 'u1', name: 'Test User' },
    ...overrides,
  };
}

describe('DrawingPreview', () => {
  it('renders each area\'s name and its pieces\' labels', () => {
    render(<DrawingPreview drawing={drawing()} />);
    expect(screen.getByText('Kitchen')).toBeDefined();
    expect(screen.getByText('A-1')).toBeDefined();
  });

  it('renders pieces as non-interactive SVG — no role=button, no tabIndex, no pointer handlers', () => {
    const { container } = render(<DrawingPreview drawing={drawing()} />);
    expect(container.querySelector('[role="button"]')).toBeNull();
    expect(container.querySelector('[tabindex]')).toBeNull();
    // Every piece's own group is non-interactive, marked aria-hidden since
    // there is nothing for assistive tech to act on here.
    expect(container.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
  });

  it('an area with no pieces shows an empty note instead of a blank canvas', () => {
    render(<DrawingPreview drawing={drawing({ areas: [{ id: 'a1', name: 'Empty Area', code: '', sortOrder: 0, pieces: [], cabinets: [], notes: [] }] })} />);
    expect(screen.getByText('Empty Area')).toBeDefined();
    expect(screen.getByText(/no pieces/i)).toBeDefined();
  });
});
