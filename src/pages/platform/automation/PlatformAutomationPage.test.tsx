import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PlatformAutomationSettings } from '@/types/ai';

vi.mock('@/services/platformAutomationService', () => ({
  getPlatformAutomation: vi.fn(),
  setPlatformAutomationEnabled: vi.fn(),
}));

import PlatformAutomationPage from './PlatformAutomationPage';
import { getPlatformAutomation, setPlatformAutomationEnabled } from '@/services/platformAutomationService';

const SWITCH_NAME = 'Automation scheduler (all organizations)';

function settings(overrides: Partial<PlatformAutomationSettings> = {}): PlatformAutomationSettings {
  return { enabled: false, kvConfigured: true, kvSynced: undefined, message: 'scope message', ...overrides };
}

function renderPage(): void {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <PlatformAutomationPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('PlatformAutomationPage', () => {
  it('shows the switch off by default', async () => {
    vi.mocked(getPlatformAutomation).mockResolvedValue(settings());
    renderPage();
    const sw = await screen.findByRole('switch', { name: SWITCH_NAME });
    expect(sw).toHaveAttribute('aria-checked', 'false');
  });

  it('asks for confirmation before turning on, and does nothing on cancel', async () => {
    vi.mocked(getPlatformAutomation).mockResolvedValue(settings());
    renderPage();
    await userEvent.click(await screen.findByRole('switch', { name: SWITCH_NAME }));
    expect(await screen.findByText('Turn on the automation scheduler?')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(setPlatformAutomationEnabled).not.toHaveBeenCalled();
  });

  it('turns on after confirming', async () => {
    vi.mocked(getPlatformAutomation).mockResolvedValue(settings());
    vi.mocked(setPlatformAutomationEnabled).mockResolvedValue(settings({ enabled: true, kvSynced: true }));
    renderPage();
    await userEvent.click(await screen.findByRole('switch', { name: SWITCH_NAME }));
    await userEvent.click(await screen.findByRole('button', { name: 'Turn on for everyone' }));
    await waitFor(() => expect(setPlatformAutomationEnabled).toHaveBeenCalledWith(true));
    await waitFor(() =>
      expect(screen.getByRole('switch', { name: SWITCH_NAME })).toHaveAttribute('aria-checked', 'true'),
    );
  });

  it('turns off immediately without a dialog', async () => {
    vi.mocked(getPlatformAutomation).mockResolvedValue(settings({ enabled: true }));
    vi.mocked(setPlatformAutomationEnabled).mockResolvedValue(settings({ enabled: false }));
    renderPage();
    await userEvent.click(await screen.findByRole('switch', { name: SWITCH_NAME }));
    await waitFor(() => expect(setPlatformAutomationEnabled).toHaveBeenCalledWith(false));
    expect(screen.queryByText('Turn on the automation scheduler?')).not.toBeInTheDocument();
  });

  it('offers a re-sync when the Cloudflare mirror failed', async () => {
    vi.mocked(getPlatformAutomation).mockResolvedValue(settings({ enabled: true, kvSynced: false }));
    vi.mocked(setPlatformAutomationEnabled).mockResolvedValue(settings({ enabled: true, kvSynced: true }));
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Retry sync' }));
    await waitFor(() => expect(setPlatformAutomationEnabled).toHaveBeenCalledWith(true));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Retry sync' })).not.toBeInTheDocument());
  });
});
