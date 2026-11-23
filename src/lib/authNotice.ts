// A one-shot message handed from wherever a session was ended to the login page
// the user lands on next — e.g. "This workspace is suspended." Kept in
// sessionStorage so it survives the hard redirect to /auth/login but not the tab.

const AUTH_NOTICE_KEY = 'auth-notice';

// The backend marks a 403 that means "this whole workspace cannot be used"
// (suspended, deleted, unprovisioned, under maintenance) with a `workspace_*`
// code — see models.CodeWorkspace* — as opposed to a plain missing permission.
const WORKSPACE_CODE_PREFIX = 'workspace_';
const FALLBACK_MESSAGE = 'This workspace is not available right now. Please contact your account administrator.';

/**
 * The message to show when an API error body says the workspace itself cannot
 * be used, or null for any other error (an ordinary 403 must not end a session).
 */
export function workspaceUnavailableMessage(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return null;
  const { code, message } = body as { code?: unknown; message?: unknown };
  if (typeof code !== 'string' || !code.startsWith(WORKSPACE_CODE_PREFIX)) return null;
  return typeof message === 'string' && message !== '' ? message : FALLBACK_MESSAGE;
}

// Every storage call is wrapped: sessionStorage can throw or be absent (private
// windows, blocked site data), and losing the notice must never break sign-out.
export function setAuthNotice(message: string): void {
  try {
    sessionStorage.setItem(AUTH_NOTICE_KEY, message);
  } catch {
    // The user still lands on the login page, just without the explanation.
  }
}

export function peekAuthNotice(): string | null {
  try {
    return sessionStorage.getItem(AUTH_NOTICE_KEY);
  } catch {
    return null;
  }
}

export function clearAuthNotice(): void {
  try {
    sessionStorage.removeItem(AUTH_NOTICE_KEY);
  } catch {
    // Nothing to clear.
  }
}
