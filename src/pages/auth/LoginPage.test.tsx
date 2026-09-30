import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/services/samlAuthService', () => ({ samlAuthService: { initiateUrl: vi.fn() } }));
vi.mock('@/services/tenantServices', () => ({ userService: { listUsers: vi.fn() } }));
vi.mock('./components/EmailStep', () => ({ EmailStep: () => <div>email step</div> }));
vi.mock('./components/PasswordStep', () => ({ PasswordStep: () => <div>password step</div> }));
vi.mock('./components/LoginHero', () => ({ LoginHero: () => null }));

import LoginPage from './LoginPage';
import { setAuthNotice, clearAuthNotice } from '@/lib/authNotice';

const MESSAGE = 'This workspace is suspended. Please contact your account administrator.';

function renderPage(path = '/auth/login') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <LoginPage />
    </MemoryRouter>,
  );
}

describe('LoginPage — why the user is back here', () => {
  beforeEach(() => clearAuthNotice());
  afterEach(() => clearAuthNotice());

  it('tells a user who was signed out because their workspace was suspended', () => {
    setAuthNotice(MESSAGE);

    renderPage();

    expect(screen.getByRole('alert')).toHaveTextContent(MESSAGE);
    expect(screen.getByText('email step')).toBeInTheDocument();
  });

  it('shows no alert on an ordinary visit', () => {
    renderPage();

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('does not repeat the notice on the next visit', () => {
    setAuthNotice(MESSAGE);
    const first = renderPage();
    first.unmount();

    renderPage();

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
