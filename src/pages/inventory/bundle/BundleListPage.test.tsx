import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/hooks/useUserPermissions', () => ({ useUserPermissions: vi.fn() }));
vi.mock('@/services/inventoryBundleService', () => ({ inventoryBundleService: { listBundles: vi.fn() } }));
vi.mock('./components/NewBundleDialog', () => ({ NewBundleDialog: () => null }));

import BundleListPage from './BundleListPage';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { inventoryBundleService } from '@/services/inventoryBundleService';
import type { Bundle } from '@/types/inventory';

const BUNDLE = {
  id: 'b-7', code: 'BDL-0007', status: 'open', inventoryItemName: 'Absolute Black',
  memberCount: 4, totalArea: 120.5, binPath: 'YARD/A1', warehouseName: 'Main Yard',
} as unknown as Bundle;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useUserPermissions).mockReturnValue({
    isLoading: false, hasPermission: () => true,
  } as unknown as ReturnType<typeof useUserPermissions>);
  vi.mocked(inventoryBundleService.listBundles).mockResolvedValue([BUNDLE]);
});

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <BundleListPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('BundleListPage', () => {
  // A real link (not a clickable <tr>) is what makes the row reachable by
  // keyboard and openable in a new tab.
  it('makes the bundle code a real link to the bundle', async () => {
    renderPage();

    const link = await screen.findByRole('link', { name: 'BDL-0007' });
    expect(link).toHaveAttribute('href', '/inventory/bundle/b-7');
  });

  it('stretches the link over the whole row so any cell is a click target', async () => {
    renderPage();

    const link = await screen.findByRole('link', { name: 'BDL-0007' });
    expect(link.className).toContain('after:absolute');
    expect(link.closest('tr')?.className).toContain('relative');
  });
});
