import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, AxiosHeaders } from 'axios';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/services/salesOrderService', () => ({
  salesOrderService: { getSchedule: vi.fn(), updateScheduleActivity: vi.fn() },
}));

import { SalesOrderSchedulingTab } from './SalesOrderSchedulingTab';
import { salesOrderService } from '@/services/salesOrderService';
import { toast } from 'sonner';
import type { SalesOrderScheduleActivity } from '@/types/salesOrder';

const ORDER_ID = 'so-1';

function row(over: Partial<SalesOrderScheduleActivity> & Pick<SalesOrderScheduleActivity, 'code' | 'name'>): SalesOrderScheduleActivity {
  return {
    sequence: 1,
    group: over.name,
    status: 'pending',
    scheduledAt: '2099-01-10T09:00:00',
    notes: '',
    ...over,
  };
}

const SAW_INDEX = 4;
const SCHEDULE: SalesOrderScheduleActivity[] = [
  row({ code: 'created', name: 'Created', sequence: 1, group: 'Created', status: 'completed', scheduledAt: '2026-10-12T08:15:00', completedAt: '2026-10-12T08:15:00' }),
  row({ code: 'template', name: 'Template', sequence: 2, group: 'Template', status: 'completed', scheduledAt: '2026-10-13T09:00:00', completedAt: '2026-10-13T10:30:00', notes: 'Customer on site' }),
  // Pending and long past: the one overdue row.
  row({ code: 'material_allocation', name: 'Material Allocation', sequence: 3, group: 'Material Allocation', scheduledAt: '2020-01-01T09:00:00' }),
  // Started, with its slot long past: in progress, not overdue.
  row({ code: 'engineering', name: 'Engineering', sequence: 4, group: 'Engineering', status: 'in_progress', scheduledAt: '2020-01-02T09:00:00' }),
  row({ code: 'saw', name: 'Saw', sequence: 5, group: 'Saw', scheduledAt: '2099-01-10T09:00:00', notes: 'Waiting on blade' }),
];

