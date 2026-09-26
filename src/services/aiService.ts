import { API_BASE_URL, attemptRefresh, authHeaders, forceLogout } from '@/api/client';
import { tenantClient } from '@/api/tenantClient';
import type { AIStatus, AiConversation, AiMessage, AskResponse, AskResult, Citation, PlatformAISettings } from '@/types/ai';

/** Error codes the backend puts on a 429 so the two kinds can be told apart:
 *  the model is busy (retry shortly) vs. the caller is asking too fast. */
export const ASSISTANT_BUSY = 'assistant_busy';
export const RATE_LIMITED = 'rate_limited';
/** The code a 403 carries when the assistant is off (platform or tenant
 *  switch) — distinct from an ordinary permission 403 so the UI can point at
 *  the toggle instead of a generic "no access" message. */
export const ASSISTANT_DISABLED = 'assistant_disabled';
/** The code an "error" SSE event carries while Ollama is still cold-starting
 *  — worth one silent auto-retry instead of surfacing as a failure. */
export const STARTING_UP = 'starting_up';

/** Thrown by askAssistantStream when the server rejects the request before
 *  any SSE byte is written (auth, validation, an unknown conversation_id, a
 *  busy or rate-limited 429). Carries what a caller needs to decide between
 *  retrying, recovering, and showing a message. */
export class AskStreamHTTPError extends Error {
  status: number;
  code?: string;
  /** Seconds, from the Retry-After header, when the server sent one. */
  retryAfter?: number;
  constructor(status: number, message: string, code?: string, retryAfter?: number) {
    super(message);
    this.name = 'AskStreamHTTPError';
    this.status = status;
    this.code = code;
    this.retryAfter = retryAfter;
  }
}

const SESSION_EXPIRED_MESSAGE = 'Your session has expired. Please sign in again.';
const UNREACHABLE_MESSAGE = "Couldn't reach the assistant. Check your connection and try again.";
const GENERIC_MESSAGE = 'The assistant could not answer that. Please try again.';

/** The text to show a user for anything askAssistantStream or the
 *  conversation calls throw. Server messages are used only where the backend
 *  writes them for users (validation, busy, unavailable); transport and
 *  library errors never leak raw ("TypeError: Failed to fetch"). */
export function friendlyAskError(err: unknown): string {
  if (err instanceof AskStreamHTTPError) {
    if (err.code === RATE_LIMITED) return "You're asking questions too quickly — please wait a moment and try again.";
    if (err.code === ASSISTANT_BUSY) return 'The assistant is busy with other questions — please try again in a few seconds.';
    if (err.code === ASSISTANT_DISABLED) return 'The StoneSuite Assistant has been turned off by your administrator.';
    if (err.status === 401) return SESSION_EXPIRED_MESSAGE;
    if (err.status === 403) return "You don't have access to the assistant.";
    if (err.status === 400 || err.status === 413 || err.status >= 500) return err.message;
    return GENERIC_MESSAGE;
  }
  if (err instanceof TypeError) return UNREACHABLE_MESSAGE;
  return GENERIC_MESSAGE;
}

export interface AskStreamHandlers {
  /** Called once, before any token — the raw retrieved set. Render as a
   *  dimmed "found N sources", never as citations (the model may not
   *  reference all of them; onDone's result.citations is the cited subset). */
  onSources?: (citations: Citation[]) => void;
  /** Called once per generated chunk, in order. */
  onToken: (token: string) => void;
  /** Called exactly once, on a clean finish. Nothing else fires after this. */
  onDone: (response: AskResponse) => void;
  /** Called for a stream-level failure (the "error" SSE event, the
   *  connection closing before "done", or a read failure) — never for the
   *  pre-flight case, which throws AskStreamHTTPError instead. Nothing else
   *  fires after this. Not called on an intentional abort (see signal).
   *  `code` is the "error" event's own code (e.g. STARTING_UP) when the
   *  stream-level failure carried one; absent for a connection/read failure. */
  onError: (message: string, code?: string) => void;
}

/** One SSE frame: "event: X\ndata: Y" (comment lines and any other field are
 *  ignored, matching how a real EventSource client behaves). */
function parseSSEFrame(raw: string): { event: string; data: string } | null {
  let event = '';
  let data = '';
  for (const line of raw.split('\n')) {
    if (line.startsWith('event: ')) event = line.slice('event: '.length);
    else if (line.startsWith('data: ')) data = line.slice('data: '.length);
  }
  return event ? { event, data } : null;
}

