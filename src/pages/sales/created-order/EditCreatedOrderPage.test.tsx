import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import type { CreatedOrder } from '@/types/createdOrder';

// Keep the real createOrderErrorMessage; only the API object is faked.
vi.mock('@/services/createdOrderService', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  createdOrderService: { get: vi.fn(), update: vi.fn(), list: vi.fn(), create: vi.fn() },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn() } }));
// jsdom has no scrollIntoView, which the shared hook calls unguarded.
vi.mock('@/hooks/useScrollToError', () => ({ useScrollToError: () => null }));

import EditCreatedOrderPage from './EditCreatedOrderPage';
import { createdOrderService } from '@/services/createdOrderService';
import { toast } from 'sonner';

const EDIT_PATH = '/sales/created-orders/o1/edit';
const DETAIL_PATH = '/sales/created-orders/o1';
const FLOW_TIMEOUT_MS = 20_000;

function saved(overrides: Partial<CreatedOrder> = {}): CreatedOrder {
  return {
    id: 'o1',
    status: 'submitted',
    editable: true,
    createdAt: '2026-10-12T15:30:00Z',
    builder: 'Highland Homes',
    community: 'Sandbrock Ranch',
    plan: '214',
    phone: '+14802095330',
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
    ],
    ...overrides,
  };
}

function httpError(status: number, message: string): AxiosError {
  const err = new AxiosError('Request failed');
  err.response = { status, data: { success: false, message } } as AxiosError['response'];
  return err;
}

function renderPage() {
  const router = createMemoryRouter(
    [
      { path: '/sales/created-orders/:id/edit', element: <EditCreatedOrderPage /> },
      { path: '/sales/created-orders/:id', element: <div>Order detail</div> },
      { path: '/sales/created-orders', element: <div>Orders list</div> },
    ],
    { initialEntries: [EDIT_PATH] },
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { router, user: userEvent.setup() };
}

// Radix's Switch (the Half Wall toggle) measures itself with a ResizeObserver,
// which jsdom does not provide.
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

beforeAll(() => {
  vi.stubGlobal('ResizeObserver', ResizeObserverStub);
});

afterAll(() => {
  vi.unstubAllGlobals();
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('EditCreatedOrderPage', () => {
  it('opens the form on the saved order', async () => {
    vi.mocked(createdOrderService.get).mockResolvedValue(saved());

    renderPage();

    expect(await screen.findByRole('form', { name: 'Edit countertop order' })).toBeInTheDocument();
    expect(createdOrderService.get).toHaveBeenCalledWith('o1');
    expect(screen.getByLabelText(/^Builder/)).toHaveValue('Highland Homes');
    expect(screen.getByLabelText(/^Install Address/)).toHaveValue('741 Bridle Path');
    const kitchen = within(screen.getByRole('article', { name: 'Kitchen' }));
    expect(kitchen.getByLabelText(/^Color/)).toHaveValue('Serene');
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeInTheDocument();
  });

  it('saves the whole changed order, then returns to it with a confirmation', async () => {
    vi.mocked(createdOrderService.get).mockResolvedValue(saved());
    vi.mocked(createdOrderService.update).mockResolvedValue(saved({ builder: 'Highland Estates' }));
    const { user, router } = renderPage();
    const builder = await screen.findByLabelText(/^Builder/);

    await user.clear(builder);
    await user.type(builder, 'Highland Estates');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(createdOrderService.update).toHaveBeenCalledTimes(1));
    const [id, payload] = vi.mocked(createdOrderService.update).mock.calls[0];
    expect(id).toBe('o1');
    expect(payload).toMatchObject({
      builder: 'Highland Estates',
      community: 'Sandbrock Ranch',
      installDate: '2026-10-26',
      specialInstructions: 'Gate code 1234.',
    });
    expect(payload.areas).toHaveLength(1);
    expect(payload.areas[0]).toMatchObject({
      kind: 'kitchen', name: 'Kitchen', color: 'Serene', edge: 'Flat', faucetSpread: ['L8', 'C'],
      notes: 'Seam at the window.',
    });
    expect(payload.areas[0]).not.toHaveProperty('key');
    expect(createdOrderService.create).not.toHaveBeenCalled();

    await waitFor(() => expect(router.state.location.pathname).toBe(DETAIL_PATH));
    expect(toast.success).toHaveBeenCalledWith('Order updated');
  }, FLOW_TIMEOUT_MS);

  it('keeps an install date that has already passed, as the server does', async () => {
    vi.mocked(createdOrderService.get).mockResolvedValue(
      saved({ measureDate: '2020-01-10', installDate: '2020-01-15' }),
    );
    vi.mocked(createdOrderService.update).mockResolvedValue(saved());
    const { user } = renderPage();
    await screen.findByRole('form', { name: 'Edit countertop order' });

    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(createdOrderService.update).toHaveBeenCalledTimes(1));
    expect(screen.queryByText('Install Date cannot be in the past.')).not.toBeInTheDocument();
  }, FLOW_TIMEOUT_MS);

  it('shows the reason and keeps the entries when the server refuses the change', async () => {
    vi.mocked(createdOrderService.get).mockResolvedValue(saved());
    vi.mocked(createdOrderService.update).mockRejectedValue(
      httpError(409, "This order is now being processed and can't be changed here. Please contact us."),
    );
    const { user, router } = renderPage();
    await screen.findByRole('form', { name: 'Edit countertop order' });

    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText(/now being processed/)).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(EDIT_PATH);
    expect(screen.getByLabelText(/^Builder/)).toHaveValue('Highland Homes');
  }, FLOW_TIMEOUT_MS);

  it('shows no form once staff have moved the order on', async () => {
    vi.mocked(createdOrderService.get).mockResolvedValue(saved({ editable: false }));
    const { user, router } = renderPage();

    expect(await screen.findByText(/can't be changed here/)).toBeInTheDocument();
    expect(screen.queryByRole('form')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'View order' }));
    expect(router.state.location.pathname).toBe(DETAIL_PATH);
  });

  it('says so when the order is not found', async () => {
    vi.mocked(createdOrderService.get).mockRejectedValue(httpError(404, 'Order not found.'));

    renderPage();

    expect(await screen.findByText('We could not find this order.')).toBeInTheDocument();
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View all orders' })).toBeInTheDocument();
  });
});
