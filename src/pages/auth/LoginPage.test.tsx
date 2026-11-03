import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/services/samlAuthService', () => ({ samlAuthService: { initiateUrl: vi.fn() } }));
vi.mock('@/services/tenantServices', () => ({ userService: { listUsers: vi.fn() } }));
vi.mock('./components/EmailStep', () => ({
  EmailStep: ({ onIdentified }: { onIdentified: (email: string, result: { method: 'password' }) => void }) => (
    <button onClick={() => onIdentified('jane@acme.com', { method: 'password' })}>email step</button>
  ),
}));
vi.mock('./components/PasswordStep', () => ({
  PasswordStep: ({ onMfaRequired }: { onMfaRequired: (challenge: unknown) => void }) => (
    <button
      onClick={() =>
        onMfaRequired({
          success: true,
          challengeToken: 'chal-1',
          maskedEmail: 'j•••@acme.com',
          codeLength: 6,
          expiresInSeconds: 600,
          resendAfterSeconds: 60,
        })
      }
    >
      password step
    </button>
  ),
}));
vi.mock('./components/CodeStep', () => ({
  CodeStep: ({ challenge, onBack }: { challenge: { maskedEmail: string }; onBack: () => void }) => (
    <div>
      code step for {challenge.maskedEmail}
      <button onClick={onBack}>code step back</button>
    </div>
  ),
}));
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

describe('LoginPage — two-step verification', () => {
  beforeEach(() => clearAuthNotice());

  async function reachCodeStep(user: ReturnType<typeof userEvent.setup>) {
    renderPage();
    await user.click(screen.getByText('email step'));
    await user.click(screen.getByText('password step'));
  }

  it('shows the code step once the password step reports a code was emailed', async () => {
    const user = userEvent.setup();

    await reachCodeStep(user);

    expect(screen.getByText('code step for j•••@acme.com')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Check your email' })).toBeInTheDocument();
    expect(screen.queryByText('password step')).not.toBeInTheDocument();
  });

  it('goes back to the password step, not the email step, from the code step', async () => {
    const user = userEvent.setup();
    await reachCodeStep(user);

    await user.click(screen.getByText('code step back'));

    expect(screen.getByText('password step')).toBeInTheDocument();
    expect(screen.queryByText(/code step for/)).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
  });
});
