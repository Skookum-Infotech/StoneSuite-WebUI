import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/hooks/useUserPermissions', () => ({ useUserPermissions: vi.fn() }));

import { CustomerLink } from './CustomerLink';
import { useUserPermissions } from '@/hooks/useUserPermissions';

function allow(can: boolean) {
  vi.mocked(useUserPermissions).mockReturnValue({
    hasPermission: (r: string, a: string) => can && r === 'customer' && a === 'read',
  } as unknown as ReturnType<typeof useUserPermissions>);
}

describe('CustomerLink', () => {
  beforeEach(() => vi.clearAllMocks());

  it('links to the customer page with permission', () => {
    allow(true);
    render(<MemoryRouter><CustomerLink id="c-1" name="Fontaine" /></MemoryRouter>);
    const link = screen.getByRole('link', { name: 'View customer Fontaine' });
    expect(link).toHaveAttribute('href', '/crm/customer/c-1');
  });

  it('is plain text without permission', () => {
    allow(false);
    render(<MemoryRouter><CustomerLink id="c-1" name="Fontaine" /></MemoryRouter>);
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText('Fontaine')).toBeInTheDocument();
  });

  it.each([undefined, null, ''])('is plain text when id is %j', (id) => {
    allow(true);
    render(<MemoryRouter><CustomerLink id={id} name="Fontaine" /></MemoryRouter>);
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText('Fontaine')).toBeInTheDocument();
  });

  it('does not bubble the click to a clickable row', async () => {
    allow(true);
    const onRow = vi.fn();
    render(
      <MemoryRouter>
        <div onClick={onRow}><CustomerLink id="c-1" name="Fontaine" /></div>
      </MemoryRouter>,
    );
    await userEvent.setup().click(screen.getByRole('link'));
    expect(onRow).not.toHaveBeenCalled();
  });
});
