// The Material tab end to end against the real reducer: add a slab from Inventory
// (which reserves it for the order), lay a piece on it with Select Pieces, see
// whether it fits, and give the slab back.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AttachedProfileType, Drawing, Piece } from '@/types/drawing';
import type { DrawingSlabItem, DrawingSlabUnit } from '@/types/drawingSlab';
import { makeUnit } from '@/pages/inventory/unit/components/unitFixtures';

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('@/services/drawingService', () => ({
  drawingService: {
    listVersions: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    getEdgeCodes: vi.fn().mockResolvedValue([]),
    getCutoutTypes: vi.fn().mockResolvedValue([]),
    getAttachedProfileTypes: vi.fn().mockResolvedValue([]),
  },
}));
vi.mock('@/services/drawingSlabService', () => ({
  drawingSlabService: { listOptions: vi.fn(), hold: vi.fn(), release: vi.fn() },
}));

import { drawingService } from '@/services/drawingService';
import { drawingSlabService } from '@/services/drawingSlabService';
import { AttachedProfilePieces } from './AttachedProfilePieces';
import { AttachedProfileTypesProvider } from './AttachedProfileTypesContext';
import { DrawingEditorProvider, useDrawingEditor } from './DrawingEditorContext';
import { DrawingToolbar } from './DrawingToolbar';
import { MaterialPickerProvider } from './MaterialPickerContext';
import { PieceShape } from './PieceShape';
import { WorkspacePanel } from './WorkspacePanel';

const BACKSPLASH: AttachedProfileType = {
  id: 'bs1', name: 'Backsplash', pricingType: 'linear', price: 12, alias: 'BS', color: '#2563eb',
  measurementPresetsMm: [101.6], angle: 90, finish: 'none', isSystem: true,
};

const ORDER = 'so1';

function rectPiece(width: number, height: number): Piece {
  return {
    id: 'p1', label: 'A-1', shape: 'rect',
    outline: [{ x: 0, y: 0 }, { x: width, y: 0 }, { x: width, y: -height }, { x: 0, y: -height }],
    position: { x: 0, y: 0 }, rotationDeg: 0, thicknessMm: 30, edges: [], seams: [], cutouts: [],
  };
}

/** A piece with a Backsplash painted onto side A, so its own profile piece
 *  can be laid on a slab independently of the parent. */
function rectPieceWithProfile(width: number, height: number): Piece {
  return {
    ...rectPiece(width, height),
    edges: [{ index: 0, attachedProfile: { profileTypeId: BACKSPLASH.id, measurementMm: BACKSPLASH.measurementPresetsMm[0] } }],
  };
}

function drawingWith(piece: Piece): Drawing {
  return {
    schemaVersion: 1, salesOrderId: ORDER, version: 0, displayUnit: 'in', fractionDenominator: 32,
    areas: [{ id: 'area-1', name: 'Area 1', code: '', sortOrder: 0, pieces: [piece], cabinets: [], notes: [] }],
    updatedAt: '2026-11-17T00:00:00.000Z', updatedBy: { id: 'u1', name: 'Test User' },
  };
}

const freeSlab = (): DrawingSlabUnit => makeUnit({
  id: 'slab-free', serial: 'TM6', inventoryItemName: 'Taj Mahal', lengthMm: 3000, widthMm: 1500, area: 48.4, status: 'available',
});
const heldSlab = (): DrawingSlabUnit => ({
  ...makeUnit({
    id: 'slab-held', serial: 'TM5', inventoryItemName: 'Taj Mahal', lengthMm: 3000, widthMm: 1500, area: 48.4,
    status: 'reserved', reservedSalesOrderId: ORDER, reservedSalesOrderNumber: 'SORD-1',
  }),
  photoUrl: 'https://r2.example/tm5.jpg',
});

/** What the server would answer: the order's one stone item with these slabs. */
let slabs: DrawingSlabUnit[] = [];
const options = (): DrawingSlabItem[] => [{ itemId: 'item-1', itemName: 'Taj Mahal', itemSku: 'TM', units: slabs }];

function PlacementReadout() {
  const { state } = useDrawingEditor();
  return (
    <>
      <span data-testid="slab">{JSON.stringify(state.present.areas[0].pieces[0].slab ?? null)}</span>
      <span data-testid="profile-slab">{JSON.stringify(state.present.areas[0].pieces[0].edges[0]?.attachedProfile?.slab ?? null)}</span>
    </>
  );
}

