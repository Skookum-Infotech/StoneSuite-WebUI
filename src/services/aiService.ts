import { readCookie } from '@/api/client';
import { tenantClient } from '@/api/tenantClient';
import { useAuthStore } from '@/store/useAuthStore';
import type { AiConversation, AiMessage, AskResponse, AskResult, Citation } from '@/types/ai';

// The full-RAG path (embed -> retrieve -> optional rerank -> generate) can
// run long on a cold Ollama model. Must clear the backend's own
// http.Server.WriteTimeout with margin, not just match it: 90_000 here was
// exactly equal to that 90s server value, so a completion landing at 89.9s
// still surfaced as a client-side timeout instead of the real response.
const ASK_TIMEOUT_MS = 120_000;

export const aiService = {
  // conversationId is optional: omit for a stateless single-turn ask
  // (unchanged behavior), or pass one returned by a prior askAssistant/
  // conversationService.create call to continue that conversation's history.
  askAssistant: (question: string, conversationId?: string): Promise<AskResponse> =>
    tenantClient
      .post<{ success: boolean; data: AskResult; conversation_id?: string }>(
        '/tenant/ai/ask',
        { question, conversation_id: conversationId },
        { timeout: ASK_TIMEOUT_MS },
      )
      .then((r) => ({ result: r.data.data, conversationId: r.data.conversation_id })),
};

/** Thrown by askAssistantStream when the server rejects the request before
 *  any SSE byte is written (auth, validation, an unknown conversation_id).
 *  Carries the HTTP status so a caller can apply the same "stale
 *  conversation_id -> retry statelessly" logic askWithRetry already applies
 *  to the non-streaming AxiosError shape — see apiErrorMessage, which reads
 *  this via its plain Error.message fallback. */
export class AskStreamHTTPError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'AskStreamHTTPError';
    this.status = status;
  }
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
   *  fires after this. Not called on an intentional abort (see signal). */
  onError: (message: string) => void;
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

/** Streaming twin of askAssistant: POST /tenant/ai/ask/stream, delivered via
 *  `fetch` + ReadableStream instead of axios — EventSource can't POST or set
 *  auth headers, and axios's XHR adapter buffers the whole response instead
 *  of yielding chunks as they arrive. Bypasses tenantClient entirely, so it
 *  reimplements just the two things that interceptor chain provides: the
 *  Authorization fallback and the CSRF header (see api/client.ts) — cookie
 *  auth (withCredentials) comes from `credentials: 'include'` below.
 *
 * Resolves once the stream ends, however it ends (onDone or onError already
 * fired by then) — never throws for anything past the initial response,
 * since by that point the caller has already committed to a streaming UI
 * and there's no request left to retry. Throws AskStreamHTTPError only for
 * a non-2xx initial response, which happens before any UI commitment and is
 * exactly the shape callers already know how to retry on (see
 * AssistantPanel's askWithRetry). Resolves silently (calls neither handler)
 * on an intentional abort via signal — the caller already knows it stopped
 * the request and updates its own UI at the point it calls abort().
 */
export async function askAssistantStream(
  question: string,
  conversationId: string | undefined,
  handlers: AskStreamHandlers,
  signal: AbortSignal,
): Promise<void> {
  const baseURL = (import.meta.env.VITE_API_BASE_URL as string | undefined) || '/api';
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = useAuthStore.getState().token;
  if (token) headers.Authorization = `Bearer ${token}`;
  const csrfToken = readCookie('csrf_token');
  if (csrfToken) headers['X-CSRF-Token'] = csrfToken;

  let res: Response;
  try {
    res = await fetch(`${baseURL}/tenant/ai/ask/stream`, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({ question, conversation_id: conversationId }),
      signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return;
    handlers.onError(err instanceof Error ? err.message : 'Could not reach the assistant.');
    return;
  }

  if (!res.ok) {
    let message = 'The assistant could not answer that.';
    try {
      const data: unknown = await res.json();
      if (data && typeof data === 'object' && 'message' in data && typeof data.message === 'string') {
        message = data.message;
      }
    } catch {
      // Non-JSON error body (e.g. a proxy's own error page) — keep the default.
    }
    throw new AskStreamHTTPError(res.status, message);
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
      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');

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
              const parsed = JSON.parse(frame.data) as AskResult & { conversation_id?: string };
              handlers.onDone({ result: { answer: parsed.answer, citations: parsed.citations }, conversationId: parsed.conversation_id });
            } catch {
              handlers.onError('The assistant sent an invalid response.');
            }
            return;
          }
          case 'error': {
            settled = true;
            try {
              const parsed = JSON.parse(frame.data) as { message?: string };
              handlers.onError(parsed.message ?? 'The assistant could not answer that.');
            } catch {
              handlers.onError('The assistant could not answer that.');
            }
            return;
          }
          // Unknown event names are ignored, same as a real EventSource client.
        }
      }
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return;
    handlers.onError(err instanceof Error ? err.message : 'Lost connection to the assistant.');
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
