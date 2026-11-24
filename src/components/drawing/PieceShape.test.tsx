import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';import type { Drawing } from '@/types/drawing';
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

function GoToCutoutTab() {
  const { setWorkspace } = useDrawingEditor();
  return <button type="button" onClick={() => setWorkspace('cutout')}>cutout tab</button>;
}

function renderPiece() {
  render(
    <DrawingEditorProvider drawing={drawingWithOnePiece()} materialLines={[]}>
      <GoToCutoutTab />
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
    expect(document.querySelector('polygon')?.getAttribute('class')).toContain('fill-white/70');
  });

  it('gives an unselected piece the same outline colour and weight as a selected one, with a white inside', () => {
    const piece = drawingWithOnePiece().areas[0].pieces[0];
    const outlineOf = (selected: boolean) => {
      const { unmount } = render(
        <DrawingEditorProvider drawing={drawingWithOnePiece()} materialLines={[]}>
          <svg>
            <PieceShape piece={piece} selected={selected} />
          </svg>
        </DrawingEditorProvider>,
      );
      const polygon = document.querySelector('polygon');
      const result = { classes: polygon?.getAttribute('class') ?? '', width: polygon?.getAttribute('stroke-width') };
      unmount();
      return result;
    };
    const selected = outlineOf(true);
    const unselected = outlineOf(false);
    expect(unselected.classes).toContain('stroke-stone-900');
    expect(unselected.width).toBe(selected.width);
    expect(unselected.classes).toContain('fill-white');
    expect(unselected.classes).not.toContain('fill-brand');
  });
});

describe('PieceShape — name', () => {
  it('puts the name in plain large text just outside the top-left corner, clear of the outline, with no highlight', () => {
    const piece = drawingWithOnePiece().areas[0].pieces[0];
    render(
      <DrawingEditorProvider drawing={drawingWithOnePiece()} materialLines={[]}>
        <svg>
          <PieceShape piece={piece} selected={false} />
        </svg>
      </DrawingEditorProvider>,
    );
    const text = screen.getByText(piece.label);
    expect(text.getAttribute('class')).not.toContain('brand');
    expect(text.previousElementSibling?.tagName).not.toBe('rect');
    const points = (document.querySelector('polygon')?.getAttribute('points') ?? '')
      .split(' ').map((pair) => pair.split(',').map(Number));
    const left = Math.min(...points.map(([x]) => x));
    const top = Math.min(...points.map(([, y]) => y));
    // Sits above the piece (so it never touches the border), starting at its
    // left edge.
    expect(Number(text.getAttribute('y'))).toBeLessThan(top);
    expect(Number(text.getAttribute('x'))).toBeCloseTo(left);
  });

  it('stands further out while dimensions are on, so it clears the top dimension line', () => {
    const piece = drawingWithOnePiece().areas[0].pieces[0];
    const gapWith = (dimensionsOn: boolean) => {
      function Toggle() {
        const { dimensionsOn: on, toggleDimensions } = useDrawingEditor();
        if (dimensionsOn && !on) toggleDimensions();
        return null;
      }
      const { unmount } = render(
        <DrawingEditorProvider drawing={drawingWithOnePiece()} materialLines={[]}>
          <Toggle />
          <svg>
            <PieceShape piece={piece} selected={false} />
          </svg>
        </DrawingEditorProvider>,
      );
      const name = screen.getByText(piece.label);
      const top = Math.min(...(document.querySelector('polygon')?.getAttribute('points') ?? '')
        .split(' ').map((pair) => Number(pair.split(',')[1])));
      const gap = top - Number(name.getAttribute('y'));
      unmount();
      return gap;
    };
    expect(gapWith(true)).toBeGreaterThan(gapWith(false));
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

describe('PieceShape in the Cutout tab', () => {
  beforeEach(() => {
    mockSvgRect(800, 600);
  });

  it('can be picked but not dragged: only cutouts are edited there', () => {
    renderPiece();
    fireEvent.click(screen.getByRole('button', { name: 'cutout tab' }));
    const piece = screen.getByRole('button', { name: /Piece A-1/ });
    fireEvent.pointerDown(piece, { pointerId: 1, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(piece, { pointerId: 1, clientX: 100, clientY: 0 });
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
