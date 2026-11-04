import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/hooks/useUserPermissions', () => ({ useUserPermissions: vi.fn() }));
vi.mock('@/pages/calendar/components/InstallAppointmentDialog', () => ({
  InstallAppointmentDialog: (p: { mode: string; jobId?: string; appointmentId?: string }) => (
    <div role="dialog" aria-label="visit dialog">{p.mode}|{p.jobId ?? ''}|{p.appointmentId ?? ''}</div>
  ),
}));
vi.mock('@/services/installScheduleService', () => ({
  installScheduleService: { listForJob: vi.fn() },
}));

import { FabricationVisitsTab } from './FabricationVisitsTab';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { installScheduleService } from '@/services/installScheduleService';
import type { Appointment } from '@/types/installSchedule';

const svc = vi.mocked(installScheduleService);

function visit(id: string, type: Appointment['visitType'], day: string): Appointment {
  return {
    id, fabricationJobId: 'job-1', jobNumber: 'FJ-1', customerName: 'Acme', siteCity: 'Austin',
    visitType: type, status: 'scheduled', startsAt: '', endsAt: '',
    startLocal: `${day}T08:00`, endLocal: `${day}T12:00`, timezone: 'America/Chicago',
    allDay: false, localStartDate: day, localEndDate: day,
    crew: [{ employeeId: 1, name: 'Sam Lee', role: 'lead' }], notes: '', cancelReason: null, version: 1,
  };
}

function setPermissions(grants: string[]) {
  vi.mocked(useUserPermissions).mockReturnValue({
    grants: [], isLoading: false, isSuperAdmin: false, activeRoleId: '',
    hasPermission: (r: string, a: string) => grants.includes(`${r}:${a}`),
  } as ReturnType<typeof useUserPermissions>);
}

function renderTab() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter><FabricationVisitsTab jobId="job-1" /></MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  setPermissions(['install_appointment:read', 'install_appointment:create']);
  svc.listForJob.mockResolvedValue([visit('a1', 'template', '2099-03-03'), visit('a2', 'install', '2099-03-10')]);
});

describe('FabricationVisitsTab', () => {
  it('lists the job visits', async () => {
    renderTab();
    expect(await screen.findByText(/Template ·/)).toBeInTheDocument();
    expect(screen.getByText(/Install ·/)).toBeInTheDocument();
    expect(svc.listForJob).toHaveBeenCalledWith('job-1');
  });

  it('shows the empty copy when there are no visits', async () => {
    svc.listForJob.mockResolvedValue([]);
    renderTab();
    expect(await screen.findByText('No visits booked for this job.')).toBeInTheDocument();
  });

  it('Book visit opens the dialog with the job locked', async () => {
    const user = userEvent.setup();
    renderTab();
    await user.click(await screen.findByRole('button', { name: 'Book visit' }));
    expect(screen.getByRole('dialog', { name: 'visit dialog' })).toHaveTextContent('create|job-1|');
  });

  it('Open edits an existing visit', async () => {
    const user = userEvent.setup();
    renderTab();
    await user.click((await screen.findAllByRole('button', { name: /^Open/ }))[0]!);
    expect(screen.getByRole('dialog', { name: 'visit dialog' })).toHaveTextContent('edit||a1');
  });

  it('hides Book visit without the create grant', async () => {
    setPermissions(['install_appointment:read']);
    renderTab();
    await screen.findByText(/Template ·/);
    expect(screen.queryByRole('button', { name: 'Book visit' })).toBeNull();
  });

  it('renders nothing and fetches nothing without install_appointment:read', () => {
    setPermissions(['install_appointment:create']);
    const { container } = renderTab();
    expect(container).toBeEmptyDOMElement();
    expect(svc.listForJob).not.toHaveBeenCalled();
  });
});
