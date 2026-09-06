import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InventoryAlerts } from './InventoryAlerts';
import type { InventoryAlertsData, InventoryStockAlert } from '@/types/dashboardData';

const navigateMock = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
}));

function makeAlert(overrides: Partial<InventoryStockAlert> = {}): InventoryStockAlert {
  return {
    id: 'item-1', itemName: 'Black Galaxy Slab', warehouse: 'Warehouse 1',
    onHand: 4, allocated: 10, reorderPoint: 0, severity: 'short',
    ...overrides,
  };
}

function makeData(overrides: Partial<InventoryAlertsData> = {}): InventoryAlertsData {
  return {
    range: 'all',
    alerts: [makeAlert()],
    alertCount: 1,
    ...overrides,
  };
}

describe('InventoryAlerts', () => {
  beforeEach(() => navigateMock.mockClear());

  it('shows a loading state while the query is in flight', () => {
    render(<InventoryAlerts data={undefined} isLoading={true} isError={false} />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('shows an error message when the query fails', () => {
    render(<InventoryAlerts data={undefined} isLoading={false} isError={true} />);
    expect(screen.getByText(/couldn.?t load/i)).toBeInTheDocument();
  });

  it('shows an empty-state message when there are no alerts', () => {
    render(<InventoryAlerts data={makeData({ alerts: [], alertCount: 0 })} isLoading={false} isError={false} />);
    expect(screen.getByText(/nothing needs attention/i)).toBeInTheDocument();
  });

  it('renders the item name, on-hand value, and detail line', () => {
    render(
      <InventoryAlerts
        data={makeData({ alerts: [makeAlert({ severity: 'short', onHand: 4, warehouse: 'Warehouse 1', allocated: 10 })] })}
        isLoading={false}
        isError={false}
      />,
    );
    expect(screen.getByText('Black Galaxy Slab')).toBeInTheDocument();
    expect(screen.getByText('4 on hand')).toBeInTheDocument();
    expect(screen.getByText('Warehouse 1 · 10 committed')).toBeInTheDocument();
  });

  it('renders the severity badge label', () => {
    render(<InventoryAlerts data={makeData({ alerts: [makeAlert({ severity: 'out' })] })} isLoading={false} isError={false} />);
    expect(screen.getByText('Out')).toBeInTheDocument();
  });

  it('colors the on-hand value critical (red) for a short alert', () => {
    render(<InventoryAlerts data={makeData({ alerts: [makeAlert({ severity: 'short', onHand: 4 })] })} isLoading={false} isError={false} />);
    expect(screen.getByText('4 on hand')).toHaveClass('text-red-600');
  });

  it('colors the on-hand value critical (red) for an out alert', () => {
    render(<InventoryAlerts data={makeData({ alerts: [makeAlert({ severity: 'out', onHand: 0 })] })} isLoading={false} isError={false} />);
    expect(screen.getByText('0 on hand')).toHaveClass('text-red-600');
  });

  it('colors the on-hand value warning (amber) for a low alert', () => {
    render(<InventoryAlerts data={makeData({ alerts: [makeAlert({ severity: 'low', onHand: 6, reorderPoint: 12 })] })} isLoading={false} isError={false} />);
    expect(screen.getByText('6 on hand')).toHaveClass('text-warning');
  });

  it('navigates to the item detail route when a row is activated', async () => {
    const user = userEvent.setup();
    render(<InventoryAlerts data={makeData({ alerts: [makeAlert({ id: 'item-42' })] })} isLoading={false} isError={false} />);

    await user.click(screen.getByRole('button', { name: /Black Galaxy Slab/i }));

    expect(navigateMock).toHaveBeenCalledWith('/inventory/item/item-42');
  });

  it('shows a "more alerts" hint when alertCount exceeds the shown rows', () => {
    render(<InventoryAlerts data={makeData({ alertCount: 6 })} isLoading={false} isError={false} />);
    expect(screen.getByText(/more alerts/i)).toBeInTheDocument();
  });

  it('shows no hint when every alert is already shown', () => {
    render(<InventoryAlerts data={makeData({ alertCount: 1 })} isLoading={false} isError={false} />);
    expect(screen.queryByText(/more alerts/i)).not.toBeInTheDocument();
  });
});
