import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, AxiosHeaders } from 'axios';

vi.mock('@/hooks/useUserPermissions', () => ({ useUserPermissions: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), warning: vi.fn(), error: vi.fn() } }));
vi.mock('@/services/fabricationService', () => ({
  fabricationService: { getJob: vi.fn(), searchJobs: vi.fn() },
}));
vi.mock('@/services/installScheduleService', async (orig) => {
  const actual = await orig<Record<string, unknown>>();
  return {
    ...actual,
    installScheduleService: {
      getAppointment: vi.fn(), createAppointment: vi.fn(), updateAppointment: vi.fn(),
      cancelAppointment: vi.fn(), completeAppointment: vi.fn(), getCrewOptions: vi.fn(),
    },
  };
});

import { InstallAppointmentDialog } from './InstallAppointmentDialog';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { fabricationService } from '@/services/fabricationService';
import { installScheduleService } from '@/services/installScheduleService';
import { toast } from 'sonner';
import type { Appointment } from '@/types/installSchedule';

const svc = vi.mocked(installScheduleService);

const visit: Appointment = {
  id: 'a1', fabricationJobId: 'j1', jobNumber: 'FJ-1042', customerName: 'Acme', siteCity: 'Austin',
  visitType: 'install', status: 'scheduled', startsAt: '', endsAt: '',
  startLocal: '2099-03-03T08:00', endLocal: '2099-03-03T12:00', timezone: 'America/Chicago',
  allDay: false, localStartDate: '2099-03-03', localEndDate: '2099-03-03',
  crew: [{ employeeId: 12, name: 'Sam Lee', role: 'lead' }], notes: '', cancelReason: null, version: 3,
};

function http409(data: object) {
  return new AxiosError('conflict', 'ERR_BAD_REQUEST', undefined, undefined, {
    status: 409, statusText: 'Conflict', headers: {}, config: { headers: new AxiosHeaders() }, data,
  });
}

const CONFLICT = {
  success: false, code: 'conflict', requiresAcknowledgement: true, message: 'This visit overlaps 1 other booking.',
  conflicts: [{ type: 'crew', severity: 'soft', employeeId: 12, employeeName: 'Sam Lee', startLocal: '2099-03-03T09:00', endLocal: '2099-03-03T11:00' }],
};

function Harness(props: { mode: 'create' | 'edit'; appointmentId?: string; jobId?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Open visit</button>
      {open && <InstallAppointmentDialog {...props} defaultDate="2099-03-03" onClose={() => setOpen(false)} />}
    </>
  );
}

async function openDialog(props: Parameters<typeof Harness>[0]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><Harness {...props} /></QueryClientProvider>);
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Open visit' }));
  return user;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useUserPermissions).mockReturnValue({
    grants: [], isLoading: false, isSuperAdmin: false, activeRoleId: '', hasPermission: () => true,
  } as ReturnType<typeof useUserPermissions>);
  vi.mocked(fabricationService.getJob).mockResolvedValue({
    id: 'j1', jobNumber: 'FJ-1042', customer: { id: 'c1', name: 'Acme' }, promisedInstallDate: '2099-03-10',
  } as never);
  svc.getCrewOptions.mockResolvedValue([
    { employeeId: 12, name: 'Sam Lee', hasLogin: true },
    { employeeId: 15, name: 'Pat Roe', hasLogin: false },
  ]);
  svc.getAppointment.mockResolvedValue(visit);
  svc.createAppointment.mockResolvedValue({ appointment: visit, emailSent: true });
});

