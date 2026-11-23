import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, type AxiosResponse } from 'axios';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { CustomReportInterpretation, SavedCustomReport } from '@/types/customReports';

vi.mock('@/services/customReportsService', () => ({
  customReportsService: { list: vi.fn(), catalog: vi.fn(), interpret: vi.fn() },
}));
const permissions = vi.hoisted(() => ({ hasPermission: vi.fn() }));
vi.mock('@/hooks/useUserPermissions', () => ({
  useUserPermissions: () => ({ hasPermission: permissions.hasPermission, grants: [], isLoading: false, activeRoleId: '' }),
}));

import CustomReportsPage from './CustomReportsPage';
import { customReportsService } from '@/services/customReportsService';
import { CUSTOM_PROMPT_MAX_BYTES } from '@/types/customReports';

const MINE: SavedCustomReport = {
  id: 'r-mine',
  name: 'Revenue by customer',
  definition: { source: 'invoice_lines', columns: [], filters: [], totals: [], chart: 'none' },
  shared: true,
  ownerName: 'Pat Doe',
  isMine: true,
  updatedAt: '2026-11-05T10:00:00Z',
};

const THEIRS: SavedCustomReport = {
  ...MINE,
  id: 'r-theirs',
  name: 'Open POs by vendor',
  definition: { ...MINE.definition, source: 'purchase_orders' },
  ownerName: 'Sam Lee',
  isMine: false,
};

const PRIVATE: SavedCustomReport = { ...MINE, id: 'r-private', name: 'My private list', shared: false };

const INTERPRETATION: CustomReportInterpretation = {
  definition: { source: 'invoice_lines', columns: [], filters: [], totals: [{ fn: 'count' }], groupBy: { field: 'customer.name' }, chart: 'bar' },
  summary: 'Revenue by customer',
  dropped: [],
};

function BuilderEcho() {
  const location = useLocation();
  const state = location.state as { interpretation?: CustomReportInterpretation } | null;
  return <p>Builder at {location.pathname}: {state?.interpretation?.summary ?? 'no interpretation'}</p>;
}

