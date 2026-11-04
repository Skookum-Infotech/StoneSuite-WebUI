import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Drawing, Piece } from '@/types/drawing';
import type { SalesOrderLine } from '@/types/salesOrder';
import { DrawingEditorProvider, useDrawingEditor } from './DrawingEditorContext';
import { PieceInspector } from './PieceInspector';

function makePiece(id: string, label: string, overrides: Partial<Piece> = {}): Piece {
  return {
    id,
    label,
    shape: 'rect',
    outline: [{ x: 0, y: 0 }, { x: 600, y: 0 }, { x: 600, y: -400 }, { x: 0, y: -400 }],
    position: { x: 0, y: 0 },
    rotationDeg: 0,
    thicknessMm: 30,
    edges: [],
    seams: [],
    cutouts: [],
    ...overrides,
  };
}

function drawingWithPieces(pieces: Piece[]): Drawing {
  return {
    schemaVersion: 1,
    salesOrderId: 'so1',
    version: 0,
    displayUnit: 'in',
    fractionDenominator: 32,
    areas: [{ id: 'area-1', name: 'Area 1', code: '', sortOrder: 0, pieces, cabinets: [], notes: [] }],
    updatedAt: '2026-11-03T00:00:00.000Z',
    updatedBy: { id: 'u1', name: 'Test User' },
  };
}

const MATERIAL_LINES: SalesOrderLine[] = [
  { id: 'line-1', lineNumber: 1, sku: 'GRN-01', itemName: 'Granite Slab', description: '', unitCode: 'ea', quantity: 1, unitPrice: 0, discountPercent: 0, taxPercent: 0, lineSubtotal: 0, lineDiscount: 0, lineTax: 0, lineTotal: 0, fulfilledQuantity: 0, status: 'open' },
];

/** Selects the given piece by dispatching through context, same as a real
 *  click on PieceShape would. */
function Selector({ pieceId }: { pieceId: string }) {
  const { dispatch } = useDrawingEditor();
  return <button type="button" onClick={() => dispatch({ type: 'selectPiece', pieceId })}>select</button>;
}

function UndoButton() {
  const { dispatch } = useDrawingEditor();
  return <button type="button" onClick={() => dispatch({ type: 'undo' })}>undo</button>;
}

/** Exposes the real reducer state the inspector's buttons/fields are
 *  supposed to affect, so tests assert on actual behavior rather than the
 *  inspector's own (possibly stale) local echo of it. */
function Readout() {
  const { state } = useDrawingEditor();
  const area = state.present.areas[0];
  return (
    <div>
      <span data-testid="piece-count">{area.pieces.length}</span>
      <span data-testid="past-length">{state.past.length}</span>
      <span data-testid="pieces">{JSON.stringify(area.pieces.map((p) => ({ id: p.id, label: p.label, rotationDeg: p.rotationDeg, outline: p.outline })))}</span>
    </div>
  );
}

function renderInspector(pieces: Piece[], selectId?: string) {
  render(
    <DrawingEditorProvider drawing={drawingWithPieces(pieces)} materialLines={MATERIAL_LINES}>
      <PieceInspector />
      {selectId && <Selector pieceId={selectId} />}
      <UndoButton />
      <Readout />
    </DrawingEditorProvider>,
  );
}

describe('PieceInspector — no selection', () => {
  it('shows an empty state and no fields or action buttons', () => {
    renderInspector([makePiece('p1', 'A-1')]);
    expect(screen.getByText(/no piece selected/i)).toBeDefined();
    expect(screen.queryByLabelText('Label')).toBeNull();
    expect(screen.queryByRole('button', { name: /Rotate/ })).toBeNull();
  });
});