function renderTab(props: { canEdit: boolean; installDate?: string } = { canEdit: true, installDate: '2099-02-01' }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/sales/sales_order/so-1']}>
        <Routes>
          <Route
            path="/sales/sales_order/:id"
            element={<SalesOrderSchedulingTab orderId={ORDER_ID} installDate={props.installDate} canEdit={props.canEdit} />}
          />
          <Route path="/sales/sales_order/:id/edit" element={<p>Edit order page</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function serverError(message: string) {
  return new AxiosError('bad', 'ERR_BAD_REQUEST', undefined, undefined, {
    status: 400, statusText: 'Bad Request', headers: {}, config: { headers: new AxiosHeaders() },
    data: { success: false, message },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(salesOrderService.getSchedule).mockResolvedValue(SCHEDULE);
});

describe('SalesOrderSchedulingTab', () => {
  it('lists every activity with its status, scheduled time, completed-on and notes', async () => {
    renderTab();

    expect(await screen.findByRole('table')).toBeInTheDocument();
    const rows = screen.getAllByRole('row').slice(1); // drop the header row
    expect(rows).toHaveLength(SCHEDULE.length);

    const created = within(rows[0]);
    expect(created.getByText('Created')).toBeInTheDocument();
    expect(created.getByText('Completed')).toBeInTheDocument();

    const template = within(rows[1]);
    expect(template.getByText('Template')).toBeInTheDocument();
    expect(template.getByText('Oct 13, 2026, 9:00 AM')).toBeInTheDocument();
    expect(template.getByText('Oct 13, 2026, 10:30 AM')).toBeInTheDocument();
    expect(template.getByText('Customer on site')).toBeInTheDocument();

    const saw = within(rows[SAW_INDEX]);
    expect(saw.getByText('Pending')).toBeInTheDocument();
    expect(saw.getByText('Jan 10, 2099, 9:00 AM')).toBeInTheDocument();
  });

  it('names activities without a status word — pending, in progress and completed are statuses', async () => {
    renderTab();
    await screen.findByRole('table');

    const names = screen.getAllByRole('row').slice(1).map((r) => within(r).getAllByRole('cell')[0].textContent);
    expect(names).toEqual(['Created', 'Template', 'Material Allocation', 'Engineering', 'Saw']);
  });

  it('flags a pending activity whose time has passed as overdue and counts it', async () => {
    renderTab();
    await screen.findByRole('table');

    const overdueRow = screen.getByRole('row', { name: /Material Allocation/ });
    expect(within(overdueRow).getByText('Overdue')).toBeInTheDocument();
    expect(screen.getByText('1 overdue')).toBeInTheDocument();
    expect(screen.getByText(/of 5 completed/)).toHaveTextContent('2 of 5 completed');
  });

  it('shows a started activity as in progress, never overdue, and counts it', async () => {
    renderTab();
    await screen.findByRole('table');

    const started = screen.getByRole('row', { name: /Engineering/ });
    expect(within(started).getByText('In Progress')).toBeInTheDocument();
    expect(within(started).queryByText('Overdue')).not.toBeInTheDocument();
    expect(screen.getByText(/in progress$/)).toHaveTextContent('1 in progress');
  });

  it('shows the installation date the plan was built from', async () => {
    renderTab({ canEdit: true, installDate: '2099-02-01' });
    expect(await screen.findByText('Feb 1, 2099')).toBeInTheDocument();
  });

  it('explains an order with no schedule yet and sends an editor to set the date', async () => {
    vi.mocked(salesOrderService.getSchedule).mockResolvedValue([]);
    renderTab({ canEdit: true });

    expect(await screen.findByText('No schedule yet')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Set installation date' }));
    expect(await screen.findByText('Edit order page')).toBeInTheDocument();
  });

  it('does not offer the empty-state shortcut to someone who cannot edit', async () => {
    vi.mocked(salesOrderService.getSchedule).mockResolvedValue([]);
    renderTab({ canEdit: false });

    expect(await screen.findByText('No schedule yet')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Set installation date' })).not.toBeInTheDocument();
  });

  it('is read-only without edit permission', async () => {
    renderTab({ canEdit: false, installDate: '2099-02-01' });
    await screen.findByRole('table');
    expect(screen.queryByRole('button', { name: /^Edit / })).not.toBeInTheDocument();
  });

  it('offers pending, in progress and completed in the row editor', async () => {
    renderTab();
    await screen.findByRole('table');

    await userEvent.click(screen.getByRole('button', { name: 'Edit Saw' }));
    const options = within(screen.getByRole('combobox', { name: 'Status for Saw' })).getAllByRole('option');
    expect(options.map((o) => o.textContent)).toEqual(['Pending', 'In Progress', 'Completed']);
  });

  it('marks an activity completed from the row editor and says so', async () => {
    vi.mocked(salesOrderService.updateScheduleActivity).mockResolvedValue({ ...SCHEDULE[SAW_INDEX], status: 'completed', completedAt: '2026-10-14T11:00:00' });
    renderTab();
    await screen.findByRole('table');

    await userEvent.click(screen.getByRole('button', { name: 'Edit Saw' }));
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Status for Saw' }), 'completed');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes for Saw' }));

    await waitFor(() => expect(salesOrderService.updateScheduleActivity).toHaveBeenCalledWith(ORDER_ID, 'saw', { status: 'completed' }));
    expect(toast.success).toHaveBeenCalledWith('Saw marked completed.');
    // The editor closes once saved.
    await waitFor(() => expect(screen.queryByRole('combobox', { name: 'Status for Saw' })).not.toBeInTheDocument());
  });

  it('marks an activity in progress from the row editor and says so', async () => {
    vi.mocked(salesOrderService.updateScheduleActivity).mockResolvedValue({ ...SCHEDULE[SAW_INDEX], status: 'in_progress' });
    renderTab();
    await screen.findByRole('table');

    await userEvent.click(screen.getByRole('button', { name: 'Edit Saw' }));
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Status for Saw' }), 'in_progress');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes for Saw' }));

    await waitFor(() => expect(salesOrderService.updateScheduleActivity).toHaveBeenCalledWith(ORDER_ID, 'saw', { status: 'in_progress' }));
    expect(toast.success).toHaveBeenCalledWith('Saw marked in progress.');
  });

  it('sends only the notes when only the notes changed', async () => {
    vi.mocked(salesOrderService.updateScheduleActivity).mockResolvedValue({ ...SCHEDULE[SAW_INDEX], notes: 'Blade arrives Friday' });
    renderTab();
    await screen.findByRole('table');

    await userEvent.click(screen.getByRole('button', { name: 'Edit Saw' }));
    const notes = screen.getByRole('textbox', { name: 'Notes for Saw' });
    await userEvent.clear(notes);
    await userEvent.type(notes, 'Blade arrives Friday');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes for Saw' }));

    await waitFor(() => expect(salesOrderService.updateScheduleActivity).toHaveBeenCalledWith(ORDER_ID, 'saw', { notes: 'Blade arrives Friday' }));
    expect(toast.success).toHaveBeenCalledWith('Saw updated.');
  });

  it('sends the new scheduled time, keeping the date, when only the time changed', async () => {
    vi.mocked(salesOrderService.updateScheduleActivity).mockResolvedValue({ ...SCHEDULE[SAW_INDEX], scheduledAt: '2099-01-10T14:30:00' });
    renderTab();
    await screen.findByRole('table');

    await userEvent.click(screen.getByRole('button', { name: 'Edit Saw' }));
    fireEvent.change(screen.getByLabelText('Scheduled time for Saw'), { target: { value: '14:30' } });
    await userEvent.click(screen.getByRole('button', { name: 'Save changes for Saw' }));

    await waitFor(() => expect(salesOrderService.updateScheduleActivity).toHaveBeenCalledWith(
      ORDER_ID, 'saw', { scheduledAt: '2099-01-10T14:30' },
    ));
  });

  it('refuses a completed time that has no completed date', async () => {
    renderTab();
    await screen.findByRole('table');

    await userEvent.click(screen.getByRole('button', { name: 'Edit Saw' }));
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Status for Saw' }), 'completed');
    fireEvent.change(screen.getByLabelText('Completed time for Saw'), { target: { value: '10:00' } });
    await userEvent.click(screen.getByRole('button', { name: 'Save changes for Saw' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Pick the completed date as well as the time.');
    expect(salesOrderService.updateScheduleActivity).not.toHaveBeenCalled();
  });

  it('closes without a request when nothing changed', async () => {
    renderTab();
    await screen.findByRole('table');

    await userEvent.click(screen.getByRole('button', { name: 'Edit Saw' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save changes for Saw' }));

    expect(salesOrderService.updateScheduleActivity).not.toHaveBeenCalled();
    expect(screen.queryByRole('combobox', { name: 'Status for Saw' })).not.toBeInTheDocument();
  });

  it('keeps the editor open and shows the server message when a save is refused', async () => {
    vi.mocked(salesOrderService.updateScheduleActivity).mockRejectedValue(serverError('Completed on cannot be in the future.'));
    renderTab();
    await screen.findByRole('table');

    await userEvent.click(screen.getByRole('button', { name: 'Edit Saw' }));
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Status for Saw' }), 'completed');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes for Saw' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Completed on cannot be in the future.');
    expect(screen.getByRole('combobox', { name: 'Status for Saw' })).toBeInTheDocument();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('cancels an edit without saving', async () => {
    renderTab();
    await screen.findByRole('table');

    await userEvent.click(screen.getByRole('button', { name: 'Edit Saw' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel editing for Saw' }));

    expect(salesOrderService.updateScheduleActivity).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Edit Saw' })).toBeInTheDocument();
  });

  it('locks the status of the Created row', async () => {
    renderTab();
    await screen.findByRole('table');

    await userEvent.click(screen.getByRole('button', { name: 'Edit Created' }));
    expect(screen.getByRole('combobox', { name: 'Status for Created' })).toBeDisabled();
  });
});
