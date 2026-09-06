import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PurchasesStatus } from './PurchasesStatus';
import type { PurchasesAttentionRow, PurchasesStatusData } from '@/types/dashboardData';

const navigateMock = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
}));

function makeRow(overrides: Partial<PurchasesAttentionRow> = {}): PurchasesAttentionRow {
  return {
    kind: 'purchase_order', id: 'po-1', recordNumber: 'PORD-000087', party: 'Apex Stone Supply',
    value: 6200, daysOverdue: 3, daysWaiting: null,
    ...overrides,
  };
}

function makeData(overrides: Partial<PurchasesStatusData> = {}): PurchasesStatusData {
  return {
    range: 'all',
    incoming: { count: 3, value: 4120 },
    overdue: { count: 1, value: 6200 },
    pending: { count: 2, value: 2250 },
    attention: [makeRow()],
    attentionCount: 1,
    ...overrides,
  };
}

describe('PurchasesStatus', () => {
  beforeEach(() => navigateMock.mockClear());

  it('shows a loading state while the query is in flight', () => {
    render(<PurchasesStatus data={undefined} isLoading={true} isError={false} />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('shows an error message when the query fails', () => {
    render(<PurchasesStatus data={undefined} isLoading={false} isError={true} />);
    expect(screen.getByText(/couldn.?t load/i)).toBeInTheDocument();
  });

  it('renders the incoming, overdue, and pending tile counts', () => {
    render(<PurchasesStatus data={makeData()} isLoading={false} isError={false} />);
    expect(screen.getByText('3')).toBeInTheDocument(); // incoming count
    expect(screen.getByText('1')).toBeInTheDocument(); // overdue count
    expect(screen.getByText('2')).toBeInTheDocument(); // pending count
  });

  it('renders a dash for the pending tile when pending is null', () => {
    render(<PurchasesStatus data={makeData({ pending: null })} isLoading={false} isError={false} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('colors the overdue tile count as a warning when there is at least one overdue order', () => {
    render(<PurchasesStatus data={makeData({ overdue: { count: 1, value: 6200 } })} isLoading={false} isError={false} />);
    const el = screen.getAllByText('1').find((n) => n.className.includes('text-lg'));
    expect(el).toHaveClass('text-warning');
  });

  it('does not color the overdue tile when there is nothing overdue', () => {
    render(<PurchasesStatus data={makeData({ overdue: { count: 0, value: 0 } })} isLoading={false} isError={false} />);
    const el = screen.getAllByText('0').find((n) => n.className.includes('text-lg'));
    expect(el).not.toHaveClass('text-warning');
  });

  it('shows an empty-attention message when there is nothing to show, while still rendering the tiles', () => {
    render(<PurchasesStatus data={makeData({ attention: [], attentionCount: 0 })} isLoading={false} isError={false} />);
    expect(screen.getByText(/nothing needs attention/i)).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument(); // incoming tile still shown
  });

  it('renders an overdue row with its party, record number, and detail text', () => {
    render(
      <PurchasesStatus
        data={makeData({ attention: [makeRow({ party: 'Apex Stone Supply', recordNumber: 'PORD-000087', daysOverdue: 3 })] })}
        isLoading={false}
        isError={false}
      />,
    );
    expect(screen.getByText('Apex Stone Supply')).toBeInTheDocument();
    expect(screen.getByText(/PORD-000087/)).toBeInTheDocument();
    expect(screen.getByText(/3 days overdue/)).toBeInTheDocument();
    expect(screen.getByText('PO')).toBeInTheDocument();
  });

  it('renders a pending requisition row with the REQ chip and waiting detail', () => {
    render(
      <PurchasesStatus
        data={makeData({
          attention: [makeRow({ kind: 'requisition', id: 'reqn-1', recordNumber: 'REQN-121', party: 'Fabrication', value: 1250, daysOverdue: null, daysWaiting: 6 })],
        })}
        isLoading={false}
        isError={false}
      />,
    );
    expect(screen.getByText('REQ')).toBeInTheDocument();
    expect(screen.getByText(/waiting 6 days/)).toBeInTheDocument();
  });

  it('navigates to the purchase order detail route when an overdue row is activated', async () => {
    const user = userEvent.setup();
    render(<PurchasesStatus data={makeData({ attention: [makeRow({ kind: 'purchase_order', id: 'po-42' })] })} isLoading={false} isError={false} />);

    await user.click(screen.getByRole('button', { name: /Apex Stone Supply/i }));

    expect(navigateMock).toHaveBeenCalledWith('/purchases/purchase_order/po-42');
  });

  it('navigates to the requisition detail route when a requisition row is activated', async () => {
    const user = userEvent.setup();
    render(
      <PurchasesStatus
        data={makeData({ attention: [makeRow({ kind: 'requisition', id: 'reqn-42', recordNumber: 'REQN-000042', party: 'Fabrication' })] })}
        isLoading={false}
        isError={false}
      />,
    );

    await user.click(screen.getByRole('button', { name: /Fabrication/i }));

    expect(navigateMock).toHaveBeenCalledWith('/purchases/requisition/reqn-42');
  });

  it('shows a "needing attention" hint when attentionCount exceeds the shown rows', () => {
    render(<PurchasesStatus data={makeData({ attentionCount: 5 })} isLoading={false} isError={false} />);
    expect(screen.getByText(/more needing attention/i)).toBeInTheDocument();
  });

  it('shows no hint when every attention row is already shown', () => {
    render(<PurchasesStatus data={makeData({ attentionCount: 1 })} isLoading={false} isError={false} />);
    expect(screen.queryByText(/more needing attention/i)).not.toBeInTheDocument();
  });
});
