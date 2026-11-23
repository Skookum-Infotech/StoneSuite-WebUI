// The Shape section's tabs per cutout type — fireplace (Arc | Rectangle),
// bathtub (Ellipse | Rectangle), other (Arc | Rectangle | Ellipse) — and what
// each choice does to the opening's outline.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Cutout, Drawing, Piece } from '@/types/drawing';

vi.mock('@/services/drawingService', () => ({
  drawingService: {
    listVersions: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    getEdgeCodes: vi.fn().mockResolvedValue([]),
    getCutoutTypes: vi.fn().mockResolvedValue([
      { code: 'sink', label: 'Sink' },
      { code: 'cooktop', label: 'Cooktop' },
      { code: 'fireplace', label: 'Fireplace' },
      { code: 'bathtub', label: 'Bathtub' },
      { code: 'other', label: 'Other' },
    ]),
  },
}));

import { CutoutPlacementLayer } from './CutoutPlacementLayer';
import { DrawingEditorProvider, useDrawingEditor } from './DrawingEditorContext';
import { WorkspacePanel } from './WorkspacePanel';
import { WorkspaceTabs } from './WorkspaceTabs';

const PIECE: Piece = {
  id: 'p1', label: 'A-1', shape: 'rect',
  outline: [{ x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: -2000 }, { x: 0, y: -2000 }],
  position: { x: 0, y: 0 }, rotationDeg: 0, thicknessMm: 30, edges: [], seams: [], cutouts: [],
};

const DRAWING: Drawing = {
  schemaVersion: 1, salesOrderId: 'so1', version: 0, displayUnit: 'in', fractionDenominator: 32,
  areas: [{ id: 'a1', name: 'Area 1', code: '', sortOrder: 0, pieces: [PIECE], cabinets: [], notes: [] }],
  updatedAt: '2026-11-16T00:00:00.000Z', updatedBy: { id: 'u1', name: 'Test' },
};

function Harness() {
  const { state, dispatch } = useDrawingEditor();
  return (
    <>
      <button type="button" onClick={() => dispatch({ type: 'selectPiece', pieceId: 'p1' })}>select piece</button>
      <span data-testid="cutouts">{JSON.stringify(state.present.areas[0].pieces[0].cutouts)}</span>
    </>
  );
}

const cutouts = (): Cutout[] => JSON.parse(screen.getByTestId('cutouts').textContent ?? '[]');

