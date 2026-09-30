import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';

import { AuthNotice } from './AuthNotice';
import { setAuthNotice, peekAuthNotice, clearAuthNotice } from '@/lib/authNotice';

const MESSAGE = 'This workspace is suspended. Please contact your account administrator.';

describe('AuthNotice', () => {
  beforeEach(() => clearAuthNotice());
  afterEach(() => clearAuthNotice());

  it('shows why the user was signed out', () => {
    setAuthNotice(MESSAGE);

    render(<AuthNotice />);

    expect(screen.getByRole('alert')).toHaveTextContent(MESSAGE);
  });

  it('shows it once: the stored notice is gone after it has been displayed', () => {
    setAuthNotice(MESSAGE);

    const { unmount } = render(<AuthNotice />);
    expect(peekAuthNotice()).toBeNull();

    unmount();
    render(<AuthNotice />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('renders nothing when there is no notice', () => {
    const { container } = render(<AuthNotice />);

    expect(container).toBeEmptyDOMElement();
  });
});
