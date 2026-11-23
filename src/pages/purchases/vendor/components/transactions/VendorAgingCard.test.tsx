import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError } from 'axios';

vi.mock('@/services/vendorTransactionsService', () => ({
  vendorTransactionsService: { aging: vi.fn() },
}));

import { VendorAgingCard } from './VendorAgingCard';
import { vendorTransactionsService } from '@/services/vendorTransactionsService';
import { moneyOrDash } from '@/lib/customerTransactions';
import type { VendorAging } from '@/types/vendorTransactions';

const aging = vi.mocked(vendorTransactionsService.aging);

const BUCKETS = [
  { label: 'current', amount: 1250.5, count: 3 },
  { label: '1-30', amount: 400, count: 1 },
  { label: '31-60', amount: 75.25, count: 2 },
  { label: '61+', amount: 10, count: 1 },
];
const ZERO_BUCKETS = BUCKETS.map((b) => ({ ...b, amount: 0, count: 0 }));

function makeAging(o: Partial<VendorAging> = {}): VendorAging {
  return { buckets: BUCKETS, total: 1735.75, scopeLimited: false, ...o };
}

function renderCard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <VendorAgingCard vendorId="v-1" />
    </QueryClientProvider>,
  );
}

// Escapes every regex metacharacter (a bare .replace('$', ...) only reaches the first).
const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

describe('VendorAgingCard', () => {
  beforeEach(() => {
    aging.mockReset();
  });

  it('shows each bucket exactly as the server returned it, with the total', async () => {
    aging.mockResolvedValue(makeAging());
    renderCard();
    const card = await screen.findByRole('region', { name: 'Open bills by age' });
    const items = within(card).getAllByRole('listitem');
    expect(items).toHaveLength(BUCKETS.length);
    expect(items[0]).toHaveAccessibleName(`Current: ${moneyOrDash(1250.5)}, 3 bills`);
    expect(items[1]).toHaveAccessibleName(`1–30 days: ${moneyOrDash(400)}, 1 bill`);
    expect(items[2]).toHaveAccessibleName(`31–60 days: ${moneyOrDash(75.25)}, 2 bills`);
    expect(items[3]).toHaveAccessibleName(`61+ days: ${moneyOrDash(10)}, 1 bill`);
    expect(within(card).getByText(`Total open ${moneyOrDash(1735.75)}`)).toBeInTheDocument();
    expect(aging).toHaveBeenCalledWith('v-1');
  });

  it('shows zeros, with no error, for a vendor with no open bills', async () => {
    aging.mockResolvedValue(makeAging({ buckets: ZERO_BUCKETS, total: 0 }));
    renderCard();
    const card = await screen.findByRole('region', { name: 'Open bills by age' });
    const items = within(card).getAllByRole('listitem');
    expect(items).toHaveLength(ZERO_BUCKETS.length);
    for (const item of items) {
      expect(item).toHaveAccessibleName(new RegExp(`${escapeRegExp(moneyOrDash(0))}, 0 bills$`));
    }
    expect(within(card).getByText(`Total open ${moneyOrDash(0)}`)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows an inline error with a Retry button that loads the figures', async () => {
    aging.mockRejectedValueOnce(new Error('aging is down'));
    renderCard();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('aging is down');

    aging.mockResolvedValue(makeAging());
    await userEvent.setup().click(screen.getByRole('button', { name: 'Retry' }));
    const card = await screen.findByRole('region', { name: 'Open bills by age' });
    expect(within(card).getAllByRole('listitem')).toHaveLength(BUCKETS.length);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(aging).toHaveBeenCalledTimes(2);
  });

  it("uses the server's message for an API error", async () => {
    aging.mockRejectedValue(new AxiosError('x', '500', undefined, undefined, {
      status: 500, data: { message: 'Failed to load vendor aging.' }, statusText: '', headers: {}, config: {} as never,
    }));
    renderCard();
    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to load vendor aging.');
  });

  it('says it is loading while the request is in flight', () => {
    aging.mockReturnValue(new Promise(() => {}));
    renderCard();
    expect(screen.getByRole('status')).toHaveTextContent('Loading open bills by age…');
  });

  it('renders nothing when the caller cannot read vendor bills', async () => {
    aging.mockResolvedValue(makeAging({ buckets: null, total: 0 }));
    const { container } = renderCard();
    await vi.waitFor(() => expect(aging).toHaveBeenCalled());
    await vi.waitFor(() => expect(screen.queryByRole('status')).toBeNull());
    expect(container).toBeEmptyDOMElement();
  });

  it('notes when the figures cover only the records the caller can see', async () => {
    aging.mockResolvedValue(makeAging({ scopeLimited: true }));
    renderCard();
    expect(await screen.findByText('Based on records you can see.')).toBeInTheDocument();
  });

  it('falls back to the raw label for a bucket it does not know', async () => {
    aging.mockResolvedValue(makeAging({ buckets: [{ label: '90+', amount: 5, count: 1 }], total: 5 }));
    renderCard();
    expect(await screen.findByRole('listitem', { name: `90+: ${moneyOrDash(5)}, 1 bill` })).toBeInTheDocument();
  });
});
