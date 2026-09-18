import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

vi.mock('@/services/companyProfileService', () => ({
  companyProfileService: {
    uploadLogo: vi.fn(),
    deleteLogo: vi.fn(),
  },
  MAX_LOGO_SIZE_BYTES: 2 * 1024 * 1024,
  ACCEPTED_LOGO_TYPES: ['image/png', 'image/jpeg'],
}));

import { CompanyLogoCard } from './CompanyLogoCard';
import { companyProfileService } from '@/services/companyProfileService';

function renderCard(props: { logoUrl?: string; canConfigure?: boolean } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return render(
    <CompanyLogoCard logoUrl={props.logoUrl ?? ''} canConfigure={props.canConfigure ?? true} />,
    { wrapper },
  );
}

function pngFile(name = 'logo.png', sizeBytes = 1024) {
  const file = new File([new Uint8Array(sizeBytes)], name, { type: 'image/png' });
  return file;
}

beforeEach(() => vi.clearAllMocks());

describe('CompanyLogoCard', () => {
  it('shows a placeholder when no logo is set', () => {
    renderCard({ logoUrl: '' });
    expect(screen.queryByAltText('Company logo')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Choose company logo file')).toBeInTheDocument();
  });

  it('shows the logo preview and a Remove button when a logo is set', () => {
    renderCard({ logoUrl: 'https://example.com/logo.png' });
    expect(screen.getByAltText('Company logo')).toHaveAttribute('src', 'https://example.com/logo.png');
    expect(screen.getByLabelText('Remove company logo')).toBeInTheDocument();
  });

  it('hides upload/remove controls when the caller lacks configure permission', () => {
    renderCard({ logoUrl: 'https://example.com/logo.png', canConfigure: false });
    expect(screen.queryByLabelText('Upload company logo')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Change company logo')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Remove company logo')).not.toBeInTheDocument();
  });

  it('uploads a valid PNG file', async () => {
    vi.mocked(companyProfileService.uploadLogo).mockResolvedValue(undefined);
    renderCard();
    const input = screen.getByLabelText('Choose company logo file') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [pngFile()] } });
    await waitFor(() => expect(companyProfileService.uploadLogo).toHaveBeenCalledTimes(1));
  });

  it('rejects a non-image file client-side without calling the service', async () => {
    renderCard();
    const input = screen.getByLabelText('Choose company logo file') as HTMLInputElement;
    const badFile = new File(['not an image'], 'notes.txt', { type: 'text/plain' });
    fireEvent.change(input, { target: { files: [badFile] } });
    expect(await screen.findByText('Logo must be a PNG or JPEG image.')).toBeInTheDocument();
    expect(companyProfileService.uploadLogo).not.toHaveBeenCalled();
  });

  it('rejects an oversize file client-side without calling the service', async () => {
    renderCard();
    const input = screen.getByLabelText('Choose company logo file') as HTMLInputElement;
    const bigFile = pngFile('big.png', 3 * 1024 * 1024);
    fireEvent.change(input, { target: { files: [bigFile] } });
    expect(await screen.findByText(/exceeds the 2MB limit/)).toBeInTheDocument();
    expect(companyProfileService.uploadLogo).not.toHaveBeenCalled();
  });

  it('removes the logo when Remove is clicked', async () => {
    vi.mocked(companyProfileService.deleteLogo).mockResolvedValue(undefined);
    renderCard({ logoUrl: 'https://example.com/logo.png' });
    fireEvent.click(screen.getByLabelText('Remove company logo'));
    await waitFor(() => expect(companyProfileService.deleteLogo).toHaveBeenCalledTimes(1));
  });

  it('shows an inline error when upload fails', async () => {
    vi.mocked(companyProfileService.uploadLogo).mockRejectedValue(new Error('Network error'));
    renderCard();
    const input = screen.getByLabelText('Choose company logo file') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [pngFile()] } });
    expect(await screen.findByText('Network error')).toBeInTheDocument();
  });
});
