import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const navigate = vi.fn();
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }));
vi.mock('@/services/inventoryUnitService', () => ({
  inventoryUnitService: { searchUnits: vi.fn() },
}));

import { UnitOffcutsList } from './UnitOffcutsList';
import { inventoryUnitService } from '@/services/inventoryUnitService';
import { makeUnit } from './unitFixtures';

function renderList() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <UnitOffcutsList parentId="parent-1" />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('UnitOffcutsList', () => {
  it('lists the pieces cut from the unit, by serial, with their size, area and status', async () => {
    vi.mocked(inventoryUnitService.searchUnits).mockResolvedValue({
      records: [
        makeUnit({ id: 'r1', serial: 'PO-00012-001-R1', kind: 'remnant', lengthMm: 1200, widthMm: 700, area: 9.04 }),
        makeUnit({ id: 'r2', serial: 'PO-00012-001-R2', kind: 'remnant', lengthMm: 400, widthMm: 120, area: 0.52, status: 'scrapped' }),
      ],
      nextCursor: '', hasMore: false,
    });
    renderList();

    expect(await screen.findByRole('button', { name: 'Open offcut PO-00012-001-R1' })).toBeInTheDocument();
    expect(screen.getByText('1200 × 700')).toBeInTheDocument();
    expect(screen.getByText('9.04 sq ft')).toBeInTheDocument();
    expect(screen.getByText('scrapped')).toBeInTheDocument();
  });

  it('asks for exactly the units whose parent is this one', async () => {
    vi.mocked(inventoryUnitService.searchUnits).mockResolvedValue({ records: [], nextCursor: '', hasMore: false });
    renderList();
    await vi.waitFor(() => expect(inventoryUnitService.searchUnits).toHaveBeenCalled());

    expect(vi.mocked(inventoryUnitService.searchUnits).mock.calls[0][0].filters).toEqual([
      { field: 'parent_id', op: 'eq', value: 'parent-1' },
    ]);
  });

  it('opens an offcut on click', async () => {
    vi.mocked(inventoryUnitService.searchUnits).mockResolvedValue({
      records: [makeUnit({ id: 'r1', serial: 'PO-00012-001-R1', kind: 'remnant' })],
      nextCursor: '', hasMore: false,
    });
    renderList();

    await userEvent.setup().click(await screen.findByRole('button', { name: 'Open offcut PO-00012-001-R1' }));

    expect(navigate).toHaveBeenCalledWith('/inventory/unit/r1');
  });

  it('renders nothing when there are none', async () => {
    vi.mocked(inventoryUnitService.searchUnits).mockResolvedValue({ records: [], nextCursor: '', hasMore: false });
    renderList();
    await vi.waitFor(() => expect(inventoryUnitService.searchUnits).toHaveBeenCalled());

    await vi.waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('says so when the offcuts cannot be loaded', async () => {
    vi.mocked(inventoryUnitService.searchUnits).mockRejectedValue(new Error('boom'));
    renderList();

    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });
});
