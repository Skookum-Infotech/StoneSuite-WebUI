import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/hooks/useInventoryLookups', () => ({ useInventoryLookups: vi.fn() }));

import WarehouseListPage from './WarehouseListPage';
import { useInventoryLookups } from '@/hooks/useInventoryLookups';
import type { Warehouse } from '@/types/inventory';

const location = (over: Partial<Warehouse>): Warehouse => ({
  id: 'a', warehouseId: 1, name: 'Main Yard', phone: '',
  address: { line1: '', line2: '', suite: '', city: '', country: '', state: '', zip: '' },
  isDefault: false, ...over,
});

function renderPage(state: { warehouses?: Warehouse[]; isLoading?: boolean; error?: unknown }) {
  vi.mocked(useInventoryLookups).mockReturnValue({
    lookups: state.warehouses ? { warehouses: state.warehouses } : undefined,
    isLoading: state.isLoading ?? false,
    error: state.error ?? null,
  } as unknown as ReturnType<typeof useInventoryLookups>);
  render(<WarehouseListPage />);
}

beforeEach(() => vi.clearAllMocks());

describe('Inventory → Locations page', () => {
  it('is titled Locations, not Warehouses', () => {
    renderPage({ warehouses: [] });

    expect(screen.getByRole('heading', { name: 'Locations' })).toBeInTheDocument();
    expect(screen.queryByText(/warehouse/i)).not.toBeInTheDocument();
  });

  it('lists each location as a card with its address and phone, marking the default', () => {
    renderPage({
      warehouses: [
        location({
          id: 'main', name: 'Main Yard', phone: '555-0100', isDefault: true,
          address: { line1: '1 Quarry Rd', line2: '', suite: '', city: 'Springfield', country: 'United States of America', state: 'Illinois', zip: '62704' },
        }),
        location({ id: 'annex', warehouseId: 2, name: 'Annex' }),
      ],
    });

    expect(screen.getByRole('heading', { name: 'Main Yard' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Annex' })).toBeInTheDocument();
    expect(screen.getByText('Default')).toBeInTheDocument();
    expect(screen.getByText(/1 Quarry Rd · Springfield, Illinois, 62704 · United States of America/)).toBeInTheDocument();
    expect(screen.getByText('555-0100')).toBeInTheDocument();
  });

  it('is read-only: nothing to add, edit, delete or make default', () => {
    renderPage({ warehouses: [location({ id: 'main', isDefault: true }), location({ id: 'annex', warehouseId: 2, name: 'Annex' })] });

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('explains that locations come from Company Info when the tenant has none', () => {
    renderPage({ warehouses: [] });

    expect(screen.getByText('No locations yet')).toBeInTheDocument();
    expect(screen.getByText(/set up in Company Info/)).toBeInTheDocument();
  });

  it('shows a spinner while loading and an error when the lookups fail', () => {
    renderPage({ isLoading: true });
    expect(screen.getByText('Loading locations…')).toBeInTheDocument();
  });

  it('surfaces a load failure', () => {
    renderPage({ error: new Error('boom') });
    expect(screen.getByText(/Failed to load locations|boom/)).toBeInTheDocument();
  });
});
