import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { AIStatus } from '@/types/ai';

vi.mock('@/services/aiService', () => ({
  getAIStatus: vi.fn(),
  setTenantAIEnabled: vi.fn(),
}));

const hasPermission = vi.fn<(resource: string, action: string) => boolean>();
vi.mock('@/hooks/useUserPermissions', () => ({
  useUserPermissions: () => ({ hasPermission, grants: [], isLoading: false, activeRoleId: '' }),
}));

import AIAssistantConfigPage from './AIAssistantConfigPage';
import { getAIStatus, setTenantAIEnabled } from '@/services/aiService';

const SWITCH_NAME = 'Enable StoneSuite Assistant for your organization';
const PLATFORM_OFF_TEXT =
  'The assistant is turned off for all organizations by the StoneSuite platform administrator.';

function status(overrides: Partial<AIStatus> = {}): AIStatus {
  return { platformEnabled: true, tenantEnabled: true, available: true, ...overrides };
}

function renderPage(): QueryClient {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <AIAssistantConfigPage />
    </QueryClientProvider>,
  );
  return client;
}

beforeEach(() => {
  vi.clearAllMocks();
  hasPermission.mockReturnValue(true);
});

describe('AIAssistantConfigPage', () => {
  it('reflects the tenant switch and describes what turning it off does', async () => {
    vi.mocked(getAIStatus).mockResolvedValue(status({ tenantEnabled: true }));
    renderPage();

    expect(await screen.findByRole('switch', { name: SWITCH_NAME })).toBeChecked();
    expect(screen.getByText(/does not delete any conversation history or indexed data/)).toBeInTheDocument();
    expect(screen.queryByText(PLATFORM_OFF_TEXT)).not.toBeInTheDocument();
  });

  it('saves the toggle and writes the returned status into the ai-status cache', async () => {
    const user = userEvent.setup();
    vi.mocked(getAIStatus).mockResolvedValue(status({ tenantEnabled: true }));
    vi.mocked(setTenantAIEnabled).mockResolvedValue(status({ tenantEnabled: false, available: false }));
    const client = renderPage();

    await user.click(await screen.findByRole('switch', { name: SWITCH_NAME }));

    await waitFor(() => expect(setTenantAIEnabled).toHaveBeenCalledWith(false));
    await waitFor(() =>
      expect(client.getQueryData(['ai-status'])).toEqual(status({ tenantEnabled: false, available: false })),
    );
    expect(await screen.findByRole('switch', { name: SWITCH_NAME })).not.toBeChecked();
  });

  it('disables the switch and explains why when the platform has the assistant off', async () => {
    const user = userEvent.setup();
    vi.mocked(getAIStatus).mockResolvedValue(status({ platformEnabled: false, available: false }));
    renderPage();

    const toggle = await screen.findByRole('switch', { name: SWITCH_NAME });
    expect(toggle).toBeDisabled();
    expect(screen.getByText(PLATFORM_OFF_TEXT)).toBeInTheDocument();

    await user.click(toggle);
    expect(setTenantAIEnabled).not.toHaveBeenCalled();
  });

  it('disables the switch for a caller without company-profile configure', async () => {
    hasPermission.mockImplementation((resource, action) => !(resource === 'company_profile' && action === 'configure'));
    vi.mocked(getAIStatus).mockResolvedValue(status());
    renderPage();

    expect(await screen.findByRole('switch', { name: SWITCH_NAME })).toBeDisabled();
  });

  it('shows the server message when saving fails', async () => {
    const user = userEvent.setup();
    vi.mocked(getAIStatus).mockResolvedValue(status());
    vi.mocked(setTenantAIEnabled).mockRejectedValue(new Error('save failed'));
    renderPage();

    await user.click(await screen.findByRole('switch', { name: SWITCH_NAME }));

    expect(await screen.findByText('save failed')).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: SWITCH_NAME })).toBeChecked();
  });
});
