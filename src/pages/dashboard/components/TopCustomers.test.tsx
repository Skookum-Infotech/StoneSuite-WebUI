import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TopCustomers } from './TopCustomers';
import type { TopCustomersData } from '@/types/dashboardData';

const navigateMock = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
}));

function makeData(overrides: Partial<TopCustomersData> = {}): TopCustomersData {
  return {
    range: '30d',
    customers: [
      { id: 'cust-1', name: 'Bellwood Design Group', value: 142300, priorValue: 120600 },
      { id: 'cust-2', name: 'Fontaine Builders', value: 118900, priorValue: 130000 },
      { id: 'cust-3', name: 'Sterling Kitchen & Bath', value: 96500, priorValue: 0 },
      { id: null, name: 'Meridian Countertops', value: 74200, priorValue: 74200 },
    ],
    totalValue: 638800,
    customerCount: 23,
    ...overrides,
  };
}

describe('TopCustomers', () => {
  beforeEach(() => navigateMock.mockClear());

  it('shows a loading state while the query is in flight', () => {
    render(<TopCustomers data={undefined} isLoading={true} isError={false} />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('shows an error message when the query fails', () => {
    render(<TopCustomers data={undefined} isLoading={false} isError={true} />);
    expect(screen.getByText(/couldn.?t load/i)).toBeInTheDocument();
  });

  it('shows an empty-state message when there are no customers with billed revenue', () => {
    render(<TopCustomers data={makeData({ customers: [], customerCount: 0, totalValue: 0 })} isLoading={false} isError={false} />);
    expect(screen.getByText(/no billed revenue/i)).toBeInTheDocument();
  });

  it('renders each row with rank, name, and currency value', () => {
    render(<TopCustomers data={makeData()} isLoading={false} isError={false} />);
    expect(screen.getByText('Bellwood Design Group')).toBeInTheDocument();
    expect(screen.getByText('$142,300')).toBeInTheDocument();
    expect(screen.getByText('Fontaine Builders')).toBeInTheDocument();
    expect(screen.getByText('$118,900')).toBeInTheDocument();
  });

  it('renders an up-arrow delta for growth', () => {
    render(<TopCustomers data={makeData()} isLoading={false} isError={false} />);
    expect(screen.getByText('▲ 18%')).toBeInTheDocument();
  });

  it('renders a down-arrow delta for decline', () => {
    render(<TopCustomers data={makeData()} isLoading={false} isError={false} />);
    expect(screen.getByText('▼ 9%')).toBeInTheDocument();
  });

  it('renders "new" for a customer with zero prior revenue', () => {
    render(<TopCustomers data={makeData()} isLoading={false} isError={false} />);
    expect(screen.getByText('new')).toBeInTheDocument();
  });

  it('renders no delta indicator when priorValue is null (e.g. "all time" range)', () => {
    render(
      <TopCustomers
        data={makeData({ customers: [{ id: 'cust-1', name: 'Bellwood Design Group', value: 142300, priorValue: null }] })}
        isLoading={false}
        isError={false}
      />,
    );
    expect(screen.queryByText(/▲|▼|new/)).not.toBeInTheDocument();
  });

  it('renders the concentration line summarizing shown vs total revenue', () => {
    render(<TopCustomers data={makeData()} isLoading={false} isError={false} />);
    // (142300+118900+96500+74200) / 638800 = 67.6...% -> rounds to 68%
    expect(screen.getByText(/Top 4.*68% of revenue/)).toBeInTheDocument();
  });

  it('navigates to the customer detail route when a linked row is activated', async () => {
    const user = userEvent.setup();
    render(<TopCustomers data={makeData()} isLoading={false} isError={false} />);

    await user.click(screen.getByRole('button', { name: /Bellwood Design Group/i }));

    expect(navigateMock).toHaveBeenCalledWith('/crm/customer/cust-1');
  });

  it('renders a customer with no read grant (id null) as plain text, not a link', () => {
    render(<TopCustomers data={makeData()} isLoading={false} isError={false} />);
    expect(screen.queryByRole('button', { name: /Meridian Countertops/i })).not.toBeInTheDocument();
    expect(screen.getByText('Meridian Countertops')).toBeInTheDocument();
  });

  it('shows a "more customers" hint when customerCount exceeds the shown rows', () => {
    render(<TopCustomers data={makeData()} isLoading={false} isError={false} />);
    expect(screen.getByText(/more customers/i)).toBeInTheDocument();
  });

  it('shows no hint when every customer is already shown', () => {
    render(<TopCustomers data={makeData({ customerCount: 4 })} isLoading={false} isError={false} />);
    expect(screen.queryByText(/more customers/i)).not.toBeInTheDocument();
  });
});
