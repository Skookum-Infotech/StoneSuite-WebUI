import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OrderProgressTracker } from './OrderProgressTracker';
import { buildSalesOrderProgress } from '@/lib/orderProgress';

describe('OrderProgressTracker', () => {
  it('marks the current step and lists every step', () => {
    render(
      <OrderProgressTracker
        steps={buildSalesOrderProgress('APPV')}
        statusCode="APPV"
        statusLabel="Approved"
        ariaLabel="Sales order progress"
      />,
    );
    expect(screen.getByRole('list', { name: 'Sales order progress' })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(6);
    expect(screen.getByText('Approved').closest('li')).toHaveAttribute('aria-current', 'step');
  });

  it('shows a cancelled strip instead of the steps', () => {
    render(
      <OrderProgressTracker
        steps={buildSalesOrderProgress('CANC')}
        statusCode="CANC"
        statusLabel="Cancelled"
        ariaLabel="Sales order progress"
      />,
    );
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Cancelled');
  });
});
