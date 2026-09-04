import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ArOutstanding } from './ArOutstanding';
import type { ArOutstandingData, OutstandingInvoiceRow } from '@/types/dashboardData';

const navigateMock = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
}));

function makeRow(overrides: Partial<OutstandingInvoiceRow> = {}): OutstandingInvoiceRow {
  return {
    id: 'inv-1', invoiceNumber: 'INV-3155', customer: 'Meridian Countertops',
    balanceDue: 7600, daysPastDue: 98,
    ...overrides,
  };
}

function makeData(overrides: Partial<ArOutstandingData> = {}): ArOutstandingData {
  return {
    range: 'all',
    outstanding: 37200,
    overdueTotal: 28800,
    overdueCount: 4,
    buckets: [
      { label: '0-30', amount: 13600, count: 3 },
      { label: '31-60', amount: 12900, count: 2 },
      { label: '61-90', amount: 3100, count: 1 },
      { label: '90+', amount: 7600, count: 2 },
    ],
    oldest: [makeRow()],
    oldestCount: 1,
    ...overrides,
  };
}

describe('ArOutstanding', () => {
  beforeEach(() => navigateMock.mockClear());

  it('shows a loading state while the query is in flight', () => {
    render(<ArOutstanding data={undefined} isLoading={true} isError={false} />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('shows an error message when the query fails', () => {
    render(<ArOutstanding data={undefined} isLoading={false} isError={true} />);
    expect(screen.getByText(/couldn.?t load/i)).toBeInTheDocument();
  });

  it('renders the outstanding, overdue, and count tiles', () => {
    render(<ArOutstanding data={makeData()} isLoading={false} isError={false} />);
    expect(screen.getByText('$37,200')).toBeInTheDocument();
    expect(screen.getByText('$28,800')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  it('renders all four aging buckets even when the tenant has nothing outstanding', () => {
    render(
      <ArOutstanding
        data={makeData({
          outstanding: 0, overdueTotal: 0, overdueCount: 0,
          buckets: [
            { label: '0-30', amount: 0, count: 0 },
            { label: '31-60', amount: 0, count: 0 },
            { label: '61-90', amount: 0, count: 0 },
            { label: '90+', amount: 0, count: 0 },
          ],
          oldest: [], oldestCount: 0,
        })}
        isLoading={false}
        isError={false}
      />,
    );
    expect(screen.getByText('0-30d')).toBeInTheDocument();
    expect(screen.getByText('90+d')).toBeInTheDocument();
    expect(screen.getByText(/nothing outstanding/i)).toBeInTheDocument();
  });

  it('renders an oldest-outstanding row with customer, invoice number, and balance', () => {
    render(<ArOutstanding data={makeData({ oldest: [makeRow({ balanceDue: 5200 })] })} isLoading={false} isError={false} />);
    expect(screen.getByText('Meridian Countertops')).toBeInTheDocument();
    expect(screen.getByText(/INV-3155/)).toBeInTheDocument();
    expect(screen.getByText('$5,200')).toBeInTheDocument();
    expect(screen.getByText(/98d past due/)).toBeInTheDocument();
  });

  it('omits the past-due detail for a row with no due date (daysPastDue 0)', () => {
    render(
      <ArOutstanding
        data={makeData({ oldest: [makeRow({ id: 'inv-2', invoiceNumber: 'INV-3301', customer: 'Fontaine Builders', daysPastDue: 0 })] })}
        isLoading={false}
        isError={false}
      />,
    );
    expect(screen.queryByText(/past due/)).not.toBeInTheDocument();
  });

  it('navigates to the invoice detail route when a worklist row is activated', async () => {
    const user = userEvent.setup();
    render(<ArOutstanding data={makeData({ oldest: [makeRow({ id: 'inv-42' })] })} isLoading={false} isError={false} />);

    await user.click(screen.getByRole('button', { name: /Meridian Countertops/i }));

    expect(navigateMock).toHaveBeenCalledWith('/sales/invoice/inv-42');
  });

  it('shows an "outstanding" hint when oldestCount exceeds the shown rows', () => {
    render(<ArOutstanding data={makeData({ oldestCount: 5 })} isLoading={false} isError={false} />);
    expect(screen.getByText(/more outstanding/i)).toBeInTheDocument();
  });

  it('shows no hint when every outstanding invoice is already shown', () => {
    render(<ArOutstanding data={makeData({ oldestCount: 1 })} isLoading={false} isError={false} />);
    expect(screen.queryByText(/more outstanding/i)).not.toBeInTheDocument();
  });
});
