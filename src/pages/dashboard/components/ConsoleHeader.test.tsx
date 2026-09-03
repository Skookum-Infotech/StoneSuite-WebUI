import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConsoleHeader } from './ConsoleHeader';
import type { DashboardRange } from '@/types/dashboardData';

type Refresh = { updatedAt: number | null; isRefreshing: boolean; onRefresh: () => void };

function setup(refresh: Partial<Refresh> = {}) {
  const props = {
    range: 'all' as DashboardRange,
    onRangeChange: vi.fn(),
    onDownloadCsv: vi.fn(),
    onCustomize: vi.fn(),
    refresh: { updatedAt: Date.now(), isRefreshing: false, onRefresh: vi.fn(), ...refresh },
  };
  render(<ConsoleHeader {...props} />);
  return props;
}

describe('ConsoleHeader', () => {
  it('still switches the time range when an option is pressed', async () => {
    const user = userEvent.setup();
    const { onRangeChange } = setup();
    await user.click(screen.getByRole('button', { name: '30d' }));
    expect(onRangeChange).toHaveBeenCalledWith('30d');
  });

  it('shows how long ago the data was last refreshed', () => {
    setup({ updatedAt: Date.now() - 3 * 60_000 });
    expect(screen.getByText(/updated 3m ago/i)).toBeInTheDocument();
  });

  it('shows an updating state during a background refresh', () => {
    setup({ isRefreshing: true });
    expect(screen.getByText(/updating/i)).toBeInTheDocument();
  });

  it('triggers a refresh when the freshness control is activated', async () => {
    const user = userEvent.setup();
    const onRefresh = vi.fn();
    setup({ onRefresh });
    await user.click(screen.getByRole('button', { name: /refresh/i }));
    expect(onRefresh).toHaveBeenCalledOnce();
  });
});