describe('InstallAppointmentDialog', () => {
  it('lists the conflicts and books anyway with the same request id', async () => {
    svc.createAppointment.mockRejectedValueOnce(http409(CONFLICT));
    const user = await openDialog({ mode: 'create', jobId: 'j1' });
    await screen.findByText('FJ-1042 · Acme');
    await user.click(await screen.findByRole('checkbox', { name: /Pat Roe/ }));
    await user.click(screen.getByRole('button', { name: 'Book visit' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Sam Lee is already booked');
    await user.click(screen.getByRole('button', { name: 'Book anyway' }));

    await waitFor(() => expect(svc.createAppointment).toHaveBeenCalledTimes(2));
    const [first, second] = svc.createAppointment.mock.calls.map((c) => c[0]);
    expect(first.acknowledgeConflicts).toBeUndefined();
    expect(second.acknowledgeConflicts).toBe(true);
    expect(second.requestId).toBe(first.requestId);
    expect(second.fabricationJobId).toBe('j1');
  });

  it('shows the reload message on a stale edit and Reload refetches the visit', async () => {
    svc.updateAppointment.mockRejectedValueOnce(http409({ success: false, code: 'stale_version', message: 'x', currentVersion: 4 }));
    const user = await openDialog({ mode: 'edit', appointmentId: 'a1' });
    await user.click(await screen.findByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Someone else changed this visit. Reload to see the latest.')).toBeInTheDocument();
    expect(svc.getAppointment).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Reload' }));
    await waitFor(() => expect(svc.getAppointment).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByText(/Someone else changed/)).not.toBeInTheDocument());
  });

  it('closes on Escape and returns focus to the trigger', async () => {
    const user = await openDialog({ mode: 'create', jobId: 'j1' });
    expect(await screen.findByRole('dialog', { name: 'New visit' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Open visit' })).toHaveFocus();
  });

  it('keeps Cancel visit disabled until a reason is entered, then cancels', async () => {
    svc.cancelAppointment.mockResolvedValue({ appointment: { ...visit, status: 'cancelled' }, emailSent: true });
    const user = await openDialog({ mode: 'edit', appointmentId: 'a1' });
    await user.click(await screen.findByRole('button', { name: 'Cancel visit' }));

    const cancelDialog = await screen.findByRole('dialog', { name: /Cancel visit FJ-1042/ });
    const confirm = cancelDialog.querySelector('button.bg-destructive') as HTMLButtonElement;
    expect(confirm).toBeDisabled();
    await user.type(screen.getByLabelText('Reason (required)'), '   ');
    expect(confirm).toBeDisabled();
    await user.type(screen.getByLabelText('Reason (required)'), 'Customer moved');
    expect(confirm).toBeEnabled();
    await user.click(confirm);
    await waitFor(() => expect(svc.cancelAppointment).toHaveBeenCalledWith('a1', { expectedVersion: 3, reason: 'Customer moved' }));
  });

  it('Escape closes only the cancel dialog when it is on top', async () => {
    const user = await openDialog({ mode: 'edit', appointmentId: 'a1' });
    await user.click(await screen.findByRole('button', { name: 'Cancel visit' }));
    await screen.findByRole('dialog', { name: /Cancel visit FJ-1042/ });
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /Cancel visit FJ-1042/ })).not.toBeInTheDocument());
    expect(screen.getByRole('dialog', { name: 'Edit visit' })).toBeInTheDocument();
  });

  it('warns when crew without a login were not emailed', async () => {
    svc.createAppointment.mockResolvedValue({ appointment: visit, emailSent: false });
    const user = await openDialog({ mode: 'create', jobId: 'j1' });
    await screen.findByText('FJ-1042 · Acme');
    await user.click(await screen.findByRole('checkbox', { name: /Pat Roe/ }));
    await user.click(screen.getByRole('button', { name: 'Book visit' }));
    await waitFor(() =>
      expect(toast.warning).toHaveBeenCalledWith('Saved. Some crew have no login and were not notified.'),
    );
  });

  it('sets the duration to one hour when the type is Template', async () => {
    const user = await openDialog({ mode: 'create', jobId: 'j1' });
    const duration = await screen.findByLabelText('Duration');
    expect(duration).toHaveValue('240');
    await user.click(screen.getByRole('radio', { name: 'Template' }));
    expect(screen.getByLabelText('Duration')).toHaveValue('60');
  });

  it('is read-only without the update grant', async () => {
    vi.mocked(useUserPermissions).mockReturnValue({
      grants: [], isLoading: false, isSuperAdmin: false, activeRoleId: '',
      hasPermission: (_r: string, a: string) => a === 'read',
    } as ReturnType<typeof useUserPermissions>);
    await openDialog({ mode: 'edit', appointmentId: 'a1' });
    await screen.findByText('FJ-1042 · Acme');
    expect(screen.queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel visit' })).not.toBeInTheDocument();
  });

  it('shows the visit crew read-only, without loading crew options, for a reader', async () => {
    vi.mocked(useUserPermissions).mockReturnValue({
      grants: [], isLoading: false, isSuperAdmin: false, activeRoleId: '',
      hasPermission: (_r: string, a: string) => a === 'read',
    } as ReturnType<typeof useUserPermissions>);
    svc.getAppointment.mockResolvedValue({
      ...visit,
      crew: [{ employeeId: 12, name: 'Sam Lee', role: 'lead' }, { employeeId: 15, name: 'Pat Roe', role: 'member' }],
    });
    await openDialog({ mode: 'edit', appointmentId: 'a1' });
    const list = await screen.findByRole('list', { name: 'Crew' });
    expect(list).toHaveTextContent('Sam Lee');
    expect(list).toHaveTextContent('Lead');
    expect(list).toHaveTextContent('Pat Roe');
    expect(screen.queryByText('No crew members available.')).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /Sam Lee/ })).not.toBeInTheDocument();
    expect(svc.getCrewOptions).not.toHaveBeenCalled();
  });
});
