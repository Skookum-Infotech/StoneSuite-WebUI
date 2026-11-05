import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
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

import SalesOrderDrawingPage from './SalesOrderDrawingPage';
import { salesOrderService } from '@/services/salesOrderService';
import { DrawingConflictError, drawingService } from '@/services/drawingService';
import { useBreadcrumbStore } from '@/store/useBreadcrumbStore';
import type { SalesOrder } from '@/types/salesOrder';
import type { Drawing } from '@/types/drawing';

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

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(salesOrderService.getOrder).mockResolvedValue(order());
  vi.mocked(drawingService.getDrawing).mockResolvedValue(null);
  vi.mocked(drawingService.listVersions).mockResolvedValue({ items: [], nextCursor: null });
});

describe('SalesOrderDrawingPage', () => {
  it('renders the toolbar, one area tab, an empty canvas, and the empty-state inspector when no drawing exists yet', async () => {
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Shapes' }));
    expect(await screen.findByRole('button', { name: 'Add rectangle' })).toBeDefined();
    expect(screen.getAllByRole('tab')).toHaveLength(1);
    expect(screen.getByRole('application', { name: 'Drawing canvas' })).toBeDefined();
    expect(screen.getByText(/no piece selected/i)).toBeDefined();
  });

  it('sets the breadcrumb label on mount and clears it on unmount', async () => {
    const { unmount } = renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Shapes' }));
    await screen.findByRole('button', { name: 'Add rectangle' });
    expect(useBreadcrumbStore.getState().labels['so-1']).toBe('SO-1042');
    unmount();
    expect(useBreadcrumbStore.getState().labels['so-1']).toBeUndefined();
  });

  it('adding a piece, selecting it, and undoing removes it again', async () => {
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Shapes' }));
    await screen.findByRole('button', { name: 'Add rectangle' });

    await userEvent.click(screen.getByRole('button', { name: 'Add rectangle' }));
    await userEvent.type(screen.getByLabelText('Length'), '96');
    await userEvent.type(screen.getByLabelText('Width'), '26');
    await userEvent.type(screen.getByLabelText('Thickness'), '1.25');
    await userEvent.click(screen.getByRole('button', { name: 'Add piece' }));

    const pieceButton = screen.getByRole('button', { name: /Piece A-1/ });
    expect(pieceButton).toBeDefined();
    await userEvent.click(pieceButton);
    expect(screen.getByLabelText('Label')).toHaveValue('A-1');

    const undoButton = screen.getByRole('button', { name: 'Undo' });
    expect(undoButton).toBeEnabled();
    await userEvent.click(undoButton);
    expect(screen.queryByRole('button', { name: /Piece A-1/ })).toBeNull();
    expect(screen.getByText(/no piece selected/i)).toBeDefined();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
  });

  it('shows an error, not a blank drawing, when loading the drawing itself fails', async () => {
    vi.mocked(drawingService.getDrawing).mockRejectedValue(new Error('network down'));
    renderPage();
    await screen.findByText(/failed to load the drawing/i);
    // Must not silently fall back to a blank editor over a real error —
    // found in the final review: this used to show a normal, empty
    // drawing with no indication anything went wrong.
    expect(screen.queryByRole('button', { name: 'Add rectangle' })).toBeNull();
  });

  it('keeps the editor and its in-memory work when a background order refetch fails, instead of replacing it with an error screen', async () => {
    const { queryClient } = renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Shapes' }));
    await screen.findByRole('button', { name: 'Add rectangle' });

    // Add a piece — in-memory work that a wrongly-triggered error screen
    // would throw away.
    await userEvent.click(screen.getByRole('button', { name: 'Add rectangle' }));
    await userEvent.type(screen.getByLabelText('Length'), '96');
    await userEvent.type(screen.getByLabelText('Width'), '26');
    await userEvent.type(screen.getByLabelText('Thickness'), '1.25');
    await userEvent.click(screen.getByRole('button', { name: 'Add piece' }));
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
    expect(await screen.findByRole('tab', { name: 'Saved Area' })).toBeDefined();
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

  it('gives the canvas all the room the toolbar and summary leave, and lets only the side panels scroll', async () => {
    renderPage();
    const canvas = await screen.findByRole('application', { name: 'Drawing canvas' });
    expect(canvas.className).toContain('h-full');
    expect(canvas.parentElement?.className).toContain('min-h-0');
    expect(canvas.parentElement?.className).toContain('flex-1');
    const inspectorColumn = (await screen.findByText(/no piece selected/i)).closest('aside.overflow-y-auto');
    expect(inspectorColumn).not.toBeNull();
  });

  it('stretches the drawing to the canvas without distorting it', async () => {
    renderPage();
    const canvas = await screen.findByRole('application', { name: 'Drawing canvas' });
    const svg = canvas.querySelector('svg');
    expect(svg?.getAttribute('height')).toBe('100%');
    expect(svg?.getAttribute('preserveAspectRatio')).toBe('xMidYMid meet');
  });
});

describe('SalesOrderDrawingPage — autosave, conflicts, and the unsaved-changes guard', () => {
  // Real timers throughout — only Ctrl/Cmd+S (an immediate save, bypassing
  // the debounce) is used to trigger a save here. The debounce's own 3s
  // timing is already proven by useDrawingAutosave.test.ts in isolation;
  // mixing fake timers with userEvent + TanStack Query at the page level
  // hangs (findByRole's internal polling never advances).
  async function addAPieceAndSave(user: ReturnType<typeof userEvent.setup>) {
    await user.click(await screen.findByRole('button', { name: 'Shapes' }));
    await screen.findByRole('button', { name: 'Add rectangle' });
    await user.click(screen.getByRole('button', { name: 'Add rectangle' }));
    await user.type(screen.getByLabelText('Length'), '96');
    await user.type(screen.getByLabelText('Width'), '26');
    await user.type(screen.getByLabelText('Thickness'), '1.25');
    await user.click(screen.getByRole('button', { name: 'Add piece' }));
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

    expect(await screen.findByRole('tab', { name: 'Server Area' })).toBeDefined();
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
    await user.click(await screen.findByRole('button', { name: 'Shapes' }));
    await screen.findByRole('button', { name: 'Add rectangle' });
    await user.click(screen.getByRole('button', { name: 'Add rectangle' }));
    await user.type(screen.getByLabelText('Length'), '96');
    await user.type(screen.getByLabelText('Width'), '26');
    await user.type(screen.getByLabelText('Thickness'), '1.25');
    await user.click(screen.getByRole('button', { name: 'Add piece' }));

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