// The board draws live pieces from the editor state, so a placement shows up on it.
function BoardPiece() {
  const { state } = useDrawingEditor();
  const piece = state.present.areas[0].pieces[0];
  return (
    <>
      <PieceShape piece={piece} selected={false} />
      <AttachedProfilePieces piece={piece} />
    </>
  );
}

function renderMaterial(piece: Piece = rectPiece(600, 400)) {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
      <DrawingEditorProvider drawing={drawingWith(piece)} materialLines={[]}>
        <AttachedProfileTypesProvider>
          <MaterialPickerProvider>
            <div data-drawing-editor><DrawingToolbar saveStatus="idle" onSave={() => {}} orderNumber="1001" onExit={() => {}} /></div>
            <WorkspacePanel />
            <svg><BoardPiece /></svg>
            <PlacementReadout />
          </MaterialPickerProvider>
        </AttachedProfileTypesProvider>
      </DrawingEditorProvider>
    </QueryClientProvider>,
  );
}

const placement = () => JSON.parse(screen.getByTestId('slab').textContent ?? 'null');
const profilePlacement = () => JSON.parse(screen.getByTestId('profile-slab').textContent ?? 'null');
const openMaterial = () => userEvent.click(screen.getByRole('tab', { name: 'Material' }));

beforeEach(() => {
  vi.clearAllMocks();
  slabs = [freeSlab(), heldSlab()];
  vi.mocked(drawingService.getAttachedProfileTypes).mockResolvedValue([BACKSPLASH]);
  vi.mocked(drawingSlabService.listOptions).mockImplementation(() => Promise.resolve(options()));
  vi.mocked(drawingSlabService.release).mockResolvedValue(undefined);
  vi.mocked(drawingSlabService.hold).mockImplementation((_order, slabId) => {
    const unit = slabs.find((s) => s.id === slabId) as DrawingSlabUnit;
    const held = { ...unit, status: 'reserved', reservedSalesOrderId: ORDER };
    slabs = slabs.map((s) => (s.id === slabId ? held : s));
    return Promise.resolve(held);
  });
});

describe('Material panel', () => {
  it('shows Inventory at the top left and the slab count at the top right, with a card per slab added', async () => {
    renderMaterial();
    await openMaterial();

    const panel = screen.getByRole('complementary', { name: 'Material' });
    expect(within(panel).getByRole('button', { name: 'Inventory' })).toBeEnabled();
    expect(await within(panel).findByRole('region', { name: 'Slab TM5' })).toBeInTheDocument();
    expect(within(panel).queryByRole('region', { name: 'Slab TM6' })).toBeNull(); // free: not added yet
    expect(within(panel).getByRole('status', { name: '0 of 1 slabs used' })).toHaveTextContent('Slabs: 0 / 1');
    expect(within(panel).getByRole('button', { name: 'Select pieces for slab TM5' })).toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: 'Delete slab TM5' })).toBeInTheDocument();
  });

  it('says so when no slab has been added yet', async () => {
    slabs = [freeSlab()];
    renderMaterial();
    await openMaterial();

    expect(await screen.findByText(/No slabs yet/)).toBeInTheDocument();
    expect(screen.getByRole('status', { name: '0 of 0 slabs used' })).toBeInTheDocument();
  });
});

