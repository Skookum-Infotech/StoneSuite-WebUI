import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AccountingSnapshot } from './AccountingSnapshot';
import type { AccountingSnapshotData, JournalEntryRow } from '@/types/dashboardData';

const navigateMock = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
}));

function makeEntry(overrides: Partial<JournalEntryRow> = {}): JournalEntryRow {
  return {
    id: 'je-1', entryNumber: 'JE-000231', description: 'Fabrication labor accrual',
    amount: 4200, date: new Date().toISOString(),
    ...overrides,
  };
}

function makeData(overrides: Partial<AccountingSnapshotData> = {}): AccountingSnapshotData {
  return {
    range: 'all',
    period: { name: 'Aug 2026', status: 'open', entryCount: 47 },
    entries: [makeEntry()],
    entryTotal: 47,
    ...overrides,
  };
}

describe('AccountingSnapshot', () => {
  beforeEach(() => navigateMock.mockClear());

  it('shows a loading state while the query is in flight', () => {
    render(<AccountingSnapshot data={undefined} isLoading={true} isError={false} />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('shows an error message when the query fails', () => {
    render(<AccountingSnapshot data={undefined} isLoading={false} isError={true} />);
    expect(screen.getByText(/couldn.?t load/i)).toBeInTheDocument();
  });

  it('renders the period name, open status, and entry count subtitle', () => {
    render(<AccountingSnapshot data={makeData()} isLoading={false} isError={false} />);
    expect(screen.getByText('Aug 2026')).toBeInTheDocument();
    expect(screen.getByText('Open')).toBeInTheDocument();
    expect(screen.getByText(/47 entries this period/)).toBeInTheDocument();
  });

  it('renders a closed period badge distinctly from open', () => {
    render(<AccountingSnapshot data={makeData({ period: { name: 'Jul 2026', status: 'closed', entryCount: 30 } })} isLoading={false} isError={false} />);
    expect(screen.getByText('Closed')).toBeInTheDocument();
  });

  it('shows a setup prompt instead of a period pill when no calendar is configured', () => {
    render(<AccountingSnapshot data={makeData({ period: null, entries: [], entryTotal: 0 })} isLoading={false} isError={false} />);
    expect(screen.getByText(/no accounting calendar configured/i)).toBeInTheDocument();
    expect(screen.queryByText('Aug 2026')).not.toBeInTheDocument();
  });

  it('renders a journal entry row with description, entry number, and amount', () => {
    render(<AccountingSnapshot data={makeData()} isLoading={false} isError={false} />);
    expect(screen.getByText('Fabrication labor accrual')).toBeInTheDocument();
    expect(screen.getByText('JE-000231')).toBeInTheDocument();
    expect(screen.getByText('$4,200')).toBeInTheDocument();
  });

  it('shows an empty message when no entries have posted yet', () => {
    render(<AccountingSnapshot data={makeData({ entries: [], entryTotal: 0 })} isLoading={false} isError={false} />);
    expect(screen.getByText(/no journal entries posted yet/i)).toBeInTheDocument();
  });

  it('navigates to the journal entry detail route when a row is activated', async () => {
    const user = userEvent.setup();
    render(<AccountingSnapshot data={makeData({ entries: [makeEntry({ id: 'je-42' })] })} isLoading={false} isError={false} />);

    await user.click(screen.getByRole('button', { name: /Fabrication labor accrual/i }));

    expect(navigateMock).toHaveBeenCalledWith('/finance/journal-entries/je-42');
  });

  it('navigates to accounting periods when the period pill is activated', async () => {
    const user = userEvent.setup();
    render(<AccountingSnapshot data={makeData()} isLoading={false} isError={false} />);

    await user.click(screen.getByRole('button', { name: /Aug 2026/i }));

    expect(navigateMock).toHaveBeenCalledWith('/finance/accounting-periods');
  });

  it('shows a "more entries" hint when entryTotal exceeds the shown rows', () => {
    render(<AccountingSnapshot data={makeData({ entryTotal: 50 })} isLoading={false} isError={false} />);
    expect(screen.getByText(/more entries/i)).toBeInTheDocument();
  });

  it('shows no hint when every entry this period is already shown', () => {
    render(<AccountingSnapshot data={makeData({ entryTotal: 1, entries: [makeEntry()] })} isLoading={false} isError={false} />);
    expect(screen.queryByText(/more entries/i)).not.toBeInTheDocument();
  });
});
