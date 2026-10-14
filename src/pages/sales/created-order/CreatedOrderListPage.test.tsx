import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { CreatedOrder, CreatedOrderPage } from '@/types/createdOrder';

vi.mock('@/services/createdOrderService', () => ({
  createdOrderService: { list: vi.fn(), create: vi.fn() },
}));

import CreatedOrderListPage from './CreatedOrderListPage';
import { createdOrderService } from '@/services/createdOrderService';

function order(overrides: Partial<CreatedOrder> = {}): CreatedOrder {
  return {
    id: 'o1',
    status: 'pending_review',
    createdAt: '2026-10-12T15:30:00Z',
    builder: 'Highland Homes',
    community: 'Sandbrock Ranch',
    plan: '214',
    phone: '+1 480 209 5330',
    email: 'brandon@highlandhomes.com',
    installAddress: '741 Bridle Path',
    city: 'Aubrey',
    zip: '76227',
    measureDate: '2026-10-06',
    installDate: '2026-10-19',
    specialInstructions: '',
    areas: [],
    ...overrides,
  };
}

function page(orders: CreatedOrder[], nextCursor = ''): CreatedOrderPage {
  return { orders, nextCursor };
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/sales/created-orders']}>
        <Routes>
          <Route path="/sales/created-orders" element={<CreatedOrderListPage />} />
          <Route path="/sales/created-orders/new" element={<div>New order form</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return userEvent.setup();
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('CreatedOrderListPage', () => {
  it('invites the customer to create a first order when there are none', async () => {
    vi.mocked(createdOrderService.list).mockResolvedValue(page([]));
    renderPage();

    expect(await screen.findByText('No orders yet')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Create your first order/ })).toBeInTheDocument();
  });

  it('lists each order with its address, builder, dates, area count and status', async () => {
    vi.mocked(createdOrderService.list).mockResolvedValue(
      page([order({ areas: [{ kind: 'kitchen' } as CreatedOrder['areas'][number]] })]),
    );
    renderPage();

    expect(await screen.findByText('741 Bridle Path')).toBeInTheDocument();
    expect(screen.getByText('Aubrey, 76227')).toBeInTheDocument();
    expect(screen.getByText('Highland Homes')).toBeInTheDocument();
    expect(screen.getByText('Sandbrock Ranch')).toBeInTheDocument();
    expect(screen.getByText('Plan 214')).toBeInTheDocument();
    expect(screen.getByText('1 area')).toBeInTheDocument();
    expect(screen.getByText('Pending review')).toBeInTheDocument();
    expect(screen.getByText('Oct 6, 2026', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('Oct 19, 2026', { exact: false })).toBeInTheDocument();
  });

  it('opens the new-order form from the Create Order button', async () => {
    vi.mocked(createdOrderService.list).mockResolvedValue(page([order()]));
    const user = renderPage();
    await screen.findByText('741 Bridle Path');

    await user.click(screen.getByRole('button', { name: /Create Order/ }));

    expect(screen.getByText('New order form')).toBeInTheDocument();
  });

  it('keeps the Create Order button available while the list is empty', async () => {
    vi.mocked(createdOrderService.list).mockResolvedValue(page([]));
    renderPage();
    await screen.findByText('No orders yet');

    expect(screen.getByRole('button', { name: 'Create Order' })).toBeInTheDocument();
  });

  it('loads the next page when asked, passing the server cursor through untouched', async () => {
    vi.mocked(createdOrderService.list)
      .mockResolvedValueOnce(page([order({ id: 'o1', installAddress: '1 First St' })], 'CURSOR-2'))
      .mockResolvedValueOnce(page([order({ id: 'o2', installAddress: '2 Second St' })]));
    const user = renderPage();
    await screen.findByText('1 First St');

    await user.click(screen.getByRole('button', { name: 'Load more' }));

    expect(await screen.findByText('2 Second St')).toBeInTheDocument();
    expect(createdOrderService.list).toHaveBeenNthCalledWith(2, 'CURSOR-2');
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument());
  });

  it('shows the failure and lets the customer retry', async () => {
    vi.mocked(createdOrderService.list)
      .mockRejectedValueOnce(new Error('Service unavailable'))
      .mockResolvedValueOnce(page([order()]));
    const user = renderPage();

    expect(await screen.findByText('Service unavailable')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('741 Bridle Path')).toBeInTheDocument();
  });
});
