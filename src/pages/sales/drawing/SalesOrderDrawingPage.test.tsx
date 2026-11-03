import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('@/services/salesOrderService', () => ({
  salesOrderService: { getOrder: vi.fn() },
}));
vi.mock('@/services/drawingService', () => ({
  drawingService: { getDrawing: vi.fn() },
}));

import SalesOrderDrawingPage from './SalesOrderDrawingPage';
import { salesOrderService } from '@/services/salesOrderService';
import { drawingService } from '@/services/drawingService';
import { useBreadcrumbStore } from '@/store/useBreadcrumbStore';
import type { SalesOrder } from '@/types/salesOrder';

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
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/sales/sales_order/so-1/drawing']}>
        <Routes>
          <Route path="/sales/sales_order/:id/drawing" element={<SalesOrderDrawingPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(salesOrderService.getOrder).mockResolvedValue(order());
  vi.mocked(drawingService.getDrawing).mockResolvedValue(null);
});

describe('SalesOrderDrawingPage', () => {
  it('renders the toolbar, one area tab, an empty canvas, and the empty-state inspector when no drawing exists yet', async () => {
    renderPage();
    expect(await screen.findByRole('button', { name: 'Add rectangle' })).toBeDefined();
    expect(screen.getAllByRole('tab')).toHaveLength(1);
    expect(screen.getByRole('application', { name: 'Drawing canvas' })).toBeDefined();
    expect(screen.getByText(/no piece selected/i)).toBeDefined();
  });

  it('sets the breadcrumb label on mount and clears it on unmount', async () => {
    const { unmount } = renderPage();
    await screen.findByRole('button', { name: 'Add rectangle' });
    expect(useBreadcrumbStore.getState().labels['so-1']).toBe('SO-1042');
    unmount();
    expect(useBreadcrumbStore.getState().labels['so-1']).toBeUndefined();
  });

  it('adding a piece, selecting it, and undoing removes it again', async () => {
    renderPage();
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
});