beforeEach(() => {
  vi.spyOn(SVGElement.prototype, 'getBoundingClientRect').mockReturnValue({
    left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600, x: 0, y: 0, toJSON: () => undefined,
  } as DOMRect);
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function openAddDialog(type?: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <DrawingEditorProvider drawing={DRAWING} materialLines={[]}>
        <WorkspaceTabs />
        <WorkspacePanel />
        <svg><CutoutPlacementLayer /></svg>
        <Harness />
      </DrawingEditorProvider>
    </QueryClientProvider>,
  );
  await userEvent.click(screen.getByRole('button', { name: 'select piece' }));
  await userEvent.click(screen.getByRole('tab', { name: 'Cutout' }));
  await userEvent.click(screen.getByRole('button', { name: 'Only Cutout' }));
  const dialog = await screen.findByRole('dialog');
  await within(dialog).findByLabelText('Cutout name');
  if (type) {
    await userEvent.click(within(dialog).getByRole('combobox', { name: 'Cutout type' }));
    await userEvent.click(await screen.findByRole('option', { name: type }));
  }
  return dialog;
}

async function saveAndPlace(dialog: HTMLElement) {
  await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
  fireEvent.click(screen.getByTestId('cutout-placement'), { clientX: 400 + 2000, clientY: 300 + 1000 });
}

const tabNames = (dialog: HTMLElement) => within(within(dialog).getByRole('tablist', { name: 'Outline' })).getAllByRole('tab').map((t) => t.textContent);

describe('shape tabs by type', () => {
  it.each([
    ['Fireplace', ['Arc', 'Rectangle']],
    ['Bathtub', ['Ellipse', 'Rectangle']],
    ['Other', ['Arc', 'Rectangle', 'Ellipse']],
  ])('%s offers %j', async (type, tabs) => {
    const dialog = await openAddDialog(type);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Change' }));
    expect(tabNames(dialog)).toEqual(tabs);
  });

  it.each(['Sink', 'Cooktop'])('%s has a single outline, so no tab strip', async (type) => {
    const dialog = await openAddDialog(type === 'Sink' ? undefined : type);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Change' }));
    expect(within(dialog).queryByRole('tablist', { name: 'Outline' })).toBeNull();
  });

  it('a cooktop offers No Picture and the five-burner Rectangle', async () => {
    const dialog = await openAddDialog('Cooktop');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Change' }));
    const names = within(within(dialog).getByRole('list', { name: 'Shapes' })).getAllByRole('button').map((b) => b.getAttribute('aria-label'));
    expect(names).toEqual(['No Picture', 'Rectangle']);
  });
});

describe('opening outlines', () => {
  it('a new fireplace opens on the Arc tab, so its No Picture is the arc', async () => {
    const dialog = await openAddDialog('Fireplace');
    expect(within(dialog).getByRole('img', { name: 'No picture, arc' })).toBeDefined();
    await saveAndPlace(dialog);
    expect(cutouts()[0]).toMatchObject({ type: 'fireplace', shape: 'arc' });
    expect(cutouts()[0]).not.toHaveProperty('shapeCode');
  });

  it('the Rectangle tab’s No Picture is a plain rectangle', async () => {
    const dialog = await openAddDialog('Fireplace');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Change' }));
    await userEvent.click(within(dialog).getByRole('tab', { name: 'Rectangle' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'No Picture' }));
    await saveAndPlace(dialog);
    expect(cutouts()[0]).toMatchObject({ shape: 'rect' });
  });

  it('the flame on the Arc tab keeps the arc outline and saves its code', async () => {
    const dialog = await openAddDialog('Fireplace');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Change' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Arc' }));
    await saveAndPlace(dialog);
    expect(cutouts()[0]).toMatchObject({ shape: 'arc', shapeCode: 'fireplace.arc' });
  });

  it('the same flame on the Rectangle tab is a rectangle opening', async () => {
    const dialog = await openAddDialog('Fireplace');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Change' }));
    await userEvent.click(within(dialog).getByRole('tab', { name: 'Rectangle' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Rectangle' }));
    await saveAndPlace(dialog);
    expect(cutouts()[0]).toMatchObject({ shape: 'rect', shapeCode: 'fireplace.rectangle' });
  });

  it('a bathtub opens on Ellipse; its Oval picture has the rounded-ends outline', async () => {
    const dialog = await openAddDialog('Bathtub');
    expect(within(dialog).getByRole('img', { name: 'No picture, ellipse' })).toBeDefined();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Change' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Oval' }));
    expect(within(dialog).getByLabelText('Length')).toHaveValue('60"');
    await saveAndPlace(dialog);
    expect(cutouts()[0]).toMatchObject({ type: 'bathtub', shape: 'stadium', shapeCode: 'bathtub.oval' });
  });

  it.each([['Arc', 'arc'], ['Rectangle', 'rect'], ['Ellipse', 'ellipse']] as const)(
    'other: the %s tab has only No Picture, which is that outline', async (tab, shape) => {
      const dialog = await openAddDialog('Other');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Change' }));
      await userEvent.click(within(dialog).getByRole('tab', { name: tab }));
      expect(within(within(dialog).getByRole('list', { name: 'Shapes' })).getAllByRole('button')).toHaveLength(1);
      await userEvent.click(within(dialog).getByRole('button', { name: 'No Picture' }));
      await saveAndPlace(dialog);
      expect(cutouts()[0]).toMatchObject({ type: 'other', shape });
    },
  );

  it('moving to a type without the current tab falls back to that type’s first tab', async () => {
    const dialog = await openAddDialog('Bathtub'); // Ellipse
    await userEvent.click(within(dialog).getByRole('combobox', { name: 'Cutout type' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Fireplace' }));
    expect(within(dialog).getByRole('img', { name: 'No picture, arc' })).toBeDefined();
  });
});

describe('editing keeps the outline', () => {
  it('reopens a cutout on the tab its outline belongs to', async () => {
    const dialog = await openAddDialog('Bathtub');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Change' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Oval' }));
    await saveAndPlace(dialog);
    await userEvent.click(screen.getByRole('button', { name: /Edit Cutout - Bathtub/ }));
    const edit = await screen.findByRole('dialog');
    await within(edit).findByLabelText('Cutout name');
    await userEvent.click(within(edit).getByRole('button', { name: 'Change' }));
    expect(within(edit).getByRole('tab', { name: 'Ellipse' })).toHaveAttribute('aria-selected', 'true');
    expect(within(edit).getByRole('button', { name: 'Oval' })).toHaveAttribute('aria-pressed', 'true');
  });
});
