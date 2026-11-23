import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/hooks/useUserPermissions', () => ({ useUserPermissions: vi.fn() }));

import ConfigHomePage from './ConfigHomePage';
import { useUserPermissions } from '@/hooks/useUserPermissions';

function renderAs(...grants: string[]): void {
  vi.mocked(useUserPermissions).mockReturnValue({
    hasPermission: (resource: string, action: string) => grants.includes(`${resource}:${action}`),
  } as unknown as ReturnType<typeof useUserPermissions>);
  render(
    <MemoryRouter>
      <ConfigHomePage />
    </MemoryRouter>,
  );
}

describe('ConfigHomePage Automation card', () => {
  it('shows for users who can read automation', () => {
    renderAs('automation:read');
    expect(screen.getByRole('link', { name: /Automation/ })).toHaveAttribute('href', '/config/automation');
  });

  it('is hidden without automation:read', () => {
    renderAs();
    expect(screen.queryByRole('link', { name: /Automation/ })).toBeNull();
  });
});
