import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('@/services/salesOrderService', () => ({
  salesOrderService: { getOrder: vi.fn(), updateOrder: vi.fn() },
}));
vi.mock('@/services/drawingService', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  drawingService: { getDrawing: vi.fn(), saveDrawing: vi.fn(), listVersions: vi.fn() },
}));

// WebGL does not exist in jsdom; the real viewer is covered by its own geometry tests.
vi.mock('@/components/drawing/three/DrawingViewer3D', () => ({
  DrawingViewer3D: () => <div data-testid="viewer-3d" />,
}));

import SalesOrderDrawingPage from './SalesOrderDrawingPage';
import { salesOrderService } from '@/services/salesOrderService';
import { DrawingConflictError, drawingService } from '@/services/drawingService';
import { useBreadcrumbStore } from '@/store/useBreadcrumbStore';
import type { SalesOrder } from '@/types/salesOrder';
import type { Drawing } from '@/types/drawing';
import { OPEN_ZOOM } from '@/lib/drawing/constants';

function order(overrides: Partial<SalesOrder> = {}): SalesOrder {
  return {
    id: 'so-1',
    salesOrderNumber: 'SO-1042',
    status: 'Open',
    statusCode: 'OPEN',
    approvalStatus: 'none',
    nextStatusCodes: [],
    gated: false,
    approvers: [],
    requiredApprovals: 0,
    approvedCount: 0,
    canApprove: false,
    isOverride: false,
    callerAlreadyApproved: false,
    customer: { id: 'cust-1', name: 'Acme Stoneworks' },
    orderDate: '2026-10-01',
    paymentTermsId: null,
    priceLevelId: null,
    currencyId: null,
    salesRepEmployeeId: null,
    ownerEmployeeId: null,
    salesTaxPercent: 0,
    items: [],
    ...overrides,
  } as SalesOrder;
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const result = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/sales/sales_order/so-1/drawing']}>
        <Routes>
          <Route path="/sales/sales_order/:id/drawing" element={<SalesOrderDrawingPage />} />
          <Route path="/sales/sales_order/:id" element={<p>Order page</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { ...result, queryClient };
}

function drawing(overrides: Partial<Drawing> = {}): Drawing {
  return {
    schemaVersion: 1,
    salesOrderId: 'so-1',
    version: 1,
    displayUnit: 'in',
    fractionDenominator: 32,
    areas: [{ id: 'area-1', name: 'Saved Area', code: '', sortOrder: 0, pieces: [], cabinets: [], notes: [] }],
    updatedAt: '2026-11-03T00:00:00.000Z',
    updatedBy: { id: 'u1', name: 'Test User' },
    ...overrides,
  };
}

/** Drops one square on the board: the Draw tool, a click, then back to Select
 *  (the rail's old Shapes flyout is gone — Draw is how a piece gets added). */
async function addAPiece(user: Pick<typeof userEvent, 'click'>) {
  vi.spyOn(SVGElement.prototype, 'getBoundingClientRect').mockReturnValue({
    left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600, x: 0, y: 0, toJSON: () => undefined,
  } as DOMRect);
  await user.click(await screen.findByRole('button', { name: 'Draw' }));
  const click = { pointerId: 1, button: 0, clientX: 400, clientY: 300 };
  const sheet = await screen.findByTestId('tool-capture');
  fireEvent.pointerDown(sheet, click);
  fireEvent.pointerUp(sheet, click);
  await user.click(screen.getByRole('button', { name: 'Select' }));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(salesOrderService.getOrder).mockResolvedValue(order());
  vi.mocked(drawingService.getDrawing).mockResolvedValue(null);
  vi.mocked(drawingService.listVersions).mockResolvedValue({ items: [], nextCursor: null });
});

