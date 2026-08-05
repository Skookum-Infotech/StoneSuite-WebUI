import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { InventoryAlerts } from './InventoryAlerts';
import type { InventoryAlert } from '../mockData';

function makeAlerts(count: number): InventoryAlert[] {
  return Array.from({ length: count }, (_, i) => ({
    id: String(i),
    itemName: `Item ${i}`,
    warehouse: 'Warehouse 1',
    quantityOnHand: 1,
    reorderThreshold: 10,
    severity: 'low' as const,
  }));
}

describe('InventoryAlerts', () => {
  it('renders every alert when there are 4 or fewer', () => {
    render(<InventoryAlerts alerts={makeAlerts(4)} />);
    expect(screen.getAllByText(/^Item \d$/)).toHaveLength(4);
    expect(screen.queryByText(/more alert/)).not.toBeInTheDocument();
  });

  it('caps rendered rows at 4 and shows a +N more hint when there is lots of data', () => {
    render(<InventoryAlerts alerts={makeAlerts(9)} />);
    expect(screen.getAllByText(/^Item \d$/)).toHaveLength(4);
    expect(screen.getByText('+5 more alerts')).toBeInTheDocument();
  });

  it('shows an empty-state message instead of a blank card when there are no alerts', () => {
    render(<InventoryAlerts alerts={[]} />);
    expect(screen.getByText('Nothing below threshold right now.')).toBeInTheDocument();
  });
});
