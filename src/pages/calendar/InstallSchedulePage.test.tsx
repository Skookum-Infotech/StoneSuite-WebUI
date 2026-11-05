import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/hooks/useUserPermissions', () => ({ useUserPermissions: vi.fn() }));
vi.mock('@/hooks/useMediaQuery', () => ({ useMediaQuery: () => false }));
vi.mock('./components/InstallAppointmentDialog', () => ({
  InstallAppointmentDialog: (p: { mode: string; appointmentId?: string }) => (
    <div role="dialog" aria-label="visit dialog">{p.mode}:{p.appointmentId ?? ''}</div>
  ),
}));
vi.mock('@/services/installScheduleService', () => ({
  installScheduleService: { getFeed: vi.fn(), getCrewOptions: vi.fn() },
}));

import InstallSchedulePage from './InstallSchedulePage';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { installScheduleService } from '@/services/installScheduleService';
import { rangeFor } from '@/lib/plannerCalendar';
import type { Appointment } from '@/types/installSchedule';

const ANCHOR = '2099-03-04';
const WEEK = rangeFor('week', ANCHOR);
const svc = vi.mocked(installScheduleService);

const visit: Appointment = {
  id: 'a1', fabricationJobId: 'j1', jobNumber: 'FJ-1042', customerName: 'Acme', siteCity: 'Austin',
  visitType: 'install', status: 'scheduled', startsAt: '', endsAt: '',
  startLocal: '2099-03-03T08:00', endLocal: '2099-03-03T12:00', timezone: 'America/Chicago',
  allDay: false, localStartDate: '2099-03-03', localEndDate: '2099-03-03',
  crew: [{ employeeId: 12, name: 'Sam Lee', role: 'lead' }], notes: '', cancelReason: null, version: 1,
};

function Probe() {
  const { search } = useLocation();
  return <span data-testid="search">{search}</span>;
}

function setPermissions(grants: string[] | 'all' = 'all') {
  vi.mocked(useUserPermissions).mockReturnValue({
    grants: [], isLoading: false, isSuperAdmin: false, activeRoleId: '',
    hasPermission: (r: string, a: string) => grants === 'all' || grants.includes(`${r}:${a}`),
  } as ReturnType<typeof useUserPermissions>);
}

function renderPage(search = `?date=${ANCHOR}`) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/calendar/install-schedule${search}`]}>
        <InstallSchedulePage />
        <Probe />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  setPermissions('all');
  svc.getFeed.mockResolvedValue({ appointments: [], truncated: false, timezone: 'America/Chicago' });
  svc.getCrewOptions.mockResolvedValue([{ employeeId: 12, name: 'Sam Lee', hasLogin: true }]);
});

describe('InstallSchedulePage', () => {
  it('shows a spinner while loading', () => {
    svc.getFeed.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByText('Loading schedule…')).toBeInTheDocument();
  });

  it('asks for the week around the date and shows the empty copy', async () => {
    renderPage();
    expect(await screen.findByText('No visits booked in this view.')).toBeInTheDocument();
    expect(svc.getFeed).toHaveBeenCalledWith(expect.objectContaining({ from: WEEK.from, to: WEEK.to, employeeId: null }));
  });

  it('shows the error with Try again, which refetches', async () => {
    svc.getFeed.mockRejectedValueOnce(new Error('boom'));
    const user = userEvent.setup();
    renderPage();
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(svc.getFeed).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('No visits booked in this view.')).toBeInTheDocument();
  });

  it('shows the truncated banner', async () => {
    svc.getFeed.mockResolvedValue({ appointments: [], truncated: true, timezone: '' });
    renderPage();
    expect(await screen.findByText(/Only the first part of this window is shown/)).toBeInTheDocument();
  });

  it('counts the visits and draws them as chips', async () => {
    svc.getFeed.mockResolvedValue({ appointments: [visit], truncated: false, timezone: 'America/Chicago' });
    renderPage();
    expect(await screen.findByRole('button', { name: /FJ-1042, Acme/ })).toBeInTheDocument();
    await waitFor(() => expect(document.querySelector('[aria-live="polite"]')).toHaveTextContent('1 visit in this view'));
  });

  it('writes the crew filter to the URL and refetches for that person', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('No visits booked in this view.');
    await screen.findByRole('option', { name: 'Sam Lee' });
    await user.selectOptions(screen.getByLabelText('Crew'), '12');
    expect(screen.getByTestId('search').textContent).toContain('crew=12');
    await waitFor(() => expect(svc.getFeed).toHaveBeenLastCalledWith(expect.objectContaining({ employeeId: 12 })));
  });

  it('opens the dialog from the New visit button and from ?appointment=', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'New visit' }));
    expect(await screen.findByRole('dialog', { name: 'visit dialog' })).toHaveTextContent('create:');
    expect(screen.getByTestId('search').textContent).toContain('appointment=new');
  });

  it('opens the edit dialog for ?appointment=<id>', async () => {
    renderPage(`?date=${ANCHOR}&appointment=a1`);
    expect(await screen.findByRole('dialog', { name: 'visit dialog' })).toHaveTextContent('edit:a1');
  });

  it('hides New visit without install_appointment:create', async () => {
    setPermissions(['install_appointment:read']);
    renderPage();
    await screen.findByText('No visits booked in this view.');
    expect(screen.queryByRole('button', { name: 'New visit' })).not.toBeInTheDocument();
  });
});