function renderPage(): void {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/reports/custom']}>
        <Routes>
          <Route path="/reports/custom" element={<CustomReportsPage />} />
          <Route path="/reports/custom/*" element={<BuilderEcho />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function serverError(status: number, message: string): AxiosError {
  return new AxiosError(message, String(status), undefined, undefined, { status, data: { message } } as AxiosResponse);
}

beforeEach(() => {
  vi.clearAllMocks();
  permissions.hasPermission.mockReturnValue(true);
  vi.mocked(customReportsService.list).mockResolvedValue([MINE, THEIRS, PRIVATE]);
  vi.mocked(customReportsService.catalog).mockResolvedValue([
    { key: 'invoice_lines', label: 'Invoice lines', module: 'sales', fields: [] },
    { key: 'purchase_orders', label: 'Purchase orders', module: 'purchases', fields: [] },
  ]);
});

describe('CustomReportsPage list', () => {
  it('puts the caller’s reports under My reports and others’ shared ones under Shared with workspace', async () => {
    renderPage();
    expect(await screen.findByRole('button', { name: 'Open report Revenue by customer' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open report My private list' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open report Open POs by vendor' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab', { name: 'Shared with workspace' }));
    expect(screen.getByRole('button', { name: 'Open report Open POs by vendor' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open report My private list' })).not.toBeInTheDocument();
  });

  it('shows the source as its label, who shares it, and whether it is shared', async () => {
    renderPage();
    const table = await screen.findByRole('table', { name: 'My reports' });
    const row = within(table).getByText('Revenue by customer').closest('tr') as HTMLElement;
    expect(within(row).getByText('Invoice lines')).toBeInTheDocument();
    expect(within(row).getByText('Yes')).toBeInTheDocument();
    const privateRow = within(table).getByText('My private list').closest('tr') as HTMLElement;
    expect(within(privateRow).getByText('No')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab', { name: 'Shared with workspace' }));
    expect(within(screen.getByRole('table', { name: 'Shared with workspace' })).getByText('Sam Lee')).toBeInTheDocument();
  });

  it('opens a report in the builder when its name is clicked', async () => {
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Open report Revenue by customer' }));
    expect(await screen.findByText('Builder at /reports/custom/r-mine: no interpretation')).toBeInTheDocument();
  });

  it('says so when there are no reports yet', async () => {
    vi.mocked(customReportsService.list).mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText(/No reports yet/)).toBeInTheDocument();
  });

  it('offers + New report only to someone who can create', async () => {
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'New report' }));
    expect(await screen.findByText('Builder at /reports/custom/new: no interpretation')).toBeInTheDocument();
  });

  it('hides + New report without custom_report:create', async () => {
    permissions.hasPermission.mockImplementation((resource: string, action: string) => !(resource === 'custom_report' && action === 'create'));
    renderPage();
    await screen.findByRole('button', { name: 'Open report Revenue by customer' });
    expect(screen.queryByRole('button', { name: 'New report' })).not.toBeInTheDocument();
  });

  it('shows the server message when the list cannot load', async () => {
    vi.mocked(customReportsService.list).mockRejectedValue(serverError(500, 'Could not complete that request.'));
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not complete that request.');
  });
});

describe('CustomReportsPage plain-English box', () => {
  it('fills the box from an example chip', async () => {
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Top 10 customers by invoice revenue this quarter' }));
    expect(screen.getByRole('textbox', { name: 'Describe the report you want' })).toHaveValue('Top 10 customers by invoice revenue this quarter');
  });

  it('sends the request and opens the builder with what the assistant understood', async () => {
    vi.mocked(customReportsService.interpret).mockResolvedValue(INTERPRETATION);
    renderPage();
    await userEvent.type(await screen.findByRole('textbox', { name: 'Describe the report you want' }), 'revenue by customer');
    await userEvent.click(screen.getByRole('button', { name: 'Build it' }));
    expect(await screen.findByText('Builder at /reports/custom/new: Revenue by customer')).toBeInTheDocument();
    expect(customReportsService.interpret).toHaveBeenCalledWith('revenue by customer');
  });

  it('keeps Build it disabled until something is typed', async () => {
    renderPage();
    const button = await screen.findByRole('button', { name: 'Build it' });
    expect(button).toBeDisabled();
    await userEvent.type(screen.getByRole('textbox', { name: 'Describe the report you want' }), 'x');
    expect(button).toBeEnabled();
  });

  it('shows the server message and a way to carry on by hand when the assistant is unavailable', async () => {
    vi.mocked(customReportsService.interpret).mockRejectedValue(
      serverError(503, 'The AI assistant is not available right now. You can still build the report by hand.'),
    );
    renderPage();
    await userEvent.type(await screen.findByRole('textbox', { name: 'Describe the report you want' }), 'anything');
    await userEvent.click(screen.getByRole('button', { name: 'Build it' }));
    expect(await screen.findByText(/You can still build the report by hand/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Start a report by hand' })).toHaveAttribute('href', '/reports/custom/new');
  });

  it('tells the user the first request can take up to a minute while it waits', async () => {
    vi.mocked(customReportsService.interpret).mockReturnValue(new Promise(() => undefined));
    renderPage();
    await userEvent.type(await screen.findByRole('textbox', { name: 'Describe the report you want' }), 'anything');
    await userEvent.click(screen.getByRole('button', { name: 'Build it' }));
    expect(await screen.findByRole('status')).toHaveTextContent(/up to a minute/);
    expect(screen.getByRole('button', { name: 'Build it' })).toBeDisabled();
  });

  it('refuses a request over the byte limit before sending it', async () => {
    renderPage();
    const box = await screen.findByRole('textbox', { name: 'Describe the report you want' });
    fireEvent.change(box, { target: { value: 'a'.repeat(CUSTOM_PROMPT_MAX_BYTES + 1) } });
    expect(screen.getByText('Please shorten your request.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Build it' })).toBeDisabled();
    expect(customReportsService.interpret).not.toHaveBeenCalled();
  });
});

describe('CustomReportsPage accessibility', () => {
  it('announces a too-long request and marks the box invalid', async () => {
    renderPage();
    const box = await screen.findByRole('textbox', { name: 'Describe the report you want' });
    fireEvent.change(box, { target: { value: 'a'.repeat(CUSTOM_PROMPT_MAX_BYTES + 1) } });
    expect(screen.getByRole('alert')).toHaveTextContent('Please shorten your request.');
    expect(box).toHaveAttribute('aria-invalid', 'true');
    expect(box).toHaveAccessibleDescription('Please shorten your request.');
  });

  it('moves between the report tabs with the arrow, Home and End keys, and only the selected tab is tabbable', async () => {
    renderPage();
    const mine = await screen.findByRole('tab', { name: 'My reports' });
    const shared = screen.getByRole('tab', { name: 'Shared with workspace' });
    expect(mine).toHaveAttribute('tabindex', '0');
    expect(shared).toHaveAttribute('tabindex', '-1');

    mine.focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(shared).toHaveAttribute('aria-selected', 'true');
    expect(shared).toHaveFocus();
    await userEvent.keyboard('{ArrowRight}');
    expect(mine).toHaveAttribute('aria-selected', 'true');
    await userEvent.keyboard('{End}');
    expect(shared).toHaveFocus();
    await userEvent.keyboard('{Home}');
    expect(mine).toHaveFocus();
  });

  it('names the tab panel by its tab', async () => {
    renderPage();
    const mine = await screen.findByRole('tab', { name: 'My reports' });
    expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', mine.id);
    expect(mine).toHaveAttribute('aria-controls', screen.getByRole('tabpanel').id);
  });
});
