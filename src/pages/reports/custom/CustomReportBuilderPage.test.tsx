import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, type AxiosResponse } from 'axios';
import { Route, Routes, useLocation } from 'react-router-dom';
import { DataMemoryRouter } from '@/test/DataMemoryRouter';
import type {
  CatalogSource,
  CustomReportDefinition,
  CustomReportInterpretation,
  CustomReportResult,
  SavedCustomReport,
} from '@/types/customReports';

vi.mock('@/services/customReportsService', () => ({
  customReportsService: {
    catalog: vi.fn(),
    get: vi.fn(),
    run: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    copy: vi.fn(),
    interpret: vi.fn(),
  },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../components/ReportTopBarChart', () => ({ ReportTopBarChart: () => <div data-testid="bar-chart" /> }));
vi.mock('@/lib/reportExport', () => ({ exportReportCsv: vi.fn(), exportReportPdf: vi.fn().mockResolvedValue(undefined) }));
const permissions = vi.hoisted(() => ({ hasPermission: vi.fn() }));
vi.mock('@/hooks/useUserPermissions', () => ({
  useUserPermissions: () => ({ hasPermission: permissions.hasPermission, grants: [], isLoading: false, activeRoleId: '' }),
}));

import CustomReportBuilderPage from './CustomReportBuilderPage';
import { customReportsService } from '@/services/customReportsService';
import { exportReportCsv } from '@/lib/reportExport';
import { resolveReportRange } from '@/lib/reportDateRange';
import { useBreadcrumbStore } from '@/store/useBreadcrumbStore';
import { CUSTOM_EXPORT_ROW_LIMIT } from '@/types/customReports';

const CATALOG: CatalogSource[] = [
  {
    key: 'invoice_lines',
    label: 'Invoice lines',
    module: 'sales',
    fields: [
      { key: 'item_name', label: 'Line item name', group: '', type: 'text' },
      { key: 'sku', label: 'Line SKU', group: '', type: 'text' },
      { key: 'net_amount', label: 'Net amount', group: '', type: 'money' },
      { key: 'customer.name', label: 'Customer name', group: 'Customer', type: 'text' },
      { key: 'invoice.date', label: 'Invoice date', group: 'Invoice', type: 'date' },
      { key: 'invoice.status', label: 'Invoice status', group: 'Invoice', type: 'status', options: ['Paid', 'Sent'] },
    ],
  },
  { key: 'payments', label: 'Payments', module: 'sales', fields: [{ key: 'number', label: 'Number', group: '', type: 'text' }] },
];

const GROUPED: CustomReportDefinition = {
  source: 'invoice_lines',
  columns: [],
  filters: [{ field: 'invoice.date', op: 'date_range', values: [], preset: 'this-quarter' }],
  groupBy: { field: 'customer.name' },
  totals: [{ fn: 'sum', field: 'net_amount' }],
  chart: 'bar',
};

const RESULT: CustomReportResult = {
  columns: [
    { key: 'group', label: 'Customer name', type: 'text' },
    { key: 'total:0', label: 'Sum of Net amount', type: 'money' },
  ],
  rows: [['Acme', 1500]],
  totals: [null, 1500],
  rowCount: 3,
  truncated: false,
};

const SAVED: SavedCustomReport = {
  id: 'r-1',
  name: 'Revenue by customer',
  definition: GROUPED,
  shared: false,
  ownerName: 'Pat Doe',
  isMine: true,
  updatedAt: '2026-11-05T10:00:00Z',
};

const INTERPRETATION: CustomReportInterpretation = {
  definition: GROUPED,
  summary: 'Revenue by customer this quarter',
  dropped: ['ghost'],
};

function Echo() {
  const location = useLocation();
  return <p>Now at {location.pathname}</p>;
}

function renderBuilder(entry: string | { pathname: string; state: unknown }): void {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <DataMemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/reports/custom/new" element={<CustomReportBuilderPage />} />
          <Route path="/reports/custom/:id" element={<CustomReportBuilderPage />} />
          <Route path="/reports/custom" element={<Echo />} />
        </Routes>
      </DataMemoryRouter>
    </QueryClientProvider>,
  );
}

const NEW_FROM_ASSISTANT = { pathname: '/reports/custom/new', state: { interpretation: INTERPRETATION } };

function serverError(status: number, message: string): AxiosError {
  return new AxiosError(message, String(status), undefined, undefined, { status, data: { message } } as AxiosResponse);
}

async function choose(combobox: string, option: string): Promise<void> {
  await userEvent.click(screen.getByRole('combobox', { name: combobox }));
  await userEvent.click(await screen.findByRole('option', { name: option }));
}

function lastRunDefinition(): CustomReportDefinition {
  const calls = vi.mocked(customReportsService.run).mock.calls;
  return calls[calls.length - 1][0];
}

beforeEach(() => {
  vi.clearAllMocks();
  permissions.hasPermission.mockReturnValue(true);
  useBreadcrumbStore.setState({ labels: {} });
  vi.mocked(customReportsService.catalog).mockResolvedValue(CATALOG);
  vi.mocked(customReportsService.run).mockResolvedValue(RESULT);
  vi.mocked(customReportsService.get).mockResolvedValue(SAVED);
});

describe('CustomReportBuilderPage', () => {
  it('opens on what the assistant understood, says so, and runs it with today’s dates', async () => {
    renderBuilder(NEW_FROM_ASSISTANT);
    expect(await screen.findByText(/Revenue by customer this quarter/)).toBeInTheDocument();
    expect(screen.getByText(/ghost/)).toBeInTheDocument();
    await waitFor(() => expect(customReportsService.run).toHaveBeenCalled(), { timeout: 3000 });
    const { from, to } = resolveReportRange('this-quarter', new Date());
    expect(lastRunDefinition().filters[0].values).toEqual([from, to]);
    expect(await screen.findByText('Acme')).toBeInTheDocument();
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
  });

  it('tells screen-reader users when the results change', async () => {
    renderBuilder(NEW_FROM_ASSISTANT);
    const status = await screen.findByText('Report updated: 1 row.', undefined, { timeout: 3000 });
    expect(status.closest('[role="status"]')).not.toBeNull();
  });

  it('shows the totals row under the table', async () => {
    renderBuilder(NEW_FROM_ASSISTANT);
    const table = await screen.findByRole('table', { name: 'Custom report results' }, { timeout: 3000 });
    const footer = within(table).getAllByRole('row').at(-1) as HTMLElement;
    expect(within(footer).getByText('Total')).toBeInTheDocument();
  });

  it('runs again when a total is changed', async () => {
    renderBuilder(NEW_FROM_ASSISTANT);
    await waitFor(() => expect(customReportsService.run).toHaveBeenCalledTimes(1), { timeout: 3000 });
    await choose('Total 1 function', 'Average');
    await waitFor(() => expect(customReportsService.run).toHaveBeenCalledTimes(2), { timeout: 3000 });
    expect(lastRunDefinition().totals).toEqual([{ fn: 'avg', field: 'net_amount' }]);
  });

  it('says when the preview was cut at the row limit', async () => {
    vi.mocked(customReportsService.run).mockResolvedValue({ ...RESULT, truncated: true });
    renderBuilder(NEW_FROM_ASSISTANT);
    expect(await screen.findByText(/Showing the first 500 rows/, undefined, { timeout: 3000 })).toBeInTheDocument();
  });

  it('shows the server message in place of the preview and keeps exports off when the source is no longer allowed', async () => {
    vi.mocked(customReportsService.run).mockRejectedValue(serverError(403, 'You no longer have access to Invoice lines.'));
    renderBuilder(NEW_FROM_ASSISTANT);
    expect(await screen.findByText('You no longer have access to Invoice lines.', undefined, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download CSV' })).toBeDisabled();
  });

  it('does not send a half-filled filter to the server', async () => {
    renderBuilder(NEW_FROM_ASSISTANT);
    await waitFor(() => expect(customReportsService.run).toHaveBeenCalledTimes(1), { timeout: 3000 });
    await userEvent.click(screen.getByRole('button', { name: 'Add filter' }));
    await new Promise((resolve) => setTimeout(resolve, 600));
    expect(customReportsService.run).toHaveBeenCalledTimes(1);
  });

  describe('a new report', () => {
    it('saves with the name and share setting, then moves to the saved report', async () => {
      vi.mocked(customReportsService.create).mockResolvedValue({ ...SAVED, id: 'r-new' });
      renderBuilder(NEW_FROM_ASSISTANT);
      const name = await screen.findByRole('textbox', { name: 'Report name' });
      await userEvent.clear(name);
      await userEvent.type(name, 'Quarterly revenue');
      await userEvent.click(screen.getByRole('switch', { name: 'Share with workspace' }));
      await userEvent.click(screen.getByRole('button', { name: 'Save report' }));
      await waitFor(() => expect(customReportsService.create).toHaveBeenCalled());
      expect(vi.mocked(customReportsService.create).mock.calls[0][0]).toMatchObject({ name: 'Quarterly revenue', shared: true });
      const saved = vi.mocked(customReportsService.create).mock.calls[0][0].definition.filters[0];
      // The server only accepts two real dates, so the relative preset is saved WITH its dates.
      expect(saved.preset).toBe('this-quarter');
      expect(saved.values).toEqual(Object.values(resolveReportRange('this-quarter', new Date())));
      await waitFor(() => expect(customReportsService.get).toHaveBeenCalledWith('r-new'));
    });

    it('starts empty when opened without an interpretation', async () => {
      renderBuilder('/reports/custom/new');
      expect(await screen.findByRole('combobox', { name: 'Source' })).toHaveTextContent('Invoice lines');
      expect(screen.getByRole('textbox', { name: 'Report name' })).toHaveValue('Untitled report');
      expect(screen.queryByRole('button', { name: 'Save a copy' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Delete report' })).not.toBeInTheDocument();
    });

    it('hides Save without custom_report:create but still runs the report', async () => {
      permissions.hasPermission.mockImplementation((resource: string, action: string) => !(resource === 'custom_report' && action === 'create'));
      renderBuilder(NEW_FROM_ASSISTANT);
      await screen.findByRole('textbox', { name: 'Report name' });
      expect(screen.queryByRole('button', { name: 'Save report' })).not.toBeInTheDocument();
      await waitFor(() => expect(customReportsService.run).toHaveBeenCalled(), { timeout: 3000 });
    });
  });

  describe('a saved report', () => {
    it('loads it, labels the breadcrumb with its name, and updates it on Save', async () => {
      vi.mocked(customReportsService.update).mockResolvedValue(SAVED);
      renderBuilder('/reports/custom/r-1');
      const name = await screen.findByRole('textbox', { name: 'Report name' });
      expect(name).toHaveValue('Revenue by customer');
      expect(useBreadcrumbStore.getState().labels['r-1']).toBe('Revenue by customer');
      await userEvent.type(name, ' 2');
      await userEvent.click(screen.getByRole('button', { name: 'Save report' }));
      await waitFor(() => expect(customReportsService.update).toHaveBeenCalledWith('r-1', expect.objectContaining({ name: 'Revenue by customer 2' })));
    });

    it('drops fields the catalog no longer has and tells the user', async () => {
      vi.mocked(customReportsService.get).mockResolvedValue({
        ...SAVED,
        definition: { ...GROUPED, filters: [{ field: 'ghost', op: 'eq', values: ['x'] }], groupBy: { field: 'customer.name' } },
      });
      renderBuilder('/reports/custom/r-1');
      expect(await screen.findByText(/no longer available and was removed/)).toHaveTextContent('ghost');
      await waitFor(() => expect(customReportsService.run).toHaveBeenCalled(), { timeout: 3000 });
      expect(lastRunDefinition().filters).toEqual([]);
    });

    it('deletes after a confirmation and returns to the list', async () => {
      vi.mocked(customReportsService.remove).mockResolvedValue(undefined);
      renderBuilder('/reports/custom/r-1');
      await userEvent.click(await screen.findByRole('button', { name: 'Delete report' }));
      expect(customReportsService.remove).not.toHaveBeenCalled();
      await userEvent.click(await screen.findByRole('button', { name: 'Delete' }));
      await waitFor(() => expect(customReportsService.remove).toHaveBeenCalledWith('r-1'));
      expect(await screen.findByText('Now at /reports/custom')).toBeInTheDocument();
    });

    it('saves a copy and opens it', async () => {
      vi.mocked(customReportsService.copy).mockResolvedValue({ ...SAVED, id: 'r-copy', name: 'Revenue by customer (copy)' });
      renderBuilder('/reports/custom/r-1');
      await userEvent.click(await screen.findByRole('button', { name: 'Save a copy' }));
      await waitFor(() => expect(customReportsService.copy).toHaveBeenCalledWith('r-1'));
      await waitFor(() => expect(customReportsService.get).toHaveBeenCalledWith('r-copy'));
    });
  });

  describe('someone else’s shared report', () => {
    beforeEach(() => {
      vi.mocked(customReportsService.get).mockResolvedValue({ ...SAVED, isMine: false, shared: true, ownerName: 'Sam Lee' });
    });

    it('is read-only: no Save or Delete, settings disabled, but it can be copied and exported', async () => {
      renderBuilder('/reports/custom/r-1');
      expect(await screen.findByRole('button', { name: 'Save a copy' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Save report' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Delete report' })).not.toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: 'Report name' })).toBeDisabled();
      expect(screen.getByRole('combobox', { name: 'Group by field' })).toBeDisabled();
      expect(screen.getByText(/Shared by Sam Lee/)).toBeInTheDocument();
    });
  });

  describe('Describe a change', () => {
    const PAID_ONLY: CustomReportInterpretation = {
      definition: { ...GROUPED, filters: [{ field: 'invoice.status', op: 'in', values: ['Paid'] }] },
      summary: 'Only paid invoices',
      dropped: [],
    };

    it('applies the assistant’s change to the report, re-runs it, and can undo it', async () => {
      vi.mocked(customReportsService.interpret).mockResolvedValue(PAID_ONLY);
      renderBuilder(NEW_FROM_ASSISTANT);
      await waitFor(() => expect(customReportsService.run).toHaveBeenCalledTimes(1), { timeout: 3000 });

      await userEvent.type(await screen.findByRole('textbox', { name: 'Describe a change' }), 'only paid');
      await userEvent.click(screen.getByRole('button', { name: 'Apply change' }));

      expect(customReportsService.interpret).toHaveBeenCalledWith('only paid', expect.objectContaining({ source: 'invoice_lines' }));
      await waitFor(() => expect(customReportsService.run).toHaveBeenCalledTimes(2), { timeout: 3000 });
      expect(lastRunDefinition().filters).toEqual([{ field: 'invoice.status', op: 'in', values: ['Paid'] }]);

      await userEvent.click(await screen.findByRole('button', { name: 'Undo this change' }));
      await waitFor(() => expect(customReportsService.run).toHaveBeenCalledTimes(3), { timeout: 3000 });
      expect(lastRunDefinition().filters[0].preset).toBe('this-quarter');
    });

    it('is not offered on someone else’s shared report', async () => {
      vi.mocked(customReportsService.get).mockResolvedValue({ ...SAVED, isMine: false, shared: true });
      renderBuilder('/reports/custom/r-1');
      await screen.findByRole('textbox', { name: 'Report name' });
      expect(screen.queryByRole('textbox', { name: 'Describe a change' })).not.toBeInTheDocument();
    });
  });

  describe('exports', () => {
    it('re-runs at the export limit and exports the whole result', async () => {
      renderBuilder(NEW_FROM_ASSISTANT);
      await screen.findByText('Acme', undefined, { timeout: 3000 });
      vi.mocked(customReportsService.run).mockClear();
      await userEvent.click(screen.getByRole('button', { name: 'Download CSV' }));
      await waitFor(() => expect(exportReportCsv).toHaveBeenCalled());
      expect(vi.mocked(customReportsService.run).mock.calls[0][1]).toBe(CUSTOM_EXPORT_ROW_LIMIT);
      expect(vi.mocked(exportReportCsv).mock.calls[0][0]).toMatchObject({ title: 'Revenue by customer this quarter', headers: ['Customer name', 'Sum of Net amount'] });
    });
  });
});