describe('SalesOrderDrawingPage', () => {
  it('renders the toolbar, the active area in the bottom bar and an empty canvas, with no Properties panel until something is selected, when no drawing exists yet', async () => {
    renderPage();
    expect(await screen.findByRole('button', { name: 'Draw' })).toBeDefined();
    expect(screen.getByRole('button', { name: /^Areas, Area 1 selected/ })).toBeDefined();
    expect(screen.getByRole('application', { name: 'Drawing canvas' })).toBeDefined();
    expect(screen.queryByRole('complementary', { name: 'Properties' })).toBeNull();
  });

  it('opens zoomed out, so there is room on the board for a whole run of counters', async () => {
    renderPage();
    await screen.findByRole('application', { name: 'Drawing canvas' });
    const levels = screen.getAllByLabelText('Zoom level');
    expect(levels.length).toBeGreaterThan(0);
    for (const level of levels) expect(level).toHaveTextContent(`${Math.round(OPEN_ZOOM * 100)}%`);
  });

  it('sets the breadcrumb label on mount and clears it on unmount', async () => {
    const { unmount } = renderPage();
    await screen.findByRole('button', { name: 'Draw' });
    expect(useBreadcrumbStore.getState().labels['so-1']).toBe('SO-1042');
    unmount();
    expect(useBreadcrumbStore.getState().labels['so-1']).toBeUndefined();
  });

  it('adding a piece, selecting it, and undoing removes it again', async () => {
    renderPage();
    await addAPiece(userEvent);

    const pieceButton = screen.getByRole('button', { name: /Piece A-1/ });
    expect(pieceButton).toBeDefined();
    await userEvent.click(pieceButton);
    // The Properties panel is off by default (toggled separately, see
    // DrawingStatusBar) — selecting a piece shows up in its own aria-label.
    expect(screen.getByRole('button', { name: 'Piece A-1, selected' })).toBeDefined();

    const undoButton = screen.getByRole('button', { name: 'Undo' });
    expect(undoButton).toBeEnabled();
    await userEvent.click(undoButton);
    expect(screen.queryByRole('button', { name: /Piece A-1/ })).toBeNull();
    expect(screen.queryByRole('complementary', { name: 'Properties' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
  });

  it('shows an error, not a blank drawing, when loading the drawing itself fails', async () => {
    vi.mocked(drawingService.getDrawing).mockRejectedValue(new Error('network down'));
    renderPage();
    await screen.findByText(/failed to load the drawing/i);
    // Must not silently fall back to a blank editor over a real error —
    // found in the final review: this used to show a normal, empty
    // drawing with no indication anything went wrong.
    expect(screen.queryByRole('button', { name: 'Draw' })).toBeNull();
  });

  it('keeps the editor and its in-memory work when a background order refetch fails, instead of replacing it with an error screen', async () => {
    const { queryClient } = renderPage();
    await addAPiece(userEvent);
    expect(screen.getByRole('button', { name: /Piece A-1/ })).toBeDefined();

    // Simulate a background refetch (e.g. on window refocus) failing —
    // the order's data from the first successful load is still cached.
    vi.mocked(salesOrderService.getOrder).mockRejectedValue(new Error('network down'));
    await queryClient.refetchQueries({ queryKey: ['sales-order', 'so-1'] }).catch(() => undefined);

    expect(screen.queryByText(/failed to load the sales order/i)).toBeNull();
    expect(screen.getByRole('button', { name: /Piece A-1/ })).toBeDefined();
  });

  it('loads a real saved drawing instead of a blank one when one exists', async () => {
    vi.mocked(drawingService.getDrawing).mockResolvedValue(drawing());
    renderPage();
    expect(await screen.findByRole('button', { name: /^Areas, Saved Area selected/ })).toBeDefined();
  });
});

describe('SalesOrderDrawingPage — fills the screen', () => {
  beforeEach(() => {
    vi.mocked(salesOrderService.getOrder).mockResolvedValue(order());
    vi.mocked(drawingService.getDrawing).mockResolvedValue(null);
  });

  // A percentage height has nothing to resolve against inside the app layout
  // (its height is "at least the screen", not "the screen"), so the editor
  // measures where it starts and takes the rest of the window.
  it('takes exactly the window height below wherever it starts, and never scrolls the page', async () => {
    renderPage();
    const editor = await screen.findByTestId('drawing-editor');
    expect(editor.style.getPropertyValue('--fill-top')).not.toBe('');
    expect(editor.className).toContain('h-[calc(100dvh-var(--fill-top))]');
    expect(editor.className).toContain('overflow-hidden');
  });

  it('gives the canvas all the room the toolbar and summary leave, with no side column taking width from it', async () => {
    renderPage();
    const canvas = await screen.findByRole('application', { name: 'Drawing canvas' });
    expect(canvas.className).toContain('h-full');
    // The canvas fills the board (absolute inset-0), and the board takes whatever the row leaves.
    expect(canvas.parentElement?.className).toContain('inset-0');
    expect(canvas.parentElement?.parentElement?.className).toContain('min-h-0');
    expect(canvas.parentElement?.parentElement?.className).toContain('flex-1');
    expect(screen.queryByRole('complementary', { name: 'Properties' })).toBeNull();
  });

  it('runs the top bar and the status bar full width, with the side panel between them touching both', async () => {
    const user = userEvent.setup();
    renderPage();
    const editor = await screen.findByTestId('drawing-editor');
    const bar = screen.getByRole('tablist', { name: 'Workspace' }).parentElement?.parentElement;
    const statusBar = screen.getByRole('button', { name: /^Areas,/ }).parentElement;
    // Both bars are direct children of the editor, so a panel opening beside the board cannot squeeze them.
    expect(bar?.parentElement).toBe(editor);
    expect(statusBar?.parentElement).toBe(editor);
    expect(bar?.className).toContain('w-full');
    expect(bar?.className).toContain('shrink-0');
    expect(editor.className).not.toContain('p-2');

    await user.click(screen.getByRole('tab', { name: 'Cutout' }));
    const panel = screen.getByRole('complementary', { name: 'Cutouts' });
    expect(bar?.parentElement).toBe(editor);
    expect(bar?.contains(panel)).toBe(false);
    // The panel sits in the row between the two bars.
    expect(panel.parentElement?.parentElement).toBe(editor);
    expect(editor.children[0]).toBe(bar);
    expect(editor.lastElementChild === statusBar || editor.children[editor.children.length - 1] === statusBar).toBe(true);
  });

  it('floats the tool rail over the board instead of giving it a column of its own', async () => {
    renderPage();
    const rail = await screen.findByRole('navigation', { name: 'Drawing tools' });
    const canvas = screen.getByRole('application', { name: 'Drawing canvas' });
    const board = canvas.parentElement?.parentElement;
    expect(board?.contains(rail)).toBe(true);
    expect(rail.parentElement?.className).toContain('absolute');
  });

  it('stretches the drawing to the canvas without distorting it', async () => {
    renderPage();
    const canvas = await screen.findByRole('application', { name: 'Drawing canvas' });
    const svg = canvas.querySelector('svg');
    expect(svg?.getAttribute('height')).toBe('100%');
    expect(svg?.getAttribute('preserveAspectRatio')).toBe('xMidYMid meet');
  });
});

describe('SalesOrderDrawingPage — 2D / 3D', () => {
  beforeEach(() => {
    vi.mocked(salesOrderService.getOrder).mockResolvedValue(order());
    vi.mocked(drawingService.getDrawing).mockResolvedValue(null);
  });

  it('has one button that offers the other view, and swaps the tools for the 3D view', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Switch to 3D view' }));

    expect(await screen.findByTestId('viewer-3d')).toBeTruthy();
    expect(screen.queryByRole('navigation', { name: 'Drawing tools' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Switch to 3D view' })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Switch to 2D view' }));
    expect(screen.queryByTestId('viewer-3d')).toBeNull();
    expect(screen.getByRole('navigation', { name: 'Drawing tools' })).toBeTruthy();
  });

  it('keeps the 2D canvas mounted but hidden and unreachable while in 3D', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Switch to 3D view' }));
    const canvas = await screen.findByTestId('viewer-3d').then(() => document.querySelector('[aria-label="Drawing canvas"]'));
    const wrapper = canvas?.parentElement;
    expect(wrapper?.className).toContain('invisible');
    expect(wrapper?.hasAttribute('inert')).toBe(true);
  });
});

describe('SalesOrderDrawingPage — Exit', () => {
  beforeEach(() => {
    vi.mocked(salesOrderService.getOrder).mockResolvedValue(order());
    vi.mocked(drawingService.getDrawing).mockResolvedValue(drawing());
  });

  it('goes back to the sales order straight away when nothing is unsaved', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Exit drawing' }));
    expect(await screen.findByText('Order page')).toBeTruthy();
    expect(drawingService.saveDrawing).not.toHaveBeenCalled();
  });

  it('saves unsaved edits first and only leaves once the save has landed', async () => {
    const user = userEvent.setup();
    vi.mocked(drawingService.saveDrawing).mockResolvedValue(drawing({ version: 2 }));
    renderPage();
    await addAPiece(user);
    await user.click(screen.getByRole('button', { name: 'Exit drawing' }));
    await vi.waitFor(() => expect(drawingService.saveDrawing).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('Order page')).toBeTruthy();
  });

  it('stays in the editor when that save fails, so nothing is lost', async () => {
    const user = userEvent.setup();
    vi.mocked(drawingService.saveDrawing).mockRejectedValue(new Error('network down'));
    renderPage();
    await addAPiece(user);
    await user.click(screen.getByRole('button', { name: 'Exit drawing' }));
    await vi.waitFor(() => expect(drawingService.saveDrawing).toHaveBeenCalled());
    expect(await screen.findByRole('button', { name: 'Save drawing' })).toBeTruthy();
    expect(screen.queryByText('Order page')).toBeNull();
  });
});

