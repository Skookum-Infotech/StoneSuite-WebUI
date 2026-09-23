import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

vi.mock('@/services/companyProfileService', () => ({
  companyProfileService: { get: vi.fn(), uploadLogo: vi.fn(), deleteLogo: vi.fn() },
}));

import { CompanyLogoCard } from './CompanyLogoCard';
import { companyProfileService } from '@/services/companyProfileService';
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
  billingAddress: EMPTY_ADDRESS,
  shippingAddress: EMPTY_ADDRESS,
  returnAddress: EMPTY_ADDRESS,
};

function renderCard(canConfigure = true) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return render(<CompanyLogoCard canConfigure={canConfigure} />, { wrapper });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('CompanyLogoCard', () => {
  it('shows a placeholder and an Upload button when no logo is set', async () => {
    vi.mocked(companyProfileService.get).mockResolvedValue({ ...BASE_PROFILE, logoUrl: '' });
    renderCard();

    expect(await screen.findByRole('button', { name: 'Upload company logo' })).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: 'Company logo' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove company logo' })).not.toBeInTheDocument();
  });

  it('shows the logo image and Replace/Remove buttons once one is set', async () => {
    vi.mocked(companyProfileService.get).mockResolvedValue({
      ...BASE_PROFILE,
      logoUrl: 'https://r2.example.com/company/logo.png',
    });
    renderCard();

    expect(await screen.findByRole('img', { name: 'Company logo' })).toHaveAttribute(
      'src',
      'https://r2.example.com/company/logo.png',
    );
    expect(screen.getByRole('button', { name: 'Replace company logo' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove company logo' })).toBeInTheDocument();
  });

  it('hides upload/remove controls for a view-only user', async () => {
    vi.mocked(companyProfileService.get).mockResolvedValue({
      ...BASE_PROFILE,
      logoUrl: 'https://r2.example.com/company/logo.png',
    });
    renderCard(false);

    expect(await screen.findByText('Your company logo.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Replace company logo' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove company logo' })).not.toBeInTheDocument();
  });

  it('uploads a valid file', async () => {
    vi.mocked(companyProfileService.get).mockResolvedValue({ ...BASE_PROFILE, logoUrl: '' });
    vi.mocked(companyProfileService.uploadLogo).mockResolvedValue(undefined);
    const user = userEvent.setup();
    const { container } = renderCard();
    await screen.findByRole('button', { name: 'Upload company logo' });

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(fileInput, new File(['pixels'], 'logo.png', { type: 'image/png' }));

    await waitFor(() => expect(companyProfileService.uploadLogo).toHaveBeenCalledTimes(1));
    expect(screen.queryByText(/Logo must be/)).not.toBeInTheDocument();
  });

  it('rejects an invalid file client-side without calling the service', async () => {
    vi.mocked(companyProfileService.get).mockResolvedValue({ ...BASE_PROFILE, logoUrl: '' });
    // applyAccept: false — the input's accept="image/png,image/jpeg" already
    // stops a real OS file picker offering a PDF, but some pickers can still
    // be told to show "All Files"; this simulates that bypass so the test
    // actually exercises validateLogoFile as the defense-in-depth it's for.
    const user = userEvent.setup({ applyAccept: false });
    const { container } = renderCard();
    await screen.findByRole('button', { name: 'Upload company logo' });

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(fileInput, new File(['not an image'], 'notes.pdf', { type: 'application/pdf' }));

    expect(await screen.findByText('Logo must be a PNG, JPG, GIF, WEBP, or SVG image.')).toBeInTheDocument();
    expect(companyProfileService.uploadLogo).not.toHaveBeenCalled();
  });

  it('removes the logo', async () => {
    vi.mocked(companyProfileService.get).mockResolvedValue({
      ...BASE_PROFILE,
      logoUrl: 'https://r2.example.com/company/logo.png',
    });
    vi.mocked(companyProfileService.deleteLogo).mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderCard();

    await user.click(await screen.findByRole('button', { name: 'Remove company logo' }));

    await waitFor(() => expect(companyProfileService.deleteLogo).toHaveBeenCalledTimes(1));
  });
});
