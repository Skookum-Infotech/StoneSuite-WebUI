import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { KpiStrip } from './KpiStrip';
import type { KpiMetric } from '@/types/dashboardData';

const navigateMock = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
}));

describe('KpiStrip', () => {
  beforeEach(() => navigateMock.mockClear());

  it('shows a loading state while the query is in flight', () => {
    render(<KpiStrip metrics={undefined} isLoading={true} isError={false} />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('announces the loading state to assistive technology', () => {
    render(<KpiStrip metrics={undefined} isLoading={true} isError={false} />);
    expect(screen.getByRole('status')).toHaveAccessibleName(/loading/i);
  });

  it('shows an error message when the query fails', () => {
    render(<KpiStrip metrics={undefined} isLoading={false} isError={true} />);
    expect(screen.getByText(/couldn.?t load/i)).toBeInTheDocument();
  });

  it('shows an empty-state message when no metrics are granted', () => {
    render(<KpiStrip metrics={[]} isLoading={false} isError={false} />);
    expect(screen.getByText(/no kpi data/i)).toBeInTheDocument();
  });

  it('formats revenue as currency with a percent delta', () => {
    const metrics: KpiMetric[] = [
      { id: 'revenue', value: 184250, deltaPct: 18, sparkline: [58, 64, 60, 74, 70, 86, 92] },
    ];
    render(<KpiStrip metrics={metrics} isLoading={false} isError={false} />);
    expect(screen.getByText('Revenue')).toBeInTheDocument();
    expect(screen.getByText('$184,250')).toBeInTheDocument();
    expect(screen.getByText('18%')).toBeInTheDocument();
  });

  it('shows a downward trend for a negative percent delta', () => {
    const metrics: KpiMetric[] = [{ id: 'revenue', value: 82000, deltaPct: -12 }];
    const { container } = render(<KpiStrip metrics={metrics} isLoading={false} isError={false} />);
    expect(screen.getByText('12%')).toBeInTheDocument();
    // the trend chip carries a direction arrow rather than a ▲/▼ glyph in the text
    expect(container.querySelector('.text-warning svg')).not.toBeNull();
  });

  it('formats open leads as a plain count with a "this week" delta', () => {
    const metrics: KpiMetric[] = [{ id: 'open-leads', value: 24, deltaCount: 6 }];
    render(<KpiStrip metrics={metrics} isLoading={false} isError={false} />);
    expect(screen.getByText('Open Leads')).toBeInTheDocument();
    expect(screen.getByText('24')).toBeInTheDocument();
    expect(screen.getByText('6 this week')).toBeInTheDocument();
  });

  it('renders sales orders using its subLabel instead of a numeric delta', () => {
    const metrics: KpiMetric[] = [{ id: 'sales-orders-fabrication', value: 12, subLabel: '4 in fabrication' }];
    render(<KpiStrip metrics={metrics} isLoading={false} isError={false} />);
    expect(screen.getByText('Sales Orders')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('4 in fabrication')).toBeInTheDocument();
  });

  it('renders needs approval using its subLabel, in warning tone when something is pending', () => {
    const metrics: KpiMetric[] = [{ id: 'needs-approval', value: 5, subLabel: 'oldest 2 days' }];
    render(<KpiStrip metrics={metrics} isLoading={false} isError={false} />);
    expect(screen.getByText('Needs Approval')).toBeInTheDocument();
    expect(screen.getByText('oldest 2 days')).toBeInTheDocument();
    expect(screen.getByText('oldest 2 days')).toHaveClass('text-warning');
  });

  // A caller who is a configured approver but has 0 pending right now (see
  // controllers/dashboard_kpi.go's buildNeedsApproval) must read as
  // "caught up", not in the same warning color as an actual backlog.
  it('renders needs approval at zero in neutral tone, not warning', () => {
    const metrics: KpiMetric[] = [{ id: 'needs-approval', value: 0, subLabel: 'all caught up' }];
    render(<KpiStrip metrics={metrics} isLoading={false} isError={false} />);
    expect(screen.getByText('all caught up')).toBeInTheDocument();
    expect(screen.getByText('all caught up')).not.toHaveClass('text-warning');
    expect(screen.getByText('all caught up')).toHaveClass('text-stone-500');
  });

  it('renders fewer than 4 metrics gracefully when some are ungranted', () => {
    const metrics: KpiMetric[] = [{ id: 'open-leads', value: 24, deltaCount: 6 }];
    render(<KpiStrip metrics={metrics} isLoading={false} isError={false} />);
    expect(screen.getByText('Open Leads')).toBeInTheDocument();
    expect(screen.queryByText('Revenue')).not.toBeInTheDocument();
  });

  it('sizes the wide-screen row to the number of granted metrics, not a fixed 4-up grid', () => {
    const two: KpiMetric[] = [
      { id: 'revenue', value: 1, deltaPct: 1 },
      { id: 'open-leads', value: 2, deltaCount: 1 },
    ];
    const { container, rerender } = render(<KpiStrip metrics={two} isLoading={false} isError={false} />);
    expect((container.firstChild as HTMLElement).className).toContain('xl:grid-cols-2');
    expect((container.firstChild as HTMLElement).className).not.toContain('xl:grid-cols-4');

    const four: KpiMetric[] = [
      { id: 'revenue', value: 1, deltaPct: 1 },
      { id: 'open-leads', value: 2, deltaCount: 1 },
      { id: 'sales-orders-fabrication', value: 3, subLabel: 'x' },
      { id: 'needs-approval', value: 0, subLabel: 'y' },
    ];
    rerender(<KpiStrip metrics={four} isLoading={false} isError={false} />);
    expect((container.firstChild as HTMLElement).className).toContain('xl:grid-cols-4');
  });

  it('stacks to one column on phones and pairs up from the small breakpoint', () => {
    const metrics: KpiMetric[] = [
      { id: 'revenue', value: 1, deltaPct: 1 },
      { id: 'open-leads', value: 2, deltaCount: 1 },
    ];
    const { container } = render(<KpiStrip metrics={metrics} isLoading={false} isError={false} />);
    const strip = (container.firstChild as HTMLElement).className;
    expect(strip).toContain('grid-cols-1');
    expect(strip).toContain('sm:grid-cols-2');
  });

  it('lets an odd trailing tile fill the small-screen row instead of leaving a gap', () => {
    const metrics: KpiMetric[] = [
      { id: 'revenue', value: 1, deltaPct: 1 },
      { id: 'open-leads', value: 2, deltaCount: 1 },
      { id: 'sales-orders-fabrication', value: 3, subLabel: 'x' },
    ];
    const { container } = render(<KpiStrip metrics={metrics} isLoading={false} isError={false} />);
    const tiles = (container.firstChild as HTMLElement).children;
    expect(tiles).toHaveLength(3);
    expect(tiles[2].className).toContain('sm:col-span-2');
  });

  it('links a metric with a destination to its list page when activated', async () => {
    const user = userEvent.setup();
    const metrics: KpiMetric[] = [{ id: 'revenue', value: 184250, deltaPct: 18 }];
    render(<KpiStrip metrics={metrics} isLoading={false} isError={false} />);

    await user.click(screen.getByRole('button', { name: /revenue/i }));

    expect(navigateMock).toHaveBeenCalledWith('/sales/invoice');
  });

  it('does not make Needs Approval a link — it has no dedicated destination', () => {
    const metrics: KpiMetric[] = [{ id: 'needs-approval', value: 5, subLabel: 'oldest 2 days' }];
    render(<KpiStrip metrics={metrics} isLoading={false} isError={false} />);
    expect(screen.queryByRole('button', { name: /needs approval/i })).not.toBeInTheDocument();
  });
});