// streamInactivityTimeoutMs bounds how long askAssistantStream will wait
// between any two bytes arriving on the connection (a real event or just the
// heartbeat) before giving up and surfacing an error — comfortably above the
// backend's 15s ": ping" heartbeat interval, so a healthy connection never
// trips it, but a silently wedged one (proxy ate the connection, server
// process died mid-stream) doesn't hang the panel forever with Stop as the
// only escape.
const streamInactivityTimeoutMs = 45_000;

/** POST /tenant/ai/ask/stream, delivered via `fetch` + ReadableStream rather
 *  than axios — EventSource can't POST or set auth headers, and axios's XHR
 *  adapter buffers the whole response instead of yielding chunks. It reuses
 *  apiClient's pieces instead of its interceptors: the same base URL and
 *  auth/CSRF headers, and on a 401 the same shared token refresh, retrying
 *  once and ending the session (forceLogout) if the refresh fails.
 *
 * Resolves once the stream ends, however it ends (onDone or onError already
 * fired by then) — never throws for anything past the initial response.
 * Throws AskStreamHTTPError only for a non-2xx initial response, before any
 * UI commitment. Resolves silently (calls neither handler) on an intentional
 * abort via signal — the caller updates its own UI when it calls abort().
 */
export async function askAssistantStream(
  question: string,
  conversationId: string | undefined,
  handlers: AskStreamHandlers,
  signal: AbortSignal,
): Promise<void> {
  const send = (): Promise<Response> =>
    fetch(`${API_BASE_URL}/tenant/ai/ask/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      credentials: 'include',
      body: JSON.stringify({ question, conversation_id: conversationId }),
      signal,
    });

  let res: Response;
  try {
    res = await send();
    if (res.status === 401) {
      // The access token expired mid-session: refresh once (sharing any
      // refresh already in flight) and retry, exactly like apiClient does.
      if (!(await attemptRefresh())) {
        forceLogout();
        throw new AskStreamHTTPError(401, SESSION_EXPIRED_MESSAGE);
      }
      res = await send();
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return;
    if (err instanceof AskStreamHTTPError) throw err;
    handlers.onError(UNREACHABLE_MESSAGE);
    return;
  }

  if (!res.ok) {
    let message = GENERIC_MESSAGE;
    let code: string | undefined;
    try {
      const data: unknown = await res.json();
      if (data && typeof data === 'object') {
        if ('message' in data && typeof data.message === 'string') message = data.message;
        if ('code' in data && typeof data.code === 'string') code = data.code;
      }
    } catch {
      // Non-JSON error body (e.g. a proxy's own error page) — keep the default.
    }
    const retryAfter = Number(res.headers.get('Retry-After'));
    if (res.status === 401) forceLogout();
    throw new AskStreamHTTPError(res.status, message, code, Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : undefined);
  }
  if (!res.body) {
    handlers.onError('Streaming is not supported by this browser.');
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let settled = false;
  let timedOut = false;

  // Inactivity watchdog: reset on every chunk the reader hands back (a real
  // event or a heartbeat both count as activity), and on expiry cancel the
  // reader so the stuck read() resolves instead of hanging forever. Cleared
  // in the finally below regardless of how the stream ends.
  let inactivityTimer: ReturnType<typeof setTimeout> | undefined;
  const armInactivityTimer = () => {
    if (inactivityTimer) clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(() => {
      timedOut = true;
      void reader.cancel().catch(() => {});
    }, streamInactivityTimeoutMs);
  };

  try {
    armInactivityTimer();
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      armInactivityTimer();

      // Normalize CRLF to LF before framing: a proxy between the browser and
      // the backend (Fly, Cloudflare) may rewrite line endings in transit,
      // and the exact "\n\n" / "event: " / "data: " matching below would
      // otherwise silently break every frame for the rest of the connection.
      // The replace runs on the whole accumulated buffer, not the raw chunk,
      // so a \r\n split across two reader.read() chunks (chunk A ends "\r",
      // chunk B starts "\n") still normalizes once both halves are joined —
      // per-chunk replace would miss it and leave a literal \r\n in buffer.
      buffer += decoder.decode(value, { stream: true });
      buffer = buffer.replace(/\r\n/g, '\n');

      let sep: number;
      while ((sep = buffer.indexOf('\n\n')) !== -1) {
        const rawFrame = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        const frame = parseSSEFrame(rawFrame);
        if (!frame) continue; // a ": ping" heartbeat comment, or a blank keepalive

        // Each case parses its own JSON independently: one malformed frame
        // must not take down an otherwise-healthy stream. A bad "sources" or
        // "token" frame is simply dropped — more of both are still coming.
        // A bad "done"/"error" frame still ends the stream (the server
        // considers it over either way) but reports a clear message instead
        // of leaking a raw JSON.parse exception to the UI.
        switch (frame.event) {
          case 'sources': {
            try {
              const parsed = JSON.parse(frame.data) as { citations?: Citation[] };
              handlers.onSources?.(parsed.citations ?? []);
            } catch {
              // Drop this frame; sources are advisory and tokens keep streaming.
            }
            break;
          }
          case 'token': {
            try {
              handlers.onToken(JSON.parse(frame.data) as string);
            } catch {
              // Drop this one chunk rather than aborting the whole answer.
            }
            break;
          }
          case 'done': {
            settled = true;
            try {
              const parsed = JSON.parse(frame.data) as AskResult & { conversation_id?: string; persisted?: boolean; route?: string };
              handlers.onDone({
                result: { answer: parsed.answer, citations: parsed.citations ?? [], truncated: parsed.truncated === true },
                conversationId: parsed.conversation_id,
                persisted: parsed.persisted,
                route: parsed.route,
              });
            } catch {
              handlers.onError('The assistant sent an invalid response.');
            }
            return;
          }
          case 'error': {
            settled = true;
            try {
              const parsed = JSON.parse(frame.data) as { message?: string; code?: string };
              handlers.onError(parsed.message ?? GENERIC_MESSAGE, parsed.code);
            } catch {
              handlers.onError(GENERIC_MESSAGE);
            }
            return;
          }
          // Unknown event names are ignored, same as a real EventSource client.
        }
      }
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return;
    handlers.onError('Lost connection to the assistant. Please try again.');
    return;
  } finally {
    if (inactivityTimer) clearTimeout(inactivityTimer);
    // Releases the underlying stream/connection on every exit path,
    // including the two early returns above — a no-op if the stream already
    // finished naturally, cancels an abandoned one otherwise.
    await reader.cancel().catch(() => {});
  }

  if (!settled) {
    handlers.onError(
      timedOut
        ? 'The assistant stopped responding.'
        : 'The connection closed before the assistant finished responding.',
    );
  }
}

/** The assistant is on only when both switches agree — see AIStatus. Tenant
 *  staff (not customer-portal) call this to decide whether to offer the
 *  assistant at all. */
export function getAIStatus(): Promise<AIStatus> {
  return tenantClient
    .get<{ success: boolean; status: AIStatus }>('/tenant/ai/status')
    .then((r) => r.data.status);
}

/** Tenant-admin toggle (requires company-profile Configure). Returns the
 *  same shape as getAIStatus so the caller can update the cache directly. */
export function setTenantAIEnabled(enabled: boolean): Promise<AIStatus> {
  return tenantClient
    .put<{ success: boolean; status: AIStatus }>('/tenant/ai/settings', { enabled })
    .then((r) => r.data.status);
}

/** Platform-admin master switch — the AND'd other half of AIStatus. */
export function getPlatformAISettings(): Promise<PlatformAISettings> {
  return tenantClient
    .get<{ success: boolean } & PlatformAISettings>('/platform/ai/settings')
    .then((r) => r.data);
}

export function setPlatformAIEnabled(enabled: boolean): Promise<PlatformAISettings> {
  return tenantClient
    .put<{ success: boolean } & PlatformAISettings>('/platform/ai/settings', { enabled })
    .then((r) => r.data);
}

/** Kicks off loading the AI model in the background so the first real
 *  question doesn't pay a cold-start cost. Callers fire this and ignore the
 *  result — never await it for UI state. */
export function warmAssistant(): Promise<void> {
  return tenantClient.post('/tenant/ai/warm').then(() => undefined);
}

export const conversationService = {
  create: (): Promise<AiConversation> =>
    tenantClient
      .post<{ success: boolean; data: AiConversation }>('/tenant/ai/conversations')
      .then((r) => r.data.data),

  list: (): Promise<AiConversation[]> =>
    tenantClient
      .get<{ success: boolean; data: AiConversation[] }>('/tenant/ai/conversations')
      .then((r) => r.data.data ?? []),

  get: (id: string): Promise<{ conversation: AiConversation; messages: AiMessage[] }> =>
    tenantClient
      .get<{ success: boolean; data: { conversation: AiConversation; messages: AiMessage[] } }>(
        `/tenant/ai/conversations/${id}`,
      )
      .then((r) => r.data.data),

  remove: (id: string): Promise<void> =>
    tenantClient.delete(`/tenant/ai/conversations/${id}`).then(() => undefined),
};
