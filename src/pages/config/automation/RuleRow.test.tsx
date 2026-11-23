import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { makeArDunning, makeRule } from '@/test/automationFixtures';
import type { AutomationRule } from '@/types/automationRule';

vi.mock('@/services/automationRuleService', () => ({
  automationRuleService: { setEnabled: vi.fn() },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { RuleRow } from './RuleRow';
import { automationRuleService } from '@/services/automationRuleService';
import { toast } from 'sonner';

const onPreview = vi.fn();

function renderRow(rule: AutomationRule, canConfigure = true): void {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ul>
          <RuleRow rule={rule} canConfigure={canConfigure} notSending={false} onPreview={onPreview} />
        </ul>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('RuleRow confirm flows', () => {
  it('turning off an external rule confirms, then sends {enabled:false}', async () => {
    vi.mocked(automationRuleService.setEnabled).mockResolvedValue(makeArDunning({ enabled: false }));
    renderRow(makeArDunning());
    await userEvent.click(screen.getByRole('switch', { name: 'Invoice payment reminders' }));

    expect(await screen.findByText('Turn off Invoice payment reminders?')).toBeInTheDocument();
    expect(screen.getByText('Reminders already planned and not yet sent will be cancelled.')).toBeInTheDocument();
    expect(automationRuleService.setEnabled).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Turn off' }));
    await waitFor(() => expect(automationRuleService.setEnabled).toHaveBeenCalledWith('ar_dunning', false));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Invoice payment reminders turned off'));
  });

  it('cancel sends nothing', async () => {
    renderRow(makeArDunning());
    await userEvent.click(screen.getByRole('switch', { name: 'Invoice payment reminders' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
    expect(automationRuleService.setEnabled).not.toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('turning on confirms with the start-from-today copy and offers Preview', async () => {
    renderRow(makeArDunning({ enabled: false, enabledAt: null }));
    await userEvent.click(screen.getByRole('switch', { name: 'Invoice payment reminders' }));
    expect(
      await screen.findByText(
        'Reminders start from today. Invoices that were already overdue will not receive past reminders.',
      ),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Preview who will be emailed' }));
    expect(onPreview).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('turning off an internal rule needs no confirmation', async () => {
    vi.mocked(automationRuleService.setEnabled).mockResolvedValue(makeRule({ enabled: false }));
    renderRow(makeRule());
    await userEvent.click(screen.getByRole('switch', { name: 'Quote expiry reminders' }));
    await waitFor(() => expect(automationRuleService.setEnabled).toHaveBeenCalledWith('quote_expiry', false));
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('a failed update shows an error toast and the switch stays on', async () => {
    vi.mocked(automationRuleService.setEnabled).mockRejectedValue(new Error('500'));
    renderRow(makeArDunning());
    const sw = screen.getByRole('switch', { name: 'Invoice payment reminders' });
    await userEvent.click(sw);
    await userEvent.click(await screen.findByRole('button', { name: 'Turn off' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(sw).toBeChecked();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('without configure permission the switch is disabled and explains why', () => {
    renderRow(makeArDunning(), false);
    const sw = screen.getByRole('switch', { name: 'Invoice payment reminders' });
    expect(sw).toBeDisabled();
    expect(sw.parentElement).toHaveAttribute('title', 'You need permission to configure automation.');
  });
});