describe('PieceInspector — rect piece selected', () => {
  async function selectPiece() {
    await userEvent.click(screen.getByRole('button', { name: 'select' }));
  }

  it('shows editable Label/Length/Width/Thickness/Material-line/Corner-radius fields', async () => {
    renderInspector([makePiece('p1', 'A-1')], 'p1');
    await selectPiece();
    expect(screen.getByLabelText('Label')).not.toHaveAttribute('readonly');
    expect(screen.getByLabelText('Length')).not.toHaveAttribute('readonly');
    expect(screen.getByLabelText('Width')).not.toHaveAttribute('readonly');
    expect(screen.getByLabelText('Thickness')).not.toHaveAttribute('readonly');
    expect(screen.getByLabelText('Material line')).toBeDefined();
    expect(screen.getByLabelText('Corner radius')).not.toHaveAttribute('readonly');
  });

  it('typing a duplicate label shows an inline error and does not dispatch on blur', async () => {
    renderInspector([makePiece('p1', 'A-1'), makePiece('p2', 'A-2')], 'p1');
    await selectPiece();
    const labelInput = screen.getByLabelText('Label');
    await userEvent.clear(labelInput);
    await userEvent.type(labelInput, 'A-2');
    await userEvent.tab();
    expect(screen.getByText('A-2 is already used in this area.')).toBeDefined();
    expect(screen.getByLabelText('Label')).toHaveValue('A-2');
    // The actual reducer state must still have the piece's original label —
    // the error text alone doesn't prove the dispatch was refused.
    const pieces = JSON.parse(screen.getByTestId('pieces').textContent ?? '[]');
    expect(pieces.find((p: { id: string }) => p.id === 'p1').label).toBe('A-1');
  });

  it('trims surrounding whitespace before validating and storing a label', async () => {
    renderInspector([makePiece('p1', 'A-1'), makePiece('p2', 'A-2')], 'p1');
    await selectPiece();
    const labelInput = screen.getByLabelText('Label');
    await userEvent.clear(labelInput);
    await userEvent.type(labelInput, 'A-2 ');
    await userEvent.tab();
    // "A-2 " is the same label as the other piece's "A-2" once trimmed.
    expect(screen.getByText('A-2 is already used in this area.')).toBeDefined();
    const pieces = JSON.parse(screen.getByTestId('pieces').textContent ?? '[]');
    expect(pieces.find((p: { id: string }) => p.id === 'p1').label).toBe('A-1');
  });

  it('typing a valid new Length dispatches updatePiece with the resized outline', async () => {
    renderInspector([makePiece('p1', 'A-1')], 'p1');
    await selectPiece();
    const lengthInput = screen.getByLabelText('Length');
    await userEvent.clear(lengthInput);
    await userEvent.type(lengthInput, '30');
    await userEvent.tab();
    // Committing re-seeds the field from the piece (same fix that keeps it
    // from going stale after undo — see below), so it now reads back the
    // canonical formatted form rather than the raw typed text.
    expect(screen.getByLabelText('Length')).toHaveValue('30"');
    // Width (untouched) still shows its original value, formatted the same
    // way every other dimension in this app displays — 400mm rounds to the
    // nearest 1/32" as 15 3/4".
    expect(screen.getByLabelText('Width')).toHaveValue('15 3/4"');
    // And the actual reducer state has the resized outline — the input's
    // own text doesn't prove anything was dispatched.
    const pieces = JSON.parse(screen.getByTestId('pieces').textContent ?? '[]');
    const outline = pieces.find((p: { id: string }) => p.id === 'p1').outline;
    expect(outline[1].x).toBeCloseTo(30 * 25.4, 1); // the new length, in mm
    expect(outline[2].y).toBeCloseTo(-400, 1); // the original width, unchanged
  });

  it('tabbing through unchanged fields after an edit does not push extra history entries', async () => {
    renderInspector([makePiece('p1', 'A-1')], 'p1');
    await selectPiece();
    await userEvent.clear(screen.getByLabelText('Length'));
    await userEvent.type(screen.getByLabelText('Length'), '30');
    await userEvent.tab(); // commits Length -> past.length === 1
    expect(screen.getByTestId('past-length').textContent).toBe('1');

    // Tab/blur through the rest of the fields without changing them.
    await userEvent.tab();
    await userEvent.tab();
    await userEvent.tab();
    expect(screen.getByTestId('past-length').textContent).toBe('1');

    // So a single Undo now reverts the actual edit, not a phantom re-commit
    // of an untouched field.
    await userEvent.click(screen.getByRole('button', { name: 'undo' }));
    const pieces = JSON.parse(screen.getByTestId('pieces').textContent ?? '[]');
    expect(pieces.find((p: { id: string }) => p.id === 'p1').outline[1].x).toBeCloseTo(600, 1);
  });

  it('re-seeds every field from the piece when something else (e.g. undo) changes it underneath', async () => {
    renderInspector([makePiece('p1', 'A-1')], 'p1');
    await selectPiece();
    const lengthInput = screen.getByLabelText('Length');
    await userEvent.clear(lengthInput);
    await userEvent.type(lengthInput, '30');
    await userEvent.tab();
    expect(screen.getByLabelText('Length')).toHaveValue('30"');

    await userEvent.click(screen.getByRole('button', { name: 'undo' }));

    // The piece reverted; the field must show the reverted value, not the
    // undone "30" — and tabbing through it again must not silently
    // re-apply the undone edit.
    expect(screen.getByLabelText('Length')).toHaveValue('23 5/8"');
    await userEvent.click(screen.getByLabelText('Length'));
    await userEvent.tab();
    const pieces = JSON.parse(screen.getByTestId('pieces').textContent ?? '[]');
    expect(pieces.find((p: { id: string }) => p.id === 'p1').outline[1].x).toBeCloseTo(600, 1);
  });

  it('selecting a material line dispatches updatePiece with salesOrderLineId', async () => {
    renderInspector([makePiece('p1', 'A-1')], 'p1');
    await selectPiece();
    await userEvent.selectOptions(screen.getByLabelText('Material line'), 'line-1');
    expect(screen.getByLabelText('Material line')).toHaveValue('line-1');
  });

  it('Rotate/Duplicate/Delete buttons are aria-labeled with the piece\'s label', async () => {
    renderInspector([makePiece('p1', 'A-1')], 'p1');
    await selectPiece();
    expect(screen.getByRole('button', { name: 'Rotate A-1' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Duplicate A-1' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Delete A-1' })).toBeDefined();
  });

  it('Rotate rotates the piece 90°', async () => {
    renderInspector([makePiece('p1', 'A-1')], 'p1');
    await selectPiece();
    await userEvent.click(screen.getByRole('button', { name: 'Rotate A-1' }));
    const pieces = JSON.parse(screen.getByTestId('pieces').textContent ?? '[]');
    expect(pieces.find((p: { id: string }) => p.id === 'p1').rotationDeg).toBe(90);
  });

  it('Duplicate adds a second piece with the next free label', async () => {
    renderInspector([makePiece('p1', 'A-1')], 'p1');
    await selectPiece();
    await userEvent.click(screen.getByRole('button', { name: 'Duplicate A-1' }));
    expect(screen.getByTestId('piece-count').textContent).toBe('2');
    const pieces = JSON.parse(screen.getByTestId('pieces').textContent ?? '[]');
    expect(pieces.map((p: { label: string }) => p.label)).toEqual(['A-1', 'A-2']);
  });

  it('Delete removes the piece and clears the inspector', async () => {
    renderInspector([makePiece('p1', 'A-1')], 'p1');
    await selectPiece();
    await userEvent.click(screen.getByRole('button', { name: 'Delete A-1' }));
    expect(screen.getByText(/no piece selected/i)).toBeDefined();
  });

  it('Delete moves keyboard focus to the "no piece selected" message instead of stranding it', async () => {
    renderInspector([makePiece('p1', 'A-1')], 'p1');
    await selectPiece();
    await userEvent.click(screen.getByRole('button', { name: 'Delete A-1' }));
    expect(document.activeElement).toBe(screen.getByText(/no piece selected/i));
  });

  it('links an invalid field\'s error to the input via aria-describedby, and announces it as an alert', async () => {
    renderInspector([makePiece('p1', 'A-1'), makePiece('p2', 'A-2')], 'p1');
    await selectPiece();
    const labelInput = screen.getByLabelText('Label');
    await userEvent.clear(labelInput);
    await userEvent.type(labelInput, 'A-2');
    await userEvent.tab();
    const errorText = screen.getByText('A-2 is already used in this area.');
    expect(errorText).toHaveAttribute('role', 'alert');
    expect(labelInput.getAttribute('aria-describedby')).toBe(errorText.id);
  });
});

describe('PieceInspector — non-rect piece selected', () => {
  it('renders Length/Width as read-only, everything else editable', async () => {
    const lPiece = makePiece('p1', 'A-1', { shape: 'L', outline: [{ x: 0, y: 0 }, { x: 600, y: 0 }, { x: 600, y: -200 }, { x: 1000, y: -200 }, { x: 1000, y: -600 }, { x: 0, y: -600 }] });
    renderInspector([lPiece], 'p1');
    await userEvent.click(screen.getByRole('button', { name: 'select' }));
    expect(screen.getByLabelText('Length')).toHaveAttribute('readonly');
    expect(screen.getByLabelText('Width')).toHaveAttribute('readonly');
    expect(screen.getByLabelText('Thickness')).not.toHaveAttribute('readonly');
  });
});
