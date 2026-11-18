import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/services/inventoryUnitService', () => ({
  inventoryUnitService: { getPhotoUrl: vi.fn(), uploadPhoto: vi.fn(), deletePhoto: vi.fn() },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn() } }));

import { SlabPhotoCard } from './SlabPhotoCard';
import { inventoryUnitService } from '@/services/inventoryUnitService';

function renderCard(canEdit: boolean) {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
      <SlabPhotoCard unitId="u1" canEdit={canEdit} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('SlabPhotoCard', () => {
  it('offers Upload when the slab has no photo and the viewer may edit', async () => {
    vi.mocked(inventoryUnitService.getPhotoUrl).mockResolvedValue('');
    renderCard(true);

    expect(await screen.findByText('No photo yet.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Upload slab photo' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Remove slab photo' })).not.toBeInTheDocument();
  });

  it('shows the photo with Replace and Remove when there is one', async () => {
    vi.mocked(inventoryUnitService.getPhotoUrl).mockResolvedValue('https://r2.example/slab.jpg');
    renderCard(true);

    expect(await screen.findByAltText('Slab')).toHaveAttribute('src', 'https://r2.example/slab.jpg');
    expect(screen.getByRole('button', { name: 'Replace slab photo' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove slab photo' })).toBeInTheDocument();
  });

  it('is read-only for a viewer without update rights', async () => {
    vi.mocked(inventoryUnitService.getPhotoUrl).mockResolvedValue('https://r2.example/slab.jpg');
    renderCard(false);

    expect(await screen.findByAltText('Slab')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('uploads a chosen photo', async () => {
    vi.mocked(inventoryUnitService.getPhotoUrl).mockResolvedValue('');
    vi.mocked(inventoryUnitService.uploadPhoto).mockResolvedValue('https://r2.example/new.jpg');
    const user = userEvent.setup();
    renderCard(true);
    await screen.findByText('No photo yet.');

    const file = new File(['x'], 'slab.jpg', { type: 'image/jpeg' });
    await user.upload(screen.getByTestId('slab-photo-input'), file);

    await waitFor(() => expect(inventoryUnitService.uploadPhoto).toHaveBeenCalledWith('u1', file));
  });

  it('refuses a file that is not a JPG, PNG or WEBP without calling the server', async () => {
    vi.mocked(inventoryUnitService.getPhotoUrl).mockResolvedValue('');
    const user = userEvent.setup({ applyAccept: false });
    renderCard(true);
    await screen.findByText('No photo yet.');

    await user.upload(screen.getByTestId('slab-photo-input'), new File(['x'], 'slab.gif', { type: 'image/gif' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/JPG, PNG or WEBP/);
    expect(inventoryUnitService.uploadPhoto).not.toHaveBeenCalled();
  });

  it('removes the photo', async () => {
    vi.mocked(inventoryUnitService.getPhotoUrl).mockResolvedValue('https://r2.example/slab.jpg');
    vi.mocked(inventoryUnitService.deletePhoto).mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderCard(true);

    await user.click(await screen.findByRole('button', { name: 'Remove slab photo' }));

    await waitFor(() => expect(inventoryUnitService.deletePhoto).toHaveBeenCalledWith('u1'));
  });
});
