import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

vi.mock('@/services/companyProfileService', () => ({
  companyProfileService: { get: vi.fn(), update: vi.fn() },
}));
vi.mock('@/hooks/useUserPermissions', () => ({ useUserPermissions: vi.fn() }));

import { CompanyPreferencesTab } from './CompanyPreferencesTab';
import { companyProfileService } from '@/services/companyProfileService';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import type { CompanyProfile } from '@/types/companyProfile';

const EMPTY_ADDRESS = { line1: '', line2: '', suite: '', city: '', country: '', state: '', zip: '' };

const BASE_PROFILE: CompanyProfile = {
  companyName: 'Acme Stone Co.',
  legalName: '',
  industry: '',
  website: '',
  country: '',
  currency: '',
  timezone: '',
  taxId: '',
  fabricationPercent: 20,
  billingAddress: EMPTY_ADDRESS,
  shippingAddress: EMPTY_ADDRESS,
  returnAddress: EMPTY_ADDRESS,
};

function renderTab() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  // Appended to the document (not just created) — the actions are portaled
  // into it, and screen queries only see what's actually in the document.
  const actionsSlot = document.body.appendChild(document.createElement('div'));
  return render(<CompanyPreferencesTab actionsSlot={actionsSlot} />, { wrapper });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useUserPermissions).mockReturnValue({
    grants: [], isLoading: false, activeRoleId: '', isSuperAdmin: false, hasPermission: () => true,
  } as ReturnType<typeof useUserPermissions>);
});

describe('CompanyPreferencesTab', () => {
  it('shows the stored fabrication percentage in view mode', async () => {
    vi.mocked(companyProfileService.get).mockResolvedValue({ ...BASE_PROFILE, logoUrl: '' });
    renderTab();

    expect(await screen.findByText('20%')).toBeInTheDocument();
  });

  it('saves a new percentage, sending it with the rest of the stored profile', async () => {
    const user = userEvent.setup();
    vi.mocked(companyProfileService.get).mockResolvedValue({ ...BASE_PROFILE, logoUrl: '' });
    vi.mocked(companyProfileService.update).mockResolvedValue({ ...BASE_PROFILE, fabricationPercent: 15 });
    renderTab();

    await user.click(await screen.findByRole('button', { name: 'Edit company preferences' }));
    const input = screen.getByRole('spinbutton', { name: 'Fabrication Percentage' });
    await user.clear(input);
    await user.type(input, '15');
    await user.click(screen.getByRole('button', { name: 'Save company preferences' }));

    await waitFor(() => {
      expect(companyProfileService.update).toHaveBeenCalledWith({ ...BASE_PROFILE, fabricationPercent: 15 });
    });
    expect(await screen.findByText('15%')).toBeInTheDocument();
  });

  it('hides Edit for a view-only user', async () => {
    vi.mocked(useUserPermissions).mockReturnValue({
      grants: [], isLoading: false, activeRoleId: '', isSuperAdmin: false, hasPermission: () => false,
    } as ReturnType<typeof useUserPermissions>);
    vi.mocked(companyProfileService.get).mockResolvedValue({ ...BASE_PROFILE, logoUrl: '' });
    renderTab();

    expect(await screen.findByText('20%')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit company preferences' })).not.toBeInTheDocument();
    expect(screen.getByText('View-only access')).toBeInTheDocument();
  });
});
