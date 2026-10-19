import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { CreatedOrder } from '@/types/createdOrder';

vi.mock('@/services/createdOrderService', () => ({
  createdOrderService: { get: vi.fn(), list: vi.fn(), create: vi.fn(), update: vi.fn() },
}));

import CreatedOrderDetailPage from './CreatedOrderDetailPage';
import { createdOrderService } from '@/services/createdOrderService';
import { useBreadcrumbStore } from '@/store/useBreadcrumbStore';

function order(overrides: Partial<CreatedOrder> = {}): CreatedOrder {
  return {
    id: 'o1',
    status: 'submitted',
    editable: true,
    createdAt: '2026-10-12T15:30:00Z',
    builder: 'Highland Homes',
    community: 'Sandbrock Ranch',
    plan: '214',
    phone: '+1 480 209 5330',
    email: 'brandon@highlandhomes.com',
    installAddress: '741 Bridle Path',
    city: 'Aubrey',
    zip: '76227',
    measureDate: '2026-10-16',
    installDate: '2026-10-26',
    specialInstructions: 'Gate code 1234.',
    areas: [
      {
        kind: 'kitchen', name: 'Kitchen', color: 'Serene', finish: '', edge: 'Flat', backsplashHeight: '4',
        sinkModel: '440185', cooktopModel: '', waterfallQty: 2, popUpOutlet: 0, halfWall: false,
        location: '', faucetSpread: ['L8', 'C'], notes: 'Seam at the window.',
      },
      {
        kind: 'bath', name: 'Guest Bath', color: 'Ash', finish: '', edge: '', backsplashHeight: '',
        sinkModel: '', cooktopModel: '', waterfallQty: 0, popUpOutlet: 0, halfWall: false,
        location: '', faucetSpread: [], notes: '',
      },
    ],
    ...overrides,
  };
}

function renderPage(id = 'o1') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/sales/created-orders/${id}`]}>
        <Routes>
          <Route path="/sales/created-orders/:id" element={<CreatedOrderDetailPage />} />
          <Route path="/sales/created-orders" element={<div>Orders list</div>} />
          <Route path="/sales/created-orders/:id/edit" element={<div>Edit form</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function notFound(): AxiosError {
  const err = new AxiosError('Request failed');
  err.response = { status: 404, data: { message: 'Order not found.' } } as AxiosError['response'];
  return err;
}

beforeEach(() => {
  vi.clearAllMocks();
  useBreadcrumbStore.setState({ labels: {} });
});

describe('CreatedOrderDetailPage', () => {
  it('shows the project details and every area as filed', async () => {
    vi.mocked(createdOrderService.get).mockResolvedValue(order());

    renderPage();

    expect(await screen.findByRole('heading', { name: 'Project details' })).toBeInTheDocument();
    expect(createdOrderService.get).toHaveBeenCalledWith('o1');
    expect(screen.getByText('Sandbrock Ranch')).toBeInTheDocument();
    expect(screen.getByText('Gate code 1234.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Areas (2)' })).toBeInTheDocument();

    const kitchen = within(screen.getByRole('article', { name: 'Kitchen' }));
    expect(kitchen.getByText('Serene')).toBeInTheDocument();
    expect(kitchen.getByText('4 in')).toBeInTheDocument();
    expect(kitchen.getByText('8" left, Centre')).toBeInTheDocument();
    expect(kitchen.getByText('Seam at the window.')).toBeInTheDocument();
    expect(within(screen.getByRole('article', { name: 'Guest Bath' })).getByText('Ash')).toBeInTheDocument();
  });

  it('names the breadcrumb for the job, not the id', async () => {
    vi.mocked(createdOrderService.get).mockResolvedValue(order());

    renderPage();
    await screen.findByRole('heading', { name: 'Project details' });

    expect(Object.values(useBreadcrumbStore.getState().labels)).toContain('741 Bridle Path');
  });

  it('offers Edit order while the order can still be changed', async () => {
    vi.mocked(createdOrderService.get).mockResolvedValue(order({ editable: true }));

    renderPage();
    // The header renders its actions once per layout (mobile and desktop).
    const [editButton] = await screen.findAllByRole('button', { name: 'Edit order' });
    await userEvent.setup().click(editButton);

    expect(await screen.findByText('Edit form')).toBeInTheDocument();
    expect(screen.queryByText(/now being processed/)).not.toBeInTheDocument();
  });

  it('is read-only, and says why, once staff have moved the order on', async () => {
    vi.mocked(createdOrderService.get).mockResolvedValue(order({ editable: false }));

    renderPage();

    expect(await screen.findByText(/now being processed/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit order' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Project details' })).toBeInTheDocument();
  });

  it('shows when the customer last changed the order', async () => {
    vi.mocked(createdOrderService.get).mockResolvedValue(order({ updatedAt: '2026-10-14T09:00:00Z' }));

    renderPage();

    expect(await screen.findByText('Last changed')).toBeInTheDocument();
  });

  it('says so, and offers the way back, when the order is not found', async () => {
    vi.mocked(createdOrderService.get).mockRejectedValue(notFound());

    renderPage('someone-elses');

    expect(await screen.findByText('We could not find this order.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View all orders' })).toBeInTheDocument();
  });
});
