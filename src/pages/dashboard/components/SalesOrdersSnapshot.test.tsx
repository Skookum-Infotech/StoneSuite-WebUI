import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SalesOrdersSnapshot } from './SalesOrdersSnapshot';
import type { SalesOrdersSnapshotData } from '@/types/dashboardData';

const navigateMock = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
}));

function makeData(overrides: Partial<SalesOrdersSnapshotData> = {}): SalesOrdersSnapshotData {
  return {
    range: 'all',
    openCount: 20,
    openValue: 412300,
    lateCount: 3,
    lateValue: 47250,
    statuses: [
      { code: 'DRFT', label: 'Draft', count: 3, value: 18400 },
      { code: 'PAPV', label: 'Pending approval', count: 2, value: 9200 },
      { code: 'APPV', label: 'Approved', count: 5, value: 61000 },
      { code: 'OPEN', label: 'Open', count: 11, value: 240300 },
      { code: 'PART', label: 'Partial', count: 4, value: 111000 },
    ],
    atRisk: [
      { id: 'so-1', recordNumber: 'SO-1042', customer: 'Fontaine Builders', value: 28400, status: 'Open', daysLate: 12 },
      { id: 'so-2', recordNumber: 'SO-1027', customer: 'Whitmore Residence', value: 21750, status: 'Approved', daysLate: -3 },
    ],
    ...overrides,
  };
}

describe('SalesOrdersSnapshot', () => {
  beforeEach(() => navigateMock.mockClear());

  it('shows a loading state while the query is in flight', () => {
    render(<SalesOrdersSnapshot data={undefined} isLoading={true} isError={false} />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('shows an error message when the query fails', () => {
    render(<SalesOrdersSnapshot data={undefined} isLoading={false} isError={true} />);
    expect(screen.getByText(/couldn.?t load/i)).toBeInTheDocument();
  });

  it('renders the open count, backlog value, and late count tiles', () => {
    render(<SalesOrdersSnapshot data={makeData()} isLoading={false} isError={false} />);
    expect(screen.getByText('20')).toBeInTheDocument();
    expect(screen.getByText('$412,300')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('renders the status breakdown line with every non-terminal status, including draft/pending', () => {
    render(<SalesOrdersSnapshot data={makeData()} isLoading={false} isError={false} />);
    expect(screen.getByText(/Draft 3/)).toBeInTheDocument();
    expect(screen.getByText(/Pending approval 2/)).toBeInTheDocument();
    expect(screen.getByText(/Approved 5/)).toBeInTheDocument();
    expect(screen.getByText(/Open 11/)).toBeInTheDocument();
    expect(screen.getByText(/Partial 4/)).toBeInTheDocument();
  });

  it('renders an at-risk row with customer, record number, value, status, and due label', () => {
    render(<SalesOrdersSnapshot data={makeData()} isLoading={false} isError={false} />);
    expect(screen.getByText('Fontaine Builders')).toBeInTheDocument();
    expect(screen.getByText('SO-1042')).toBeInTheDocument();
    // Scoped to the row's own value/status/due cell -- "Open" alone is
    // ambiguous against the Open-count tile label elsewhere on the card.
    const cell = screen.getByText('$28,400').parentElement as HTMLElement;
    expect(within(cell).getByText('Open')).toBeInTheDocument();
    expect(within(cell).getByText('12d late')).toBeInTheDocument();
  });

  it('renders a future due date as "due in Xd"', () => {
    render(<SalesOrdersSnapshot data={makeData()} isLoading={false} isError={false} />);
    expect(screen.getByText('due in 3d')).toBeInTheDocument();
  });

  it('renders "no due date" for an at-risk row with daysLate null', () => {
    render(
      <SalesOrdersSnapshot
        data={makeData({
          atRisk: [{ id: 'so-3', recordNumber: 'SO-1019', customer: 'Bellwood Design Group', value: 33500, status: 'Open', daysLate: null }],
        })}
        isLoading={false}
        isError={false}
      />,
    );
    expect(screen.getByText('no due date')).toBeInTheDocument();
  });

  it('shows an empty-state message when there are no open orders', () => {
    render(<SalesOrdersSnapshot data={makeData({ openCount: 0, atRisk: [], statuses: [] })} isLoading={false} isError={false} />);
    expect(screen.getByText(/no open sales orders/i)).toBeInTheDocument();
  });

  it('navigates to the order detail route when an at-risk row is activated', async () => {
    const user = userEvent.setup();
    render(<SalesOrdersSnapshot data={makeData()} isLoading={false} isError={false} />);

    await user.click(screen.getByRole('button', { name: /SO-1042/i }));

    expect(navigateMock).toHaveBeenCalledWith('/sales/sales_order/so-1');
  });

  it('shows a "more open orders" hint when atRisk is shorter than openCount', () => {
    render(<SalesOrdersSnapshot data={makeData()} isLoading={false} isError={false} />);
    expect(screen.getByText(/more open orders/i)).toBeInTheDocument();
  });

  it('shows no hint when every open order is already shown', () => {
    render(<SalesOrdersSnapshot data={makeData({ openCount: 2 })} isLoading={false} isError={false} />);
    expect(screen.queryByText(/more open orders/i)).not.toBeInTheDocument();
  });
});
