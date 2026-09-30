import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LocationCard } from './LocationCard';
import type { CompanyLocation } from '@/types/companyProfile';

const LOCATION: CompanyLocation = {
  id: 'loc-1', name: 'Main Yard', phone: '', isDefault: false,
  address: { line1: '1 Quarry Rd', line2: '', suite: '', city: 'Springfield', country: '', state: '', zip: '' },
};

const actions = () => ({ onEdit: vi.fn(), onDelete: vi.fn(), onSetDefault: vi.fn(), onAnnounce: vi.fn() });

describe('LocationCard', () => {
  it('is read-only by default: no Edit, Delete or Set-as-default controls', () => {
    render(<LocationCard location={LOCATION} />);

    expect(screen.getByRole('heading', { name: 'Main Yard' })).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('shows the actions to someone who can configure, and they call through', async () => {
    const a = actions();
    render(<LocationCard location={LOCATION} canConfigure isBusy={false} actions={a} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Edit Main Yard' }));
    await user.click(screen.getByRole('button', { name: 'Set Main Yard as default location' }));

    expect(a.onEdit).toHaveBeenCalledTimes(1);
    expect(a.onSetDefault).toHaveBeenCalledTimes(1);
  });

  it('asks for confirmation before deleting', async () => {
    const a = actions();
    render(<LocationCard location={LOCATION} canConfigure isBusy={false} actions={a} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Delete Main Yard' }));
    expect(a.onDelete).not.toHaveBeenCalled();
    expect(a.onAnnounce).toHaveBeenCalledWith('Confirm deleting Main Yard.');

    await user.click(screen.getByRole('button', { name: 'Confirm delete Main Yard' }));
    expect(a.onDelete).toHaveBeenCalledTimes(1);
  });
});
