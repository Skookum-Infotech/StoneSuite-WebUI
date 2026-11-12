import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';

vi.mock('@/api/client', () => ({ forceLogout: vi.fn() }));

import { forceLogout } from '@/api/client';
import { SessionReplacedOverlay } from './SessionReplacedOverlay';
import { SESSION_REPLACED_NOTICE } from '@/lib/singleSession';

describe('SessionReplacedOverlay', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('blocks the app, counts down from 0:30 and signs out at 0:00', () => {
    render(<SessionReplacedOverlay info={{ deviceLabel: 'Edge on Windows' }} />);

    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveTextContent('Your account was signed in on another computer (Edge on Windows)');
    expect(screen.getByRole('timer')).toHaveTextContent('0:30');

    for (let i = 0; i < 29; i += 1) act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByRole('timer')).toHaveTextContent('0:01');
    expect(forceLogout).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByRole('timer')).toHaveTextContent('0:00');
    expect(forceLogout).toHaveBeenCalledTimes(1);
    expect(forceLogout).toHaveBeenCalledWith(SESSION_REPLACED_NOTICE);
  });

  it('never counts past the server end of the handover', () => {
    render(<SessionReplacedOverlay info={{ endsAt: Date.now() + 10_000 }} />);
    expect(screen.getByRole('timer')).toHaveTextContent('0:10');
  });

  it('signs out at once from "Log out now", only once', () => {
    render(<SessionReplacedOverlay info={{}} />);
    const button = screen.getByRole('button', { name: 'Log out now' });
    expect(button).toHaveFocus();
    fireEvent.click(button);
    fireEvent.click(button);
    expect(forceLogout).toHaveBeenCalledTimes(1);
  });
});
