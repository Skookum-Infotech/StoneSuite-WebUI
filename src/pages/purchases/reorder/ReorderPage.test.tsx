import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReorderItem } from '@/types/replenishment';
import type { CreatedBatch } from '@/lib/replenishment';

vi.mock('react-router-dom', async () => ({
  Link: (await import('@/test/routerLinkStub')).RouterLinkStub,
}));
vi.mock('@/services/replenishmentService', () => ({ replenishmentService: { list: vi.fn() } }));
vi.mock('./components/ReorderItemCard', () => ({
  ReorderItemCard: ({ item, onCreated }: { item: ReorderItem; onCreated: (b: CreatedBatch) => void }) => (
    <div data-testid="reorder-card">
      {item.name}
      <button
        type="button"
        onClick={() => onCreated({ key: 'k1', itemName: item.name, orders: [{ id: 'po-1', vendorName: 'Vendor A' }] })}
      >
        Fake create
      </button>
    </div>
  ),
}));

import ReorderPage from './ReorderPage';
import { replenishmentService } from '@/services/replenishmentService';

function item(overrides: Partial<ReorderItem> = {}): ReorderItem {
  return {
    inventoryItemId: 'i1', sku: 'S1', name: 'Item One', tracking: 'serialized', unit: 'slabs', usage: [],
    monthlyRequirement: 5, onHand: 1, onOrder: 0, needed: 4, ...overrides,
  };
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <ReorderPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => vi.clearAllMocks());

describe('ReorderPage', () => {
  it('says nothing needs reordering when the list is empty', async () => {
    vi.mocked(replenishmentService.list).mockResolvedValue({ months: ['2026-08', '2026-09', '2026-10'], items: [] });
    renderPage();

    expect(await screen.findByText(/Nothing needs reordering/)).toBeInTheDocument();
  });

  it('names the months the usage is based on', async () => {
    vi.mocked(replenishmentService.list).mockResolvedValue({ months: ['2026-08', '2026-09', '2026-10'], items: [item()] });
    renderPage();

    expect(await screen.findByText(/in Aug, Sep, and Oct/)).toBeInTheDocument();
  });

  it('renders one card per short item', async () => {
    vi.mocked(replenishmentService.list).mockResolvedValue({
      months: [], items: [item(), item({ inventoryItemId: 'i2', name: 'Item Two' })],
    });
    renderPage();

    const cards = await screen.findAllByTestId('reorder-card');
    expect(cards.map((c) => c.textContent)).toEqual(['Item OneFake create', 'Item TwoFake create']);
  });

  it('keeps a link to the POs just created, and lets it be dismissed', async () => {
    vi.mocked(replenishmentService.list).mockResolvedValue({ months: [], items: [item()] });
    renderPage();
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Fake create' }));

    const link = screen.getByRole('link', { name: 'Open draft purchase order for Vendor A' });
    expect(link).toHaveAttribute('href', '/purchases/purchase_order/po-1');

    await user.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByRole('link', { name: /Open draft purchase order/ })).not.toBeInTheDocument();
  });

  it('recalculates when Compute is clicked', async () => {
    vi.mocked(replenishmentService.list).mockResolvedValue({ months: [], items: [] });
    renderPage();
    const user = userEvent.setup();

    await screen.findByText(/Nothing needs reordering/);
    expect(replenishmentService.list).toHaveBeenCalledTimes(1);

    vi.mocked(replenishmentService.list).mockResolvedValue({ months: [], items: [item({ name: 'Newly short' })] });
    await user.click(screen.getByRole('button', { name: 'Compute' }));

    expect(await screen.findByText('Newly short')).toBeInTheDocument();
    expect(replenishmentService.list).toHaveBeenCalledTimes(2);
  });

  it('shows an error when the list cannot be loaded', async () => {
    vi.mocked(replenishmentService.list).mockRejectedValue(new Error('nope'));
    renderPage();

    expect(await screen.findByText(/Failed to load reorder suggestions|nope/)).toBeInTheDocument();
  });
});
