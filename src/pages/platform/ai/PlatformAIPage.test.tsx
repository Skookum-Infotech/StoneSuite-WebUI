import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PlatformAISettings } from '@/types/ai';

vi.mock('@/services/aiService', () => ({
  getPlatformAISettings: vi.fn(),
  setPlatformAIEnabled: vi.fn(),
}));

import PlatformAIPage from './PlatformAIPage';
import { getPlatformAISettings, setPlatformAIEnabled } from '@/services/aiService';

const SWITCH_NAME = 'StoneSuite Assistant (all organizations)';

function settings(overrides: Partial<PlatformAISettings> = {}): PlatformAISettings {
  return {
    enabled: true,
    updatedAt: null,
    updatedBy: null,
    helpCorpusSyncedAt: null,
    ...overrides,
  };
}

function renderPage(): QueryClient {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <PlatformAIPage />
    </QueryClientProvider>,
  );
  return client;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('PlatformAIPage state rendering', () => {
  it.each([
    ['started', 'Running'],
    ['stopped', 'Stopped'],
    ['mixed', 'Partially running'],
    ['unknown', 'Unknown'],
    [undefined, 'Unknown'],
  ] as const)('maps ollamaState %s to "%s"', async (ollamaState, label) => {
    vi.mocked(getPlatformAISettings).mockResolvedValue(settings({ ollamaState }));
    renderPage();

    await screen.findByRole('switch', { name: SWITCH_NAME });
    const dt = screen.getByText('AI server');
    expect(within(dt.parentElement as HTMLElement).getByText(label)).toBeInTheDocument();
  });

  it('shows who last changed it, when, and the help sync time', async () => {
    vi.mocked(getPlatformAISettings).mockResolvedValue(
      settings({
        updatedAt: '2026-09-01T12:30:00Z',
        updatedBy: 'admin@stonesuite.local',
        helpCorpusSyncedAt: '2026-09-02T08:15:00Z',
      }),
    );
    renderPage();

    expect(await screen.findByText('admin@stonesuite.local')).toBeInTheDocument();
    expect(screen.getByText('Help content last synced')).toBeInTheDocument();
    // Null timestamps render as an em dash; these two are real dates.
    expect(screen.queryAllByText('—')).toHaveLength(0);
  });

  it('shows em dashes for a never-changed, never-synced switch', async () => {
    vi.mocked(getPlatformAISettings).mockResolvedValue(settings());
    renderPage();

    await screen.findByRole('switch', { name: SWITCH_NAME });
    expect(screen.getAllByText('—')).toHaveLength(3);
  });

  it('lists other lease holders only when there are any', async () => {
    vi.mocked(getPlatformAISettings).mockResolvedValue(settings({ leaseHolders: ['tenant-a', 'tenant-b'] }));
    renderPage();

    expect(await screen.findByText('Also in use by: tenant-a, tenant-b')).toBeInTheDocument();
  });

  it('omits the lease holders line when the list is empty', async () => {
    vi.mocked(getPlatformAISettings).mockResolvedValue(settings({ leaseHolders: [] }));
    renderPage();

    await screen.findByRole('switch', { name: SWITCH_NAME });
    expect(screen.queryByText(/Also in use by/)).not.toBeInTheDocument();
  });
});

describe('PlatformAIPage master switch', () => {
  it('asks for confirmation before turning off, and does nothing on Cancel', async () => {
    const user = userEvent.setup();
    vi.mocked(getPlatformAISettings).mockResolvedValue(settings({ enabled: true }));
    renderPage();

    await user.click(await screen.findByRole('switch', { name: SWITCH_NAME }));

    const dialog = screen.getByRole('dialog', { name: 'Turn off the StoneSuite Assistant?' });
    expect(dialog).toHaveTextContent('stops the AI server and disables the assistant for every organization');
    expect(setPlatformAIEnabled).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(setPlatformAIEnabled).not.toHaveBeenCalled();
    expect(screen.getByRole('switch', { name: SWITCH_NAME })).toBeChecked();
  });

  it('turns off after confirming, updates the cache, and refreshes ai-status', async () => {
    const user = userEvent.setup();
    vi.mocked(getPlatformAISettings).mockResolvedValue(settings({ enabled: true }));
    vi.mocked(setPlatformAIEnabled).mockResolvedValue(settings({ enabled: false, ollamaState: 'stopped' }));
    const client = renderPage();
    const invalidate = vi.spyOn(client, 'invalidateQueries');

    await user.click(await screen.findByRole('switch', { name: SWITCH_NAME }));
    await user.click(screen.getByRole('button', { name: 'Turn off for everyone' }));

    await waitFor(() => expect(setPlatformAIEnabled).toHaveBeenCalledWith(false));
    await waitFor(() => expect(screen.getByRole('switch', { name: SWITCH_NAME })).not.toBeChecked());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['ai-status'] });
  });

  it('turns on immediately, with no confirmation', async () => {
    const user = userEvent.setup();
    vi.mocked(getPlatformAISettings).mockResolvedValue(settings({ enabled: false }));
    vi.mocked(setPlatformAIEnabled).mockResolvedValue(settings({ enabled: true }));
    renderPage();

    await user.click(await screen.findByRole('switch', { name: SWITCH_NAME }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(setPlatformAIEnabled).toHaveBeenCalledWith(true));
  });
});