describe('Inventory dialog', () => {
  it('lists the order\'s stone slabs that are free and adds one, reserving it for the order', async () => {
    slabs = [freeSlab()];
    const user = userEvent.setup();
    renderMaterial();
    await openMaterial();
    await user.click(screen.getByRole('button', { name: 'Inventory' }));

    const dialog = await screen.findByRole('dialog', { name: 'Inventory' });
    expect(await within(dialog).findByText('TM6')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Add slab TM6' }));

    await waitFor(() => expect(drawingSlabService.hold).toHaveBeenCalledWith(ORDER, 'slab-free'));
    // The list is read again: the slab now shows as Added, and has a card behind the dialog.
    expect(await within(dialog).findByText('Added')).toBeInTheDocument();
    expect(await screen.findByRole('region', { name: 'Slab TM6' })).toBeInTheDocument();
  });

  it('lists in-stock slabs that are awaiting inspection, but will not add them', async () => {
    slabs = [{ ...freeSlab(), inspectionStatus: 'pending' }];
    const user = userEvent.setup();
    renderMaterial();
    await openMaterial();
    await user.click(screen.getByRole('button', { name: 'Inventory' }));

    const dialog = await screen.findByRole('dialog', { name: 'Inventory' });
    expect(await within(dialog).findByText('TM6')).toBeInTheDocument();
    expect(within(dialog).getByText('Awaiting inspection')).toBeInTheDocument();
    expect(within(dialog).getByRole('note')).toHaveTextContent(/waiting for inspection/);
    const add = within(dialog).getByRole('button', { name: 'Add slab TM6' });
    expect(add).toBeDisabled();
    expect(add).toHaveAttribute('title', expect.stringMatching(/not been inspected/));
    expect(drawingSlabService.hold).not.toHaveBeenCalled();
  });

  it('explains an order with no stone items', async () => {
    vi.mocked(drawingSlabService.listOptions).mockResolvedValue([]);
    const user = userEvent.setup();
    renderMaterial();
    await openMaterial();
    await user.click(screen.getByRole('button', { name: 'Inventory' }));

    expect(await screen.findByText(/no slab items yet/)).toBeInTheDocument();
  });
});

describe('Select Pieces', () => {
  async function armSlab() {
    const user = userEvent.setup();
    await openMaterial();
    await user.click(await screen.findByRole('button', { name: 'Select pieces for slab TM5' }));
    return user;
  }

  it('turns the board into a target and lays the clicked piece on the slab', async () => {
    renderMaterial();
    await armSlab();

    const armed = screen.getByRole('button', { name: /^Piece A-1/ });
    expect(armed).toHaveClass('cursor-crosshair');
    expect(screen.getByText(/Click a piece or a painted profile on the drawing to lay it on slab TM5/)).toBeInTheDocument();
    fireEvent.pointerDown(armed);

    await waitFor(() => expect(placement()).toEqual({ slabId: 'slab-held', x: 0, y: 0, rotationDeg: 0 }));
    expect(screen.getByRole('status', { name: '1 of 1 slabs used' })).toHaveTextContent('Slabs: 1 / 1');
    expect(screen.getByRole('button', { name: 'Piece A-1 on slab TM5, fits' })).toBeInTheDocument();
    expect(screen.getByText('1 piece on this slab, all fit.')).toBeInTheDocument();
  });

  it('shows a piece too big for the slab in red, with the reason', async () => {
    renderMaterial(rectPiece(5000, 4000));
    await armSlab();
    fireEvent.pointerDown(screen.getByRole('button', { name: /^Piece A-1/ }));

    const outline = await screen.findByRole('button', { name: 'Piece A-1 on slab TM5, runs off the slab' });
    expect(outline.querySelector('polygon')).toHaveClass('stroke-red-600');
    expect(screen.getByText(/1 piece does not fit here/)).toBeInTheDocument();
  });

  it('lets go with Done and with Escape', async () => {
    renderMaterial();
    const user = await armSlab();
    await user.click(screen.getByRole('button', { name: 'Stop selecting pieces for slab TM5' }));
    expect(screen.getByRole('button', { name: /^Piece A-1/ })).toHaveClass('cursor-move');

    await user.click(screen.getByRole('button', { name: 'Select pieces for slab TM5' }));
    expect(screen.getByRole('button', { name: /^Piece A-1/ })).toHaveClass('cursor-crosshair');
    await user.keyboard('{Escape}');
    expect(screen.getByRole('button', { name: /^Piece A-1/ })).toHaveClass('cursor-move');
  });

  it('drags the outline across the slab, committing once on release, and turns red when dropped off the edge', async () => {
    // The slab is 3000mm wide and drawn 600px wide, so one pixel is 5mm.
    const rect = vi.spyOn(SVGElement.prototype, 'getBoundingClientRect').mockReturnValue({
      left: 0, top: 0, width: 600, height: 300, right: 600, bottom: 300, x: 0, y: 0, toJSON: () => undefined,
    } as DOMRect);
    renderMaterial();
    const user = await armSlab();
    fireEvent.pointerDown(screen.getByRole('button', { name: /^Piece A-1/ }));
    await waitFor(() => expect(placement()).not.toBeNull());
    await user.click(screen.getByRole('button', { name: 'Stop selecting pieces for slab TM5' }));

    const outline = screen.getByRole('button', { name: /^Piece A-1 on slab TM5/ });
    fireEvent.pointerDown(outline, { clientX: 100, clientY: 100 });
    fireEvent.pointerMove(outline, { clientX: 120, clientY: 110 });
    expect(placement()).toMatchObject({ x: 0, y: 0 }); // not saved mid-drag
    fireEvent.pointerUp(outline, { clientX: 120, clientY: 110 });
    expect(placement()).toMatchObject({ x: 100, y: 50 });

    // 590px right is 2950mm: a 600mm piece starting there runs off the 3000mm slab.
    const again = screen.getByRole('button', { name: /^Piece A-1 on slab TM5/ });
    fireEvent.pointerDown(again, { clientX: 0, clientY: 0 });
    fireEvent.pointerMove(again, { clientX: 590, clientY: 0 });
    expect(screen.getByRole('button', { name: 'Piece A-1 on slab TM5, runs off the slab' })).toBeInTheDocument();
    fireEvent.pointerUp(again, { clientX: 590, clientY: 0 });
    expect(placement()).toMatchObject({ x: 3050 });
    rect.mockRestore();
  });

  it('moves the outline with the arrow keys, turns it with R and takes it off with Delete', async () => {
    renderMaterial();
    const user = await armSlab();
    fireEvent.pointerDown(screen.getByRole('button', { name: /^Piece A-1/ }));
    await waitFor(() => expect(placement()).not.toBeNull());
    await user.click(screen.getByRole('button', { name: 'Stop selecting pieces for slab TM5' }));

    const outline = screen.getByRole('button', { name: /^Piece A-1 on slab TM5/ });
    outline.focus();
    await user.keyboard('{ArrowRight}{ArrowDown}');
    expect(placement()).toMatchObject({ x: 10, y: 10, rotationDeg: 0 });
    await user.keyboard('r');
    expect(placement()).toMatchObject({ rotationDeg: 90 });
    await user.keyboard('{Delete}');
    expect(placement()).toBeNull();
    expect(screen.getByRole('status', { name: '0 of 1 slabs used' })).toBeInTheDocument();
  });
});

describe('Select Pieces — profile pieces', () => {
  it('lays a painted profile\'s own piece on the slab, independently of its parent', async () => {
    renderMaterial(rectPieceWithProfile(600, 400));
    const user = userEvent.setup();
    await openMaterial();
    await user.click(await screen.findByRole('button', { name: 'Select pieces for slab TM5' }));

    const profileTarget = await screen.findByRole('button', { name: 'Lay A-1 Backsplash-A on slab TM5' });
    fireEvent.pointerDown(profileTarget);

    await waitFor(() => expect(profilePlacement()).toEqual({ slabId: 'slab-held', x: 0, y: 0, rotationDeg: 0 }));
    // The parent piece itself was never placed — it is a separate item.
    expect(placement()).toBeNull();
    expect(screen.getByRole('button', { name: 'Piece A-1 Backsplash-A on slab TM5, fits' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Delete slab TM5' }));
    await user.click(screen.getByRole('button', { name: 'Delete slab' }));
    await waitFor(() => expect(profilePlacement()).toBeNull());
  });

  it('shows the slab\'s photo inside the profile piece once it is placed and fits', async () => {
    renderMaterial(rectPieceWithProfile(600, 400));
    const user = userEvent.setup();
    await openMaterial();
    await user.click(await screen.findByRole('button', { name: 'Select pieces for slab TM5' }));
    expect(screen.queryByTestId('profile-slab-texture')).toBeNull();

    fireEvent.pointerDown(await screen.findByRole('button', { name: 'Lay A-1 Backsplash-A on slab TM5' }));
    await waitFor(() => expect(profilePlacement()).not.toBeNull());

    const texture = await screen.findByTestId('profile-slab-texture');
    const image = texture.querySelector('image');
    expect(image).toHaveAttribute('href', 'https://r2.example/tm5.jpg');
    // The whole slab photo, at the slab's size, clipped to the profile piece's own rectangle.
    expect(image).toHaveAttribute('width', '3000');
    expect(image).toHaveAttribute('height', '1500');
  });

  it('is not shown when the profile piece does not fit the slab', async () => {
    renderMaterial(rectPieceWithProfile(5000, 400));
    const user = userEvent.setup();
    await openMaterial();
    await user.click(await screen.findByRole('button', { name: 'Select pieces for slab TM5' }));
    fireEvent.pointerDown(await screen.findByRole('button', { name: 'Lay A-1 Backsplash-A on slab TM5' }));
    await waitFor(() => expect(profilePlacement()).not.toBeNull());

    await screen.findByRole('button', { name: 'Piece A-1 Backsplash-A on slab TM5, runs off the slab' });
    expect(screen.queryByTestId('profile-slab-texture')).toBeNull();
  });
});

describe("the slab's photo inside the piece", () => {
  async function placeOnSlab() {
    const user = userEvent.setup();
    await openMaterial();
    await user.click(await screen.findByRole('button', { name: 'Select pieces for slab TM5' }));
    fireEvent.pointerDown(screen.getByRole('button', { name: /^Piece A-1/ }));
    await waitFor(() => expect(placement()).not.toBeNull());
  }

  it('draws the part of the slab under the piece inside it once it fits', async () => {
    renderMaterial();
    expect(screen.queryByTestId('slab-texture')).toBeNull(); // not placed yet
    await placeOnSlab();

    const texture = await screen.findByTestId('slab-texture');
    const image = texture.querySelector('image');
    expect(image).toHaveAttribute('href', 'https://r2.example/tm5.jpg');
    // The whole slab photo, at the slab's size, moved into the piece's own spot and clipped to it.
    expect(image).toHaveAttribute('width', '3000');
    expect(image).toHaveAttribute('height', '1500');
    expect(image).toHaveAttribute('transform', 'scale(1,-1) rotate(0) translate(0,0)');
    expect(texture.querySelector('clipPath polygon')).toHaveAttribute('points', '0,0 600,0 600,-400 0,-400');
  });

  it('follows the placement when the outline is moved on the slab', async () => {
    renderMaterial();
    const user = userEvent.setup();
    await placeOnSlab();
    await user.click(screen.getByRole('button', { name: 'Stop selecting pieces for slab TM5' }));
    screen.getByRole('button', { name: /^Piece A-1 on slab TM5/ }).focus();
    await user.keyboard('{ArrowRight}'); // 10mm right on the slab

    const image = (await screen.findByTestId('slab-texture')).querySelector('image');
    expect(image).toHaveAttribute('transform', 'scale(1,-1) rotate(0) translate(-10,0)');
  });

  it('is not drawn when the piece does not fit the slab', async () => {
    renderMaterial(rectPiece(5000, 4000));
    await placeOnSlab();

    await screen.findByRole('button', { name: 'Piece A-1 on slab TM5, runs off the slab' });
    expect(screen.queryByTestId('slab-texture')).toBeNull();
  });

  it('is not drawn for a slab with no photo', async () => {
    slabs = [{ ...heldSlab(), photoUrl: undefined }];
    renderMaterial();
    await placeOnSlab();

    expect(screen.queryByTestId('slab-texture')).toBeNull();
  });
});

describe('Deleting a slab', () => {
  it('asks first when pieces are on it, then gives the slab back and takes the pieces off', async () => {
    renderMaterial();
    const user = userEvent.setup();
    await openMaterial();
    await user.click(await screen.findByRole('button', { name: 'Select pieces for slab TM5' }));
    fireEvent.pointerDown(screen.getByRole('button', { name: /^Piece A-1/ }));
    await waitFor(() => expect(placement()).not.toBeNull());

    await user.click(screen.getByRole('button', { name: 'Delete slab TM5' }));
    expect(drawingSlabService.release).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('take 1 piece off it');

    await user.click(screen.getByRole('button', { name: 'Delete slab' }));
    await waitFor(() => expect(drawingSlabService.release).toHaveBeenCalledWith(ORDER, 'slab-held'));
    await waitFor(() => expect(placement()).toBeNull());
  });

  it('cannot give back a slab a fabrication job has taken', async () => {
    slabs = [makeUnit({
      id: 'slab-job', serial: 'TM9', status: 'reserved',
      usage: { jobId: 'job-1', jobNumber: 'FJOB-1', salesOrderId: ORDER, offcutCount: 0, recoveredArea: 0, usedArea: 0 },
    })];
    renderMaterial();
    await openMaterial();

    expect(await screen.findByRole('button', { name: 'Delete slab TM9' })).toBeDisabled();
  });
});
