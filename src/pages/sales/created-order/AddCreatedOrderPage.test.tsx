import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import type { CreatedOrder } from '@/types/createdOrder';

// Keep the real createOrderErrorMessage; only the API object is faked.
vi.mock('@/services/createdOrderService', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  createdOrderService: { create: vi.fn(), list: vi.fn() },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn() } }));
// jsdom has no scrollIntoView, which the shared hook calls unguarded.
vi.mock('@/hooks/useScrollToError', () => ({ useScrollToError: () => null }));

import AddCreatedOrderPage from './AddCreatedOrderPage';
import { createdOrderService } from '@/services/createdOrderService';
import { toast } from 'sonner';

const NEW_PATH = '/sales/created-orders/new';
const LIST_PATH = '/sales/created-orders';

function renderPage() {
  const router = createMemoryRouter(
    [
      { path: NEW_PATH, element: <AddCreatedOrderPage /> },
      { path: LIST_PATH, element: <div>Orders list</div> },
    ],
    { initialEntries: [NEW_PATH] },
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { router, user: userEvent.setup() };
}

type User = ReturnType<typeof userEvent.setup>;

/** The card for an area, found by its accessible name. */
function card(name: string): HTMLElement {
  return screen.getByRole('article', { name });
}

async function pickDay(user: User, triggerName: string, day: string) {
  await user.click(screen.getByRole('button', { name: triggerName }));
  const cell = screen.getByRole('gridcell', { name: day }).querySelector('button');
  if (!cell) throw new Error(`no day button for ${day}`);
  await user.click(cell);
}

async function fillProjectDetails(user: User) {
  await user.type(screen.getByLabelText(/^Builder/), 'Highland Homes');
  await user.type(screen.getByLabelText(/^Community/), 'Sandbrock Ranch');
  await user.type(screen.getByLabelText(/^Plan/), '214');
  await user.type(screen.getByLabelText(/^Phone/), '4802095330');
  await user.type(screen.getByLabelText(/^Email/), 'brandon@highlandhomes.com');
  await user.type(screen.getByLabelText(/^Install Address/), '741 Bridle Path');
  await user.type(screen.getByLabelText(/^City/), 'Aubrey');
  await user.type(screen.getByLabelText(/^ZIP/), '76227');
  await pickDay(user, 'Measure Date (required)', '10');
  await pickDay(user, 'Install Date (required)', '20');
}

function createdOrder(): CreatedOrder {
  return {
    id: 'o1',
    status: 'submitted',
    createdAt: '2026-10-14T10:00:00Z',
  } as CreatedOrder;
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

describe('AddCreatedOrderPage', () => {
  it('opens with the two steps and no areas', () => {
    renderPage();

    expect(screen.getByRole('heading', { name: 'Project details' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Areas' })).toBeInTheDocument();
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
  });

  it('shows no errors until Submit is pressed, then lists what is missing without calling the API', async () => {
    const { user } = renderPage();
    expect(screen.queryByText('Builder is required.')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Submit order' }));

    expect(screen.getByText('Builder is required.')).toBeInTheDocument();
    expect(screen.getByText('Email is required.')).toBeInTheDocument();
    expect(screen.getByText('Add at least one area to your order.')).toBeInTheDocument();
    expect(createdOrderService.create).not.toHaveBeenCalled();
  });

  it('adds an area card from its chip and marks single-use areas as added', async () => {
    const { user } = renderPage();

    await user.click(screen.getByRole('button', { name: 'Add Kitchen' }));

    expect(card('Kitchen')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Kitchen already added' })).toBeDisabled();
  });

  it('shows only the inputs an area kind has', async () => {
    const { user } = renderPage();
    await user.click(screen.getByRole('button', { name: 'Add Kitchen' }));
    await user.click(screen.getByRole('button', { name: 'Add Island' }));

    const kitchen = within(card('Kitchen'));
    const island = within(card('Island'));
    expect(kitchen.getByLabelText('Backsplash Height')).toBeInTheDocument();
    expect(kitchen.getByLabelText('Cooktop Model')).toBeInTheDocument();
    expect(island.queryByLabelText('Backsplash Height')).not.toBeInTheDocument();
    expect(island.getByRole('group', { name: 'Pop-up Outlet for Island' })).toBeInTheDocument();
  });

  it('lets Bath be added repeatedly, numbering each', async () => {
    const { user } = renderPage();

    await user.click(screen.getByRole('button', { name: 'Add Bath' }));
    await user.click(screen.getByRole('button', { name: 'Add Bath' }));

    expect(card('Bath')).toBeInTheDocument();
    expect(card('Bath 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add Bath' })).toBeEnabled();
  });

  it('removes an area and offers its chip again', async () => {
    const { user } = renderPage();
    await user.click(screen.getByRole('button', { name: 'Add Pantry' }));

    await user.click(screen.getByRole('button', { name: 'Remove Pantry' }));

    expect(screen.queryByRole('article', { name: 'Pantry' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add Pantry' })).toBeEnabled();
  });

  it('toggles each Faucet Spread position independently', async () => {
    const { user } = renderPage();
    await user.click(screen.getByRole('button', { name: 'Add Primary / Master Bath' }));

    const group = within(screen.getByRole('group', { name: 'Faucet spread for Primary / Master Bath' }));
    await user.click(group.getByRole('button', { name: '2 inches left of centre' }));
    await user.click(group.getByRole('button', { name: '2 inches right of centre' }));

    expect(group.getByRole('button', { name: '2 inches left of centre, selected' })).toHaveAttribute('aria-pressed', 'true');
    expect(group.getByRole('button', { name: '2 inches right of centre, selected' })).toHaveAttribute('aria-pressed', 'true');
    expect(group.getByRole('button', { name: 'centre' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('copies Color, Finish and Edge from another area', async () => {
    const { user } = renderPage();
    await user.click(screen.getByRole('button', { name: 'Add Kitchen' }));
    await user.type(within(card('Kitchen')).getByLabelText(/^Color/), 'Serene');
    await user.click(screen.getByRole('button', { name: 'Add Island' }));

    await user.click(within(card('Island')).getByRole('button', { name: 'Copy Color, Finish and Edge from Kitchen' }));

    expect(within(card('Island')).getByLabelText(/^Color/)).toHaveValue('Serene');
  });

  it('submits a complete order, then returns to the list with a confirmation', async () => {
    vi.mocked(createdOrderService.create).mockResolvedValue(createdOrder());
    const { user, router } = renderPage();

    await fillProjectDetails(user);
    await user.click(screen.getByRole('button', { name: 'Add Kitchen' }));
    await user.type(within(card('Kitchen')).getByLabelText(/^Color/), ' Serene ');
    await user.click(
      within(screen.getByRole('group', { name: 'Faucet spread for Kitchen' })).getByRole('button', {
        name: 'centre',
      }),
    );
    await user.click(screen.getByRole('button', { name: 'Submit order' }));

    await waitFor(() => expect(createdOrderService.create).toHaveBeenCalledTimes(1));
    const payload = vi.mocked(createdOrderService.create).mock.calls[0][0];
    expect(payload).toMatchObject({
      builder: 'Highland Homes',
      community: 'Sandbrock Ranch',
      plan: '214',
      email: 'brandon@highlandhomes.com',
      installAddress: '741 Bridle Path',
      city: 'Aubrey',
      zip: '76227',
    });
    expect(payload.phone).toMatch(/480/);
    expect(payload.measureDate).toMatch(/^\d{4}-\d{2}-10$/);
    expect(payload.installDate).toMatch(/^\d{4}-\d{2}-20$/);
    expect(payload.areas).toHaveLength(1);
    expect(payload.areas[0]).toMatchObject({ kind: 'kitchen', name: 'Kitchen', color: 'Serene', faucetSpread: ['C'] });

    await waitFor(() => expect(router.state.location.pathname).toBe(LIST_PATH));
    expect(toast.success).toHaveBeenCalledWith('Order submitted');
  });

  it('keeps the entries and shows the reason when submitting fails', async () => {
    vi.mocked(createdOrderService.create).mockRejectedValue(new Error('Plan 214 is not available.'));
    const { user, router } = renderPage();
    await fillProjectDetails(user);
    await user.click(screen.getByRole('button', { name: 'Add Kitchen' }));
    await user.type(within(card('Kitchen')).getByLabelText(/^Color/), 'Serene');

    await user.click(screen.getByRole('button', { name: 'Submit order' }));

    expect(await screen.findByText('Plan 214 is not available.')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(NEW_PATH);
    expect(screen.getByLabelText(/^Builder/)).toHaveValue('Highland Homes');
  });
});
