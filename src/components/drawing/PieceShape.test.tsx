import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { Drawing } from '@/types/drawing';
import { DrawingEditorProvider, useDrawingEditor } from './DrawingEditorContext';
import { PieceShape } from './PieceShape';

function drawingWithOnePiece(): Drawing {
  return {
    schemaVersion: 1,
    salesOrderId: 'so1',
    version: 0,
    displayUnit: 'in',
    fractionDenominator: 32,
    areas: [{
      id: 'area-1',
      name: 'Area 1',
      code: '',
      sortOrder: 0,
      cabinets: [],
      notes: [],
      pieces: [{
        id: 'p1',
        label: 'A-1',
        shape: 'rect',
        outline: [{ x: 0, y: 0 }, { x: 600, y: 0 }, { x: 600, y: -400 }, { x: 0, y: -400 }],
        position: { x: 0, y: 0 },
        rotationDeg: 0,
        thicknessMm: 30,
        edges: [],
        seams: [],
        cutouts: [],
      }],
    }],
    updatedAt: '2026-11-03T00:00:00.000Z',
    updatedBy: { id: 'u1', name: 'Test User' },
  };
}

function Readout() {
  const { state } = useDrawingEditor();
  const piece = state.present.areas[0].pieces[0];
  return (
    <div>
      <span data-testid="pos-x">{piece.position.x}</span>
      <span data-testid="pos-y">{piece.position.y}</span>
      <span data-testid="past-length">{state.past.length}</span>
    </div>
  );
}

function renderPiece() {
  render(
    <DrawingEditorProvider drawing={drawingWithOnePiece()} materialLines={[]}>
      <svg>
        <PieceShape piece={drawingWithOnePiece().areas[0].pieces[0]} selected={false} />
      </svg>
      <Readout />
    </DrawingEditorProvider>,
  );
}

function mockSvgRect(width: number, height: number) {
  vi.spyOn(SVGElement.prototype, 'getBoundingClientRect').mockReturnValue({
    left: 0, top: 0, width, height, right: width, bottom: height, x: 0, y: 0, toJSON: () => undefined,
  } as DOMRect);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('PieceShape — border colour', () => {
  it('stays a sharp dark outline when selected, not brand green — green is reserved for one side at a time', () => {
    const piece = drawingWithOnePiece().areas[0].pieces[0];
    render(
      <DrawingEditorProvider drawing={drawingWithOnePiece()} materialLines={[]}>
        <svg>
          <PieceShape piece={piece} selected />
        </svg>
      </DrawingEditorProvider>,
    );
    const polygon = document.querySelector('polygon');
    expect(polygon?.getAttribute('class')).toContain('stroke-stone-900');
    expect(polygon?.getAttribute('class')).not.toContain('stroke-brand');
  });

  it('tints the inside of a selected piece so it stands out, without turning its border green', () => {
    const piece = drawingWithOnePiece().areas[0].pieces[0];
    render(
      <DrawingEditorProvider drawing={drawingWithOnePiece()} materialLines={[]}>
        <svg>
          <PieceShape piece={piece} selected />
        </svg>
      </DrawingEditorProvider>,
    );
    const classes = document.querySelector('polygon')?.getAttribute('class') ?? '';
    expect(classes).toContain('fill-brand/30');
    expect(classes).not.toContain('fill-stone-100');
  });

  it('draws the fill of a piece see-through, so a piece overlapping it still shows its own outline', () => {
    const piece = drawingWithOnePiece().areas[0].pieces[0];
    render(
      <DrawingEditorProvider drawing={drawingWithOnePiece()} materialLines={[]}>
        <svg>
          <PieceShape piece={piece} selected={false} />
        </svg>
      </DrawingEditorProvider>,
    );
    expect(document.querySelector('polygon')?.getAttribute('class')).toContain('fill-stone-100/70');
  });

  it('is a lighter, thinner outline when not selected', () => {
    const piece = drawingWithOnePiece().areas[0].pieces[0];
    render(
      <DrawingEditorProvider drawing={drawingWithOnePiece()} materialLines={[]}>
        <svg>
          <PieceShape piece={piece} selected={false} />
        </svg>
      </DrawingEditorProvider>,
    );
    const polygon = document.querySelector('polygon');
    expect(polygon?.getAttribute('class')).toContain('stroke-stone-400');
  });
});

describe('PieceShape drag', () => {
  beforeEach(() => {
    mockSvgRect(800, 600);
  });

  it('adds exactly one history entry for a whole drag, no matter how many pointermove events fire', () => {
    renderPiece();
    const piece = screen.getByRole('button', { name: /Piece A-1/ });
    expect(screen.getByTestId('past-length').textContent).toBe('0');

    fireEvent.pointerDown(piece, { pointerId: 1, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(piece, { pointerId: 1, clientX: 30, clientY: 0 });
    fireEvent.pointerMove(piece, { pointerId: 1, clientX: 60, clientY: 0 });
    fireEvent.pointerMove(piece, { pointerId: 1, clientX: 100, clientY: 0 });
    // No history pushed yet — only a visual preview during the drag.
    expect(screen.getByTestId('past-length').textContent).toBe('0');

    fireEvent.pointerUp(piece, { pointerId: 1 });
    expect(screen.getByTestId('past-length').textContent).toBe('1');
    // 100px at an 800-wide rect, zoom 1 -> 100mm, snapped to the nearest 25.4mm grid line -> 101.6.
    expect(Number(screen.getByTestId('pos-x').textContent)).toBeCloseTo(101.6, 5);
  });

  it('does not move the piece at all if the drag never crosses a grid line', () => {
    renderPiece();
    const piece = screen.getByRole('button', { name: /Piece A-1/ });
    fireEvent.pointerDown(piece, { pointerId: 1, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(piece, { pointerId: 1, clientX: 5, clientY: 0 });
    fireEvent.pointerUp(piece, { pointerId: 1 });
    expect(screen.getByTestId('past-length').textContent).toBe('0');
    expect(Number(screen.getByTestId('pos-x').textContent)).toBe(0);
  });
});

describe('PieceShape drag — rendered size correction', () => {
  it('converts the same pixel movement to a different mm distance when the SVG renders at half size', () => {
    mockSvgRect(400, 300); // half of the 800x600 viewBox
    renderPiece();
    const piece = screen.getByRole('button', { name: /Piece A-1/ });
    fireEvent.pointerDown(piece, { pointerId: 1, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(piece, { pointerId: 1, clientX: 50, clientY: 0 });
    fireEvent.pointerUp(piece, { pointerId: 1 });
    // 50px at a 400-wide rect (half-size) -> 100 viewbox units -> 100mm -> snapped to 101.6,
    // not the 50.8 a naive 1px=1unit assumption would have given.
    expect(Number(screen.getByTestId('pos-x').textContent)).toBeCloseTo(101.6, 5);
  });
});
