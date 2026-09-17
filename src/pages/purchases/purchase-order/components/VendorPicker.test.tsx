import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/services/vendorService', () => ({
  vendorService: { searchVendors: vi.fn() },
}));

import { VendorPicker, type VendorRef } from './VendorPicker';
import { vendorService } from '@/services/vendorService';

const ACME: VendorRef = { id: 'vend-1', name: 'Acme Stone Supply' };

function mockSearch(records: VendorRef[]) {
  vi.mocked(vendorService.searchVendors).mockResolvedValue({
    records: records.map((v) => ({ id: v.id, displayName: v.name })) as never,
    nextCursor: '',
    hasMore: false,
    scope: 'all',
  });
}

function renderPicker(props: Partial<Parameters<typeof VendorPicker>[0]> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <VendorPicker value={null} onChange={vi.fn()} {...props} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('VendorPicker', () => {
  it('picks a vendor on click', async () => {
    mockSearch([ACME]);
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderPicker({ onChange });

    const input = screen.getByRole('textbox', { name: 'Search vendor' });
    await user.click(input);
    await user.type(input, 'Acme');
    await user.click(await screen.findByRole('button', { name: /Acme Stone Supply/ }));

    expect(onChange).toHaveBeenCalledWith(ACME);
  });

  it('warns and offers Create when nothing matches', async () => {
    mockSearch([]);
    const onCreateNew = vi.fn();
    const user = userEvent.setup();
    renderPicker({ onCreateNew });

    const input = screen.getByRole('textbox', { name: 'Search vendor' });
    await user.click(input);
    await user.type(input, 'Nero Marble Co');

    expect(await screen.findByText(/“Nero Marble Co” isn't an existing vendor/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Create “Nero Marble Co” as a new vendor' }));
    expect(onCreateNew).toHaveBeenCalledWith('Nero Marble Co');
  });

  it('only warns, with no create action, when the caller omits onCreateNew', async () => {
    mockSearch([]);
    const user = userEvent.setup();
    renderPicker();

    const input = screen.getByRole('textbox', { name: 'Search vendor' });
    await user.click(input);
    await user.type(input, 'Nero Marble Co');

    expect(await screen.findByText(/Ask someone with vendor access/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /as a new vendor/ })).not.toBeInTheDocument();
  });

  it('hides Create once the typed name exactly matches an existing vendor', async () => {
    mockSearch([ACME]);
    const user = userEvent.setup();
    renderPicker({ onCreateNew: vi.fn() });

    const input = screen.getByRole('textbox', { name: 'Search vendor' });
    await user.click(input);
    await user.type(input, 'acme stone supply');

    expect(await screen.findByRole('button', { name: /Acme Stone Supply/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /as a new vendor/ })).not.toBeInTheDocument();
  });

  it('shows no warning while just browsing with an empty search', async () => {
    mockSearch([ACME]);
    const user = userEvent.setup();
    renderPicker({ onCreateNew: vi.fn() });

    await user.click(screen.getByRole('textbox', { name: 'Search vendor' }));

    expect(await screen.findByRole('button', { name: /Acme Stone Supply/ })).toBeInTheDocument();
    expect(screen.queryByText(/isn't an existing vendor/)).not.toBeInTheDocument();
  });
});
