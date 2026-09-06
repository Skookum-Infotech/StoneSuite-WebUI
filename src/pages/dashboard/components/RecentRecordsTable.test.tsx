import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RecentRecordsTable } from './RecentRecordsTable';
import type { RecentRecord } from '@/types/dashboardData';

const navigateMock = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
}));

function makeRecord(overrides: Partial<RecentRecord> = {}): RecentRecord {
  return {
    id: 'so-1', module: 'sales_order', domain: 'sales', recordNumber: 'SO-1042',
    account: 'Fontaine Builders', value: 28400, status: 'Fabrication', updatedAt: '2026-09-02T14:00:00Z',
    ...overrides,
  };
}

describe('RecentRecordsTable', () => {
  beforeEach(() => navigateMock.mockClear());

  it('shows a loading state while the query is in flight', () => {
    render(<RecentRecordsTable records={undefined} isLoading={true} isError={false} />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('shows an error message when the query fails', () => {
    render(<RecentRecordsTable records={undefined} isLoading={false} isError={true} />);
    expect(screen.getByText(/couldn.?t load/i)).toBeInTheDocument();
  });

  it('shows an empty-state message when there are no recent records', () => {
    render(<RecentRecordsTable records={[]} isLoading={false} isError={false} />);
    expect(screen.getByText(/no recent/i)).toBeInTheDocument();
  });

  it('renders a row with type label, record number, account, currency value, status, and relative time', () => {
    render(<RecentRecordsTable records={[makeRecord()]} isLoading={false} isError={false} />);
    expect(screen.getByText('Sales Order')).toBeInTheDocument();
    expect(screen.getByText('SO-1042')).toBeInTheDocument();
    expect(screen.getByText('Fontaine Builders')).toBeInTheDocument();
    expect(screen.getByText('$28,400.00')).toBeInTheDocument();
    expect(screen.getByText('Fabrication')).toBeInTheDocument();
  });

  it('renders a CRM lead (no monetary value) with a dash instead of $0', () => {
    render(
      <RecentRecordsTable
        records={[makeRecord({ id: 'lead-1', module: 'lead', domain: 'crm', recordNumber: 'LEAD-1084', account: 'Whitmore Residence', value: null, status: 'New' })]}
        isLoading={false}
        isError={false}
      />,
    );
    expect(screen.getByText('Lead')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('renders a dash for a record with no account (e.g. Expense)', () => {
    render(
      <RecentRecordsTable
        records={[makeRecord({ id: 'exp-1', module: 'expense', domain: 'purchases', recordNumber: 'EXP-1', account: null, value: 120, status: 'Pending' })]}
        isLoading={false}
        isError={false}
      />,
    );
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThan(0);
  });

  it('navigates to the record detail route when a row is activated', async () => {
    const user = userEvent.setup();
    render(<RecentRecordsTable records={[makeRecord()]} isLoading={false} isError={false} />);

    await user.click(screen.getByRole('button', { name: /SO-1042/i }));

    expect(navigateMock).toHaveBeenCalledWith('/sales/sales_order/so-1');
  });

  it('shows a "more records" hint when the backend reports hasMore', () => {
    render(<RecentRecordsTable records={[makeRecord()]} isLoading={false} isError={false} hasMore={true} />);
    expect(screen.getByText(/more records/i)).toBeInTheDocument();
  });

  it('shows no hint when hasMore is false', () => {
    render(<RecentRecordsTable records={[makeRecord()]} isLoading={false} isError={false} hasMore={false} />);
    expect(screen.queryByText(/more records/i)).not.toBeInTheDocument();
  });
});
