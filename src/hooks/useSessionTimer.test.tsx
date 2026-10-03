import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// Control the refresh outcome and observe the logout POST without pulling in
// apiClient's interceptors.
vi.mock('@/api/client', () => ({
  apiClient: { post: vi.fn(() => Promise.resolve({})) },
  attemptRefresh: vi.fn(),
}));

const navigateMock = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
}));

import { useSessionTimer } from './useSessionTimer';
import { apiClient, attemptRefresh, type RefreshOutcome } from '@/api/client';
import { useAuthStore } from '@/store/useAuthStore';

const refreshMock = vi.mocked(attemptRefresh);
const postMock = vi.mocked(apiClient.post);

// Inside the 5-minute warning window, so the modal opens as soon as the hook mounts.
const MS_UNTIL_EXPIRY = 60_000;

function mountWithWarningOpen() {
  useAuthStore.setState({ sessionExpiresAt: Date.now() + MS_UNTIL_EXPIRY, isAuthenticated: true });
  const hook = renderHook(() => useSessionTimer());
  expect(hook.result.current.showWarning).toBe(true);
  return hook;
}

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
