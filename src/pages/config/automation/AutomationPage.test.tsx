import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { makeArDunning, makeRule, makeSettings } from '@/test/automationFixtures';

vi.mock('@/services/automationRuleService', () => ({
  automationRuleService: { list: vi.fn(), setEnabled: vi.fn(), preview: vi.fn() },
}));
vi.mock('@/services/automationSettingsService', () => ({
  automationSettingsService: { get: vi.fn(), setKillSwitch: vi.fn() },
}));
vi.mock('@/hooks/useUserPermissions', () => ({ useUserPermissions: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import AutomationPage from './AutomationPage';
import { automationRuleService } from '@/services/automationRuleService';
import { automationSettingsService } from '@/services/automationSettingsService';
import { useUserPermissions } from '@/hooks/useUserPermissions';

function allow(...grants: string[]): void {
  vi.mocked(useUserPermissions).mockReturnValue({
    hasPermission: (resource: string, action: string) => grants.includes(`${resource}:${action}`),
  } as unknown as ReturnType<typeof useUserPermissions>);
}

function renderPage(): void {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <AutomationPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const ANOMALY = makeRule({ ruleKey: 'anomaly_scan', name: 'Anomaly detection', cadence: [] });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(automationRuleService.list).mockResolvedValue([makeArDunning(), makeRule(), ANOMALY]);
  vi.mocked(automationSettingsService.get).mockResolvedValue(makeSettings());
});

describe('AutomationPage permissions', () => {
  it('read-only: lists every rule but every switch is disabled', async () => {
    allow('automation:read');
    renderPage();
    expect(await screen.findByText('Invoice payment reminders')).toBeInTheDocument();
    expect(screen.getByText('Quote expiry reminders')).toBeInTheDocument();
    await screen.findByRole('switch', { name: 'Pause all automated emails' });
    for (const sw of screen.getAllByRole('switch')) expect(sw).toBeDisabled();
  });

  it('configure: switches are enabled', async () => {
    allow('automation:read', 'automation:configure');
    renderPage();
    await screen.findByText('Invoice payment reminders');
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Pause all automated emails' })).toBeEnabled());
    expect(screen.getByRole('switch', { name: 'Invoice payment reminders' })).toBeEnabled();
  });
});

describe('AutomationPage rows', () => {
  it('renders copy, audience, cadence and status', async () => {
    allow('automation:read');
    renderPage();
    await screen.findByText('Invoice payment reminders');
    expect(screen.getByText('Emails customers')).toBeInTheDocument();
    expect(screen.getByText(/3 days before due date, On the due date, 7 days after due date/)).toBeInTheDocument();
    expect(screen.getByText('3 days before expiry')).toBeInTheDocument();
    expect(screen.getAllByText('Not run yet').length).toBeGreaterThan(0);
    expect(screen.getAllByText('On since Nov 2, 2026').length).toBeGreaterThan(0);
  });

  it('anomaly_scan links to the Anomalies page instead of a switch', async () => {
    allow('automation:read', 'automation:configure');
    renderPage();
    const link = await screen.findByRole('link', { name: 'Manage on Anomalies page' });
    expect(link).toHaveAttribute('href', '/anomalies');
    expect(screen.queryByRole('switch', { name: 'Anomaly detection' })).toBeNull();
  });

  it('shows Preview only for previewable rules and links to deliveries', async () => {
    allow('automation:read');
    renderPage();
    await screen.findByText('Quote expiry reminders');
    expect(screen.getAllByRole('button', { name: /^Preview / })).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'View deliveries for Quote expiry reminders' })).toHaveAttribute(
      'href',
      '/config/automation/deliveries?ruleKey=quote_expiry',
    );
  });

  it('shows the empty and error states', async () => {
    allow('automation:read');
    vi.mocked(automationRuleService.list).mockResolvedValueOnce([]);
    renderPage();
    expect(await screen.findByText('No automation rules are set up for this workspace.')).toBeInTheDocument();
  });

  it('shows an error with Retry', async () => {
    allow('automation:read');
    vi.mocked(automationRuleService.list).mockRejectedValueOnce(new Error('boom'));
    renderPage();
    const retry = await screen.findByRole('button', { name: 'Retry loading automation rules' });
    await userEvent.click(retry);
    expect(await screen.findByText('Invoice payment reminders')).toBeInTheDocument();
  });
});

describe('AutomationPage banners', () => {
  it.each([
    ['platform off', { platformEnabled: false }, /turned off for the whole platform/],
    ['paused', { killSwitch: true }, /All automated emails are paused for this workspace/],
    ['unknown', { platformEnabled: null }, /could not confirm whether the scheduler is running/],
  ])('%s', async (_name, override, text) => {
    allow('automation:read', 'automation:configure');
    vi.mocked(automationSettingsService.get).mockResolvedValue(makeSettings(override));
    renderPage();
    expect(await screen.findByText(text)).toBeInTheDocument();
  });

  it('no banner when automation is running', async () => {
    allow('automation:read');
    renderPage();
    await screen.findByText('Invoice payment reminders');
    await waitFor(() => expect(automationSettingsService.get).toHaveBeenCalled());
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('platform banner wins over paused, and enabled rules read "On (not sending)"', async () => {
    allow('automation:read');
    vi.mocked(automationSettingsService.get).mockResolvedValue(makeSettings({ platformEnabled: false, killSwitch: true }));
    renderPage();
    await screen.findByText(/turned off for the whole platform/);
    expect(screen.queryByText(/paused for this workspace/)).toBeNull();
    expect((await screen.findAllByText(/On \(not sending\)/)).length).toBe(2);
  });

  it('Resume turns the kill switch off (configure only)', async () => {
    allow('automation:read', 'automation:configure');
    vi.mocked(automationSettingsService.get).mockResolvedValue(makeSettings({ killSwitch: true }));
    vi.mocked(automationSettingsService.setKillSwitch).mockResolvedValue(makeSettings());
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Resume automated emails' }));
    await waitFor(() => expect(automationSettingsService.setKillSwitch).toHaveBeenCalledWith(false));
  });

  it('read-only users get no Resume button', async () => {
    allow('automation:read');
    vi.mocked(automationSettingsService.get).mockResolvedValue(makeSettings({ killSwitch: true }));
    renderPage();
    await screen.findByText(/paused for this workspace/);
    expect(screen.queryByRole('button', { name: 'Resume automated emails' })).toBeNull();
  });

  it('the pause switch calls the settings API', async () => {
    allow('automation:read', 'automation:configure');
    vi.mocked(automationSettingsService.setKillSwitch).mockResolvedValue(makeSettings({ killSwitch: true }));
    renderPage();
    const sw = await screen.findByRole('switch', { name: 'Pause all automated emails' });
    await waitFor(() => expect(sw).toBeEnabled());
    await userEvent.click(sw);
    await waitFor(() => expect(automationSettingsService.setKillSwitch).toHaveBeenCalledWith(true));
    expect(within(document.body).queryByRole('alertdialog')).toBeNull();
  });
});
