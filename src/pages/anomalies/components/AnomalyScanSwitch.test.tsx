import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { AutomationRule } from '@/types/automationRule';

vi.mock('@/services/automationRuleService', () => ({
  automationRuleService: { list: vi.fn(), setEnabled: vi.fn() },
}));
vi.mock('@/hooks/useUserPermissions', () => ({ useUserPermissions: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { AnomalyScanSwitch } from './AnomalyScanSwitch';
import { automationRuleService } from '@/services/automationRuleService';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { toast } from 'sonner';

function rule(overrides: Partial<AutomationRule> = {}): AutomationRule {
  return {
    ruleKey: 'anomaly_scan',
    name: 'Anomaly detection',
    audience: 'internal',
    enabled: true,
    enabledAt: '2026-10-27T10:00:00Z',
    ...overrides,
  };
}

function allow(...grants: string[]): void {
  vi.mocked(useUserPermissions).mockReturnValue({
    hasPermission: (resource: string, action: string) => grants.includes(`${resource}:${action}`),
  } as unknown as ReturnType<typeof useUserPermissions>);
}

function renderSwitch(): void {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <AnomalyScanSwitch />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AnomalyScanSwitch', () => {
  it('shows nothing, and asks for nothing, without automation:read', () => {
    allow();
    renderSwitch();
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    expect(automationRuleService.list).not.toHaveBeenCalled();
  });

  it('shows nothing when the workspace has no anomaly_scan rule', async () => {
    allow('automation:read');
    vi.mocked(automationRuleService.list).mockResolvedValue([rule({ ruleKey: 'ar_dunning' })]);
    renderSwitch();
    await waitFor(() => expect(automationRuleService.list).toHaveBeenCalled());
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
  });

  it('is read-only without automation:configure', async () => {
    allow('automation:read');
    vi.mocked(automationRuleService.list).mockResolvedValue([rule()]);
    renderSwitch();
    const toggle = await screen.findByRole('switch', { name: 'Anomaly scanning' });
    expect(toggle).toBeChecked();
    expect(toggle).toBeDisabled();
    expect(screen.getByText('On — checked every 15 minutes')).toBeInTheDocument();
  });

  it('turns scanning off for the whole workspace', async () => {
    allow('automation:read', 'automation:configure');
    vi.mocked(automationRuleService.list).mockResolvedValue([rule()]);
    vi.mocked(automationRuleService.setEnabled).mockResolvedValue(rule({ enabled: false }));
    renderSwitch();
    await userEvent.click(await screen.findByRole('switch', { name: 'Anomaly scanning' }));
    await waitFor(() => expect(automationRuleService.setEnabled).toHaveBeenCalledWith('anomaly_scan', false));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Anomaly scanning turned off'));
  });

  it('reports a failed change', async () => {
    allow('automation:read', 'automation:configure');
    vi.mocked(automationRuleService.list).mockResolvedValue([rule({ enabled: false })]);
    vi.mocked(automationRuleService.setEnabled).mockRejectedValue(new Error('boom'));
    renderSwitch();
    await userEvent.click(await screen.findByRole('switch', { name: 'Anomaly scanning' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(screen.getByText('Off — nothing is checked or sent')).toBeInTheDocument();
  });
});
