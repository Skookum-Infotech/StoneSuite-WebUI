import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// Control the refresh outcome and observe the logout POST without pulling in
// apiClient's interceptors.
vi.mock('@/api/client', () => ({
  apiClient: { post: vi.fn(() => Promise.resolve({})) },
  attemptRefresh: vi.fn(),
  invalidateSession: vi.fn(),
  isRefreshInFlight: vi.fn(() => Promise.resolve(false)),
}));

const navigateMock = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
}));

import { useSessionTimer } from './useSessionTimer';
import { apiClient, attemptRefresh, invalidateSession, isRefreshInFlight, type RefreshOutcome } from '@/api/client';
import { useAuthStore } from '@/store/useAuthStore';

const refreshMock = vi.mocked(attemptRefresh);
const postMock = vi.mocked(apiClient.post);
const inFlightMock = vi.mocked(isRefreshInFlight);
const invalidateMock = vi.mocked(invalidateSession);

// Inside the 5-minute warning window, so the modal opens as soon as the hook mounts.
const MS_UNTIL_EXPIRY = 60_000;

function mountWithWarningOpen() {
  useAuthStore.setState({ sessionExpiresAt: Date.now() + MS_UNTIL_EXPIRY, isAuthenticated: true });
  const hook = renderHook(() => useSessionTimer());
  expect(hook.result.current.showWarning).toBe(true);
  return hook;
}

describe('useSessionTimer failsafe vs. Stay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  // Regression: the hard-logout failsafe fired while a refresh was in flight,
  // POSTed /auth/logout (which revokes the refresh token with no grace), and the
  // refresh that followed was refused — signing out a user who had clicked Stay.
  it('does not POST /auth/logout while a Stay refresh is still in flight at expiry', async () => {
    let finishRefresh!: (o: RefreshOutcome) => void;
    refreshMock.mockReturnValueOnce(new Promise<RefreshOutcome>((r) => { finishRefresh = r; }));
    const { result, unmount } = mountWithWarningOpen();

    let stay!: Promise<void>;
    act(() => { stay = result.current.onStay(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(MS_UNTIL_EXPIRY + 1_000); });
    expect(postMock).not.toHaveBeenCalledWith('/auth/logout');

    await act(async () => { finishRefresh('ok'); await stay; });
    expect(navigateMock).not.toHaveBeenCalled();
    unmount();
  });

  it('re-arms the failsafe after a transient failure when time is left', async () => {
    refreshMock.mockResolvedValueOnce('transient');
    const { result, unmount } = mountWithWarningOpen();

    await act(async () => { await result.current.onStay(); });
    expect(postMock).not.toHaveBeenCalled();

    await act(async () => { await vi.advanceTimersByTimeAsync(MS_UNTIL_EXPIRY + 1_000); });
    expect(postMock).toHaveBeenCalledWith('/auth/logout');
    unmount();
  });
});

describe('useSessionTimer expiry failsafe', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    inFlightMock.mockResolvedValue(false);
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    useAuthStore.setState({ kind: 'staff' } as never);
  });

  const runPastExpiry = (ms = MS_UNTIL_EXPIRY + 1_000) =>
    act(async () => { await vi.advanceTimersByTimeAsync(ms); });

  it('logs out at expiry when nothing is refreshing', async () => {
    const { unmount } = mountWithWarningOpen();
    await runPastExpiry();
    expect(postMock).toHaveBeenCalledWith('/auth/logout');
    expect(invalidateMock).toHaveBeenCalled();
    unmount();
  });

  // Multiple tabs: another tab is mid-refresh when this tab's timer fires.
  it('defers logout while another tab is refreshing, then logs out if it never finishes', async () => {
    inFlightMock.mockResolvedValue(true);
    const { unmount } = mountWithWarningOpen();
    await runPastExpiry();
    expect(postMock).not.toHaveBeenCalled();
    await runPastExpiry(20_000);
    expect(postMock).toHaveBeenCalledWith('/auth/logout');
    unmount();
  });

  it('does not log out when another tab extends the session during the deferral', async () => {
    inFlightMock.mockResolvedValue(true);
    const { unmount } = mountWithWarningOpen();
    await runPastExpiry();
    await act(async () => {
      useAuthStore.setState({ sessionExpiresAt: Date.now() + 60 * 60_000 });
    });
    await runPastExpiry(30_000);
    expect(postMock).not.toHaveBeenCalled();
    unmount();
  });

  it('explicit Log out posts immediately, even with a refresh in flight', async () => {
    inFlightMock.mockResolvedValue(true);
    const { result, unmount } = mountWithWarningOpen();
    await act(async () => { result.current.onLogout(); });
    expect(postMock).toHaveBeenCalledWith('/auth/logout');
    unmount();
  });

  it('logs a customer-portal session out at the portal endpoint', async () => {
    useAuthStore.setState({ kind: 'portal' } as never);
    const { result, unmount } = mountWithWarningOpen();
    await act(async () => { result.current.onLogout(); });
    expect(postMock).toHaveBeenCalledWith('/portal/auth/logout');
    unmount();
  });
});

describe('useSessionTimer onStay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  const cases: Array<{
    outcome: RefreshOutcome;
    warningStillOpen: boolean;
    loggedOut: boolean;
  }> = [
    { outcome: 'ok', warningStillOpen: false, loggedOut: false },
    // A transient failure (network error, cold-start 5xx) says nothing about the
    // session — the user must be able to press Stay again, not be signed out.
    { outcome: 'transient', warningStillOpen: true, loggedOut: false },
    { outcome: 'rejected', warningStillOpen: false, loggedOut: true },
  ];

  it.each(cases)(
    'refresh outcome "$outcome" -> warningStillOpen=$warningStillOpen loggedOut=$loggedOut',
    async ({ outcome, warningStillOpen, loggedOut }) => {
      refreshMock.mockResolvedValueOnce(outcome);
      const { result, unmount } = mountWithWarningOpen();

      await act(async () => {
        await result.current.onStay();
      });

      expect(refreshMock).toHaveBeenCalledTimes(1);
      expect(result.current.isExtending).toBe(false);
      expect(result.current.showWarning).toBe(warningStillOpen);
      if (loggedOut) {
        await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/auth/login', { replace: true }));
        expect(postMock).toHaveBeenCalledWith('/auth/logout');
      } else {
        expect(navigateMock).not.toHaveBeenCalled();
        expect(postMock).not.toHaveBeenCalled();
      }
      unmount();
    },
  );
});
