import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import type { CreatedOrder } from '@/types/createdOrder';

vi.mock('@/services/salesOrderService', () => ({
  salesOrderService: { getCustomerOrderForm: vi.fn(), updateCustomerOrderForm: vi.fn() },
}));
vi.mock('@/hooks/useUserPermissions', () => ({ useUserPermissions: vi.fn() }));
vi.mock('@/store/useAuthStore', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  isPortalSession: vi.fn(),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { CustomerOrderFormAction } from './CustomerOrderFormAction';
import { salesOrderService } from '@/services/salesOrderService';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { isPortalSession } from '@/store/useAuthStore';
import { toast } from 'sonner';

const FLOW_TIMEOUT_MS = 20_000;

function form(overrides: Partial<CreatedOrder> = {}): CreatedOrder {
  return {
    id: 'f1',
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
        sinkModel: '440185', cooktopModel: '', waterfallQty: 0, popUpOutlet: 0, halfWall: false,
        location: '', faucetSpread: ['C'], notes: 'Seam at the window.',
      },
    ],
    ...overrides,
  };
}

function renderAction(opts: { superAdmin?: boolean; isDraft?: boolean } = {}) {
  vi.mocked(useUserPermissions).mockReturnValue({
    grants: [],
    isLoading: false,
    activeRoleId: '',
    isSuperAdmin: opts.superAdmin ?? false,
    hasPermission: () => true,
  } as ReturnType<typeof useUserPermissions>);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <CustomerOrderFormAction orderId="so-1" isDraft={opts.isDraft ?? true} />
    </QueryClientProvider>,
  );
  return { user: userEvent.setup(), client };
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
  vi.mocked(isPortalSession).mockReturnValue(false);
});

describe('CustomerOrderFormAction', () => {
  it('is not there for an order that was not placed from the portal', async () => {
    vi.mocked(salesOrderService.getCustomerOrderForm).mockResolvedValue(null);

    renderAction();

    await waitFor(() => expect(salesOrderService.getCustomerOrderForm).toHaveBeenCalledWith('so-1'));
    expect(screen.queryByRole('button', { name: 'View customer order form' })).not.toBeInTheDocument();
  });

  it('does not even ask in a customer portal session', () => {
    vi.mocked(isPortalSession).mockReturnValue(true);

    renderAction();

    expect(salesOrderService.getCustomerOrderForm).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'View customer order form' })).not.toBeInTheDocument();
  });

  it('opens the form the customer filed, read-only, in a large modal', async () => {
    vi.mocked(salesOrderService.getCustomerOrderForm).mockResolvedValue(form());
    const { user } = renderAction();

    await user.click(await screen.findByRole('button', { name: 'View customer order form' }));

    const dialog = within(screen.getByRole('dialog', { name: 'Customer Order Form' }));
    expect(dialog.getByRole('heading', { name: 'Project details' })).toBeInTheDocument();
    expect(dialog.getByText('Sandbrock Ranch')).toBeInTheDocument();
    expect(dialog.getByText('Gate code 1234.')).toBeInTheDocument();
    expect(dialog.getByRole('heading', { name: 'Areas (1)' })).toBeInTheDocument();
    expect(within(dialog.getByRole('article', { name: 'Kitchen' })).getByText('Serene')).toBeInTheDocument();
    expect(dialog.getByText('The customer can still change this order from their portal.')).toBeInTheDocument();
    // Nothing is an input: it is the read-only view.
    expect(dialog.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('says the order is locked for the customer once the sales order has moved on', async () => {
    vi.mocked(salesOrderService.getCustomerOrderForm).mockResolvedValue(form({ editable: false }));
    const { user } = renderAction({ isDraft: false });

    await user.click(await screen.findByRole('button', { name: 'View customer order form' }));

    expect(screen.getByText(/locked for the customer/)).toBeInTheDocument();
  });

  it('offers no Edit to anyone but a super admin', async () => {
    vi.mocked(salesOrderService.getCustomerOrderForm).mockResolvedValue(form());
    const { user } = renderAction({ superAdmin: false });

    await user.click(await screen.findByRole('button', { name: 'View customer order form' }));

    expect(screen.getByRole('dialog', { name: 'Customer Order Form' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
  });

  it('closes from the close button', async () => {
    vi.mocked(salesOrderService.getCustomerOrderForm).mockResolvedValue(form());
    const { user } = renderAction();
    await user.click(await screen.findByRole('button', { name: 'View customer order form' }));

    await user.click(screen.getByRole('button', { name: 'Close customer order form' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('lets a super admin edit the same fields and save them, then returns to read-only', async () => {
    vi.mocked(salesOrderService.getCustomerOrderForm).mockResolvedValue(form());
    vi.mocked(salesOrderService.updateCustomerOrderForm).mockResolvedValue({
      form: form({ builder: 'Highland Estates' }),
      synced: true,
    });
    const { user, client } = renderAction({ superAdmin: true });
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    await user.click(await screen.findByRole('button', { name: 'View customer order form' }));

    await user.click(screen.getByRole('button', { name: 'Edit' }));
    const builder = screen.getByLabelText(/^Builder/);
    expect(builder).toHaveValue('Highland Homes');
    await user.clear(builder);
    await user.type(builder, 'Highland Estates');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(salesOrderService.updateCustomerOrderForm).toHaveBeenCalledTimes(1));
    const [orderId, payload] = vi.mocked(salesOrderService.updateCustomerOrderForm).mock.calls[0];
    expect(orderId).toBe('so-1');
    expect(payload).toMatchObject({
      builder: 'Highland Estates',
      installDate: '2026-10-26',
      areas: [expect.objectContaining({ kind: 'kitchen', color: 'Serene', notes: 'Seam at the window.' })],
    });
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith('Customer order form saved. The sales order was updated to match.'),
    );
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['sales-order', 'so-1'] });
    expect(await screen.findByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.queryByRole('form', { name: 'Edit customer order form' })).not.toBeInTheDocument();
  }, FLOW_TIMEOUT_MS);

  it('warns that only the form changes once the sales order is no longer a draft', async () => {
    vi.mocked(salesOrderService.getCustomerOrderForm).mockResolvedValue(form({ editable: false }));
    vi.mocked(salesOrderService.updateCustomerOrderForm).mockResolvedValue({ form: form(), synced: false });
    const { user } = renderAction({ superAdmin: true, isDraft: false });
    await user.click(await screen.findByRole('button', { name: 'View customer order form' }));

    await user.click(screen.getByRole('button', { name: 'Edit' }));
    expect(screen.getByText(/no longer a draft/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Customer order form saved.'));
  }, FLOW_TIMEOUT_MS);

  it('shows the server’s reason and keeps the edits when the save is refused', async () => {
    vi.mocked(salesOrderService.getCustomerOrderForm).mockResolvedValue(form());
    const err = new AxiosError('Request failed');
    err.response = {
      status: 403,
      data: { success: false, message: 'Only a super admin can change a customer order form.' },
    } as AxiosError['response'];
    vi.mocked(salesOrderService.updateCustomerOrderForm).mockRejectedValue(err);
    const { user } = renderAction({ superAdmin: true });
    await user.click(await screen.findByRole('button', { name: 'View customer order form' }));
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    const builder = screen.getByLabelText(/^Builder/);
    await user.type(builder, ' Group');

    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Only a super admin can change a customer order form.')).toBeInTheDocument();
    expect(screen.getByLabelText(/^Builder/)).toHaveValue('Highland Homes Group');
  }, FLOW_TIMEOUT_MS);
});