describe('SalesOrderDrawingPage — autosave, conflicts, and the unsaved-changes guard', () => {
  // Real timers throughout — only Ctrl/Cmd+S (an immediate save, bypassing
  // the debounce) is used to trigger a save here. The debounce's own 3s
  // timing is already proven by useDrawingAutosave.test.ts in isolation;
  // mixing fake timers with userEvent + TanStack Query at the page level
  // hangs (findByRole's internal polling never advances).
  async function addAPieceAndSave(user: ReturnType<typeof userEvent.setup>) {
    await addAPiece(user);
    await user.keyboard('{Control>}s{/Control}');
  }

  it('an edit, saved via Ctrl+S, calls saveDrawing', async () => {
    const user = userEvent.setup();
    vi.mocked(drawingService.saveDrawing).mockResolvedValue(drawing({ version: 2 }));
    renderPage();

    await addAPieceAndSave(user);

    await vi.waitFor(() => expect(drawingService.saveDrawing).toHaveBeenCalledTimes(1));
  });

  it('a 409 from a save opens the conflict dialog instead of silently failing', async () => {
    const user = userEvent.setup();
    vi.mocked(drawingService.saveDrawing).mockRejectedValue(new DrawingConflictError());
    renderPage();

    await addAPieceAndSave(user);

    expect(await screen.findByRole('dialog')).toBeDefined();
    expect(screen.getByText(/changed elsewhere/i)).toBeDefined();
  });

  it('"Reload latest" re-fetches the drawing and replaces the editor\'s content', async () => {
    const user = userEvent.setup();
    vi.mocked(drawingService.saveDrawing).mockRejectedValue(new DrawingConflictError());
    renderPage();
    await addAPieceAndSave(user);
    expect(await screen.findByRole('dialog')).toBeDefined();

    vi.mocked(drawingService.getDrawing).mockResolvedValue(drawing({ version: 9, areas: [{ id: 'area-9', name: 'Server Area', code: '', sortOrder: 0, pieces: [], cabinets: [], notes: [] }] }));
    await user.click(screen.getByRole('button', { name: 'Reload latest' }));

    expect(await screen.findByRole('button', { name: /^Areas, Server Area selected/ })).toBeDefined();
    expect(screen.queryByRole('button', { name: /Piece A-1/ })).toBeNull(); // local edit discarded
  });

  it('"Save as copy" re-sends the save using the server\'s current version as recordVersion', async () => {
    const user = userEvent.setup();
    vi.mocked(drawingService.saveDrawing).mockRejectedValueOnce(new DrawingConflictError());
    vi.mocked(drawingService.getDrawing).mockResolvedValue(drawing({ version: 7 }));
    renderPage();
    await addAPieceAndSave(user);
    expect(await screen.findByRole('dialog')).toBeDefined();

    vi.mocked(drawingService.saveDrawing).mockResolvedValue(drawing({ version: 8 }));
    await user.click(screen.getByRole('button', { name: 'Save as copy' }));

    await vi.waitFor(() => expect(drawingService.saveDrawing).toHaveBeenCalledTimes(2));
    const secondCall = vi.mocked(drawingService.saveDrawing).mock.calls[1];
    expect(secondCall[1].recordVersion).toBe(7);
  });

  it('warns before leaving the page while a save is pending, not once it has saved', async () => {
    const user = userEvent.setup();
    vi.mocked(drawingService.saveDrawing).mockResolvedValue(drawing({ version: 2 }));
    renderPage();
    await addAPiece(user);

    const dirtyEvent = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(dirtyEvent);
    expect(dirtyEvent.defaultPrevented).toBe(true);

    await user.keyboard('{Control>}s{/Control}');
    await vi.waitFor(() => expect(drawingService.saveDrawing).toHaveBeenCalledTimes(1));
    await screen.findByText('Saved');

    const savedEvent = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(savedEvent);
    expect(savedEvent.defaultPrevented).toBe(false);
  });

  it('a successful save settles on "Saved" rather than immediately flipping back to "Unsaved changes" — the save\'s own version bump must not look like a fresh edit', async () => {
    const user = userEvent.setup();
    vi.mocked(drawingService.saveDrawing).mockResolvedValue(drawing({ version: 2 }));
    renderPage();
    await addAPieceAndSave(user);

    await screen.findByText('Saved');
    expect(screen.queryByText('Unsaved changes')).toBeNull();
    expect(drawingService.saveDrawing).toHaveBeenCalledTimes(1);
  });
});
