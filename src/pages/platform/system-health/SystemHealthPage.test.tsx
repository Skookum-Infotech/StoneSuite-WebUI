import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { HealthSnapshot, SystemHealthResponse } from '@/types/systemHealth';

vi.mock('@/services/platformSystemHealthService', () => ({
  getSystemHealth: vi.fn(),
}));

import SystemHealthPage from './SystemHealthPage';
import { getSystemHealth } from '@/services/platformSystemHealthService';

const NOW = new Date('2026-11-25T14:30:00Z');

function snapshot(overrides: Partial<HealthSnapshot> = {}): HealthSnapshot {
  return {
    version: 1,
    checkedAt: '2026-11-25T14:00:00.000Z',
    sites: [{ url: 'https://dev.stonesuite.app', ok: true, status: 200, ms: 140 }],
    apps: [
      {
        app: 'dev-stonesuite-api',
        machines: [{ id: '48e61edf200228', state: 'stopped', region: 'iad', crashing: true, lastExit: { code: 1, oomKilled: false, requestedStop: false, restarts: 10, at: '2026-11-25T13:59:00Z' } }],
        crashing: true, awakeHours24h: 10.6, wakes24h: 95, errors5xx24h: 0,
      },
    ],
    databases: [
      {
        id: 'holy-math', name: 'dev-stonesuite-db', plan: 'free', level: 'exceeded',
        compute: { used: 110.36, limit: 100, percent: 110.4 },
        storage: { used: 0.232, limit: 0.5, percent: 46.4 },
        transfer: { used: 0.669, limit: 5, percent: 13.4 },
        periodEnd: '2026-12-01T00:00:00Z', lastActiveAt: '2026-11-24T06:00:00Z',
      },
    ],
    sourceErrors: [],
    problems: [
      { key: 'neon:holy-math:compute:exceeded', severity: 'critical', title: 'Neon dev-stonesuite-db is over its compute limit (110.4%)', detail: '110.36 of 100 CU-hours.' },
      { key: 'fly:dev-stonesuite-api:awake', severity: 'warning', title: 'dev-stonesuite-api was awake 10.6 h in the last 24 h', detail: 'about every 15 minutes' },
    ],
    ...overrides,
  };
}

function renderWith(resp: SystemHealthResponse): void {
  vi.mocked(getSystemHealth).mockResolvedValue(resp);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <SystemHealthPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('SystemHealthPage', () => {
  it('shows problems, usage, apps and sites from the snapshot', async () => {
    renderWith({ configured: true, snapshot: snapshot() });
    expect(await screen.findByText('Neon dev-stonesuite-db is over its compute limit (110.4%)')).toBeInTheDocument();
    expect(screen.getByText('Last checked 30 min ago', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('Over limit')).toBeInTheDocument();
    expect(screen.getByText('110.36 / 100 CU-h (110.4%)')).toBeInTheDocument();
    expect(screen.getByRole('meter', { name: 'dev-stonesuite-db compute used' })).toHaveAttribute('value', '100');
    expect(screen.getByText('Crashing')).toBeInTheDocument();
    expect(screen.getByText('48e61edf200228: exit code 1, restart count 10')).toBeInTheDocument();
    expect(screen.getByText('every ~15 min')).toBeInTheDocument();
    expect(screen.getByText('Up · 200 in 140 ms')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('warns when the watchdog has stopped reporting', async () => {
    renderWith({ configured: true, snapshot: snapshot({ checkedAt: '2026-11-25T10:00:00.000Z', problems: [] }) });
    expect(await screen.findByRole('alert')).toHaveTextContent('has not reported for over two hours');
    expect(screen.getByText('No problems found.')).toBeInTheDocument();
  });

  it('explains when nothing is configured or no check has run yet', async () => {
    renderWith({ configured: false, snapshot: null, message: 'System health is not available: KV settings missing.' });
    expect(await screen.findByText('System health is not available: KV settings missing.')).toBeInTheDocument();
  });

  it('shows an error when the request fails', async () => {
    vi.mocked(getSystemHealth).mockRejectedValue(new Error('boom'));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <SystemHealthPage />
      </QueryClientProvider>,
    );
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });
});
