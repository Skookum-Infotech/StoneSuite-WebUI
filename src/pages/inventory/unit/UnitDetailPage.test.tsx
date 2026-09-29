import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('@/services/inventoryUnitService', () => ({
  inventoryUnitService: { getUnit: vi.fn(), getHistory: vi.fn(), searchUnits: vi.fn() },
}));
vi.mock('@/hooks/useUserPermissions', () => ({ useUserPermissions: vi.fn() }));
vi.mock('./components/MoveUnitDialog', () => ({ MoveUnitDialog: () => null }));
vi.mock('./components/ScrapUnitDialog', () => ({ ScrapUnitDialog: () => null }));
vi.mock('./components/CutUnitDialog', () => ({ CutUnitDialog: () => null }));

import UnitDetailPage from './UnitDetailPage';
import { inventoryUnitService } from '@/services/inventoryUnitService';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { makeCutUnit, makeUnit } from './components/unitFixtures';
import type { InventoryUnit } from '@/types/inventory';

function renderPage(unit: InventoryUnit) {
  vi.mocked(useUserPermissions).mockReturnValue({
    grants: [], isLoading: false, activeRoleId: '', isSuperAdmin: false, hasPermission: () => true,
  } as ReturnType<typeof useUserPermissions>);
  vi.mocked(inventoryUnitService.getUnit).mockResolvedValue(unit);
  vi.mocked(inventoryUnitService.getHistory).mockResolvedValue([
    { action: 'moved', field: 'bin', oldValue: '', newValue: '', fromBin: 'Yard / A1', toBin: 'Yard / B2', at: '2026-09-29T09:00:00', byName: 'Sam' },
  ]);
  vi.mocked(inventoryUnitService.searchUnits).mockResolvedValue({ records: [], nextCursor: '', hasMore: false });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/inventory/unit/${unit.id}`]}>
        <Routes>
          <Route path="/inventory/unit/:id" element={<UnitDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('UnitDetailPage', () => {
  it('opens on the usage, with usage as the first tab', async () => {
    renderPage(makeCutUnit(30, 15.2, 2));

    expect(await screen.findByText('66% used')).toBeInTheDocument();
    // Tab order as laid out on the page (the sidebar can repeat a label after them).
    const tabs = screen.getAllByRole('button', { name: /^(Usage|Details|History)$/ });
    expect(tabs.slice(0, 3).map((t) => t.textContent)).toEqual(['Usage', 'Details', 'History']);
    expect(screen.getByRole('heading', { name: 'Lifecycle' })).toBeInTheDocument();
    // The reference sheet is one click away, not competing with the usage.
    expect(screen.queryByRole('heading', { name: 'Unit Information' })).not.toBeInTheDocument();
  });

  it('keeps the static facts on a Details tab', async () => {
    renderPage(makeUnit());
    const user = userEvent.setup();
    await screen.findByText('Untouched', { selector: 'p' });

    await user.click(screen.getByRole('button', { name: 'Details' }));

    expect(screen.getByRole('heading', { name: 'Unit Information' })).toBeInTheDocument();
    expect(screen.getByText('45.20 sq ft')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Usage' })).not.toBeInTheDocument();
  });

  it('loads the movement history only when its tab is opened', async () => {
    renderPage(makeUnit());
    const user = userEvent.setup();
    await screen.findByText('Untouched', { selector: 'p' });
    expect(inventoryUnitService.getHistory).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'History' }));

    expect(await screen.findByText('Yard / A1 → Yard / B2')).toBeInTheDocument();
  });

  it('keeps the move, cut and scrap actions for a slab in stock', async () => {
    renderPage(makeUnit());

    await screen.findByText('Untouched', { selector: 'p' });
    // The sidebar renders its content for both the desktop and the mobile drawer.
    for (const name of [/Move Bin/, /^Cut$/, /Scrap/]) {
      const buttons = screen.getAllByRole('button', { name });
      expect(buttons.length).toBeGreaterThan(0);
      buttons.forEach((b) => expect(b).toBeEnabled());
    }
  });

  it('explains why a cut slab can no longer be acted on', async () => {
    renderPage(makeCutUnit(30, 15.2, 2));

    await screen.findByText('66% used');
    screen.getAllByRole('button', { name: /Move Bin/ }).forEach((b) => expect(b).toBeDisabled());
    expect(screen.getAllByText('Unit is consumed.').length).toBeGreaterThan(0);
  });
});
