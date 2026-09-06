import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MaterialConsumption } from './MaterialConsumption';
import type { MaterialConsumptionData, MaterialConsumptionRow } from '@/types/dashboardData';

const navigateMock = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
}));

function makeRow(overrides: Partial<MaterialConsumptionRow> = {}): MaterialConsumptionRow {
  return {
    id: 'item-1', name: 'Carrara Marble 3cm', unitCode: 'SQFT', colorHex: '',
    netUsed: 412, consumedArea: 458, recoveredArea: 46, scrappedArea: 0, slabCount: 8,
    ...overrides,
  };
}

function makeData(overrides: Partial<MaterialConsumptionData> = {}): MaterialConsumptionData {
  return {
    range: 'all',
    materials: [makeRow()],
    materialCount: 1,
    slabTotal: 8,
    ...overrides,
  };
}

describe('MaterialConsumption', () => {
  beforeEach(() => navigateMock.mockClear());

  it('shows a loading state while the query is in flight', () => {
    render(<MaterialConsumption data={undefined} isLoading={true} isError={false} />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('shows an error message when the query fails', () => {
    render(<MaterialConsumption data={undefined} isLoading={false} isError={true} />);
    expect(screen.getByText(/couldn.?t load/i)).toBeInTheDocument();
  });

  it('shows an empty-state message when nothing has been consumed', () => {
    render(<MaterialConsumption data={makeData({ materials: [], materialCount: 0, slabTotal: 0 })} isLoading={false} isError={false} />);
    expect(screen.getByText(/no material has been consumed/i)).toBeInTheDocument();
  });

  it('renders the material name, net used value, and detail line', () => {
    render(<MaterialConsumption data={makeData()} isLoading={false} isError={false} />);
    expect(screen.getByText('Carrara Marble 3cm')).toBeInTheDocument();
    expect(screen.getByText('412 sqft')).toBeInTheDocument();
    expect(screen.getByText('8 slabs · 46 sqft recovered')).toBeInTheDocument();
  });

  it('shows a scrapped chip only when scrappedArea is greater than zero', () => {
    const { rerender } = render(
      <MaterialConsumption data={makeData({ materials: [makeRow({ scrappedArea: 12 })] })} isLoading={false} isError={false} />,
    );
    expect(screen.getByText('12 sqft scrapped')).toBeInTheDocument();

    rerender(<MaterialConsumption data={makeData({ materials: [makeRow({ scrappedArea: 0 })] })} isLoading={false} isError={false} />);
    expect(screen.queryByText(/scrapped/i)).not.toBeInTheDocument();
  });

  it('shows the material and slab counts in the subtitle', () => {
    render(<MaterialConsumption data={makeData({ materialCount: 3, slabTotal: 21 })} isLoading={false} isError={false} />);
    expect(screen.getByText('3 materials · 21 slabs')).toBeInTheDocument();
  });

  it('navigates to the item detail route when a row is activated', async () => {
    const user = userEvent.setup();
    render(<MaterialConsumption data={makeData({ materials: [makeRow({ id: 'item-42' })] })} isLoading={false} isError={false} />);

    await user.click(screen.getByRole('button', { name: /Carrara Marble 3cm/i }));

    expect(navigateMock).toHaveBeenCalledWith('/inventory/item/item-42');
  });

  it('shows a "more materials" hint when materialCount exceeds the shown rows', () => {
    render(<MaterialConsumption data={makeData({ materialCount: 6 })} isLoading={false} isError={false} />);
    expect(screen.getByText(/more materials/i)).toBeInTheDocument();
  });

  it('shows no hint when every material is already shown', () => {
    render(<MaterialConsumption data={makeData({ materialCount: 1 })} isLoading={false} isError={false} />);
    expect(screen.queryByText(/more materials/i)).not.toBeInTheDocument();
  });
});
