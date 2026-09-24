import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type * as ApiClientModule from '@/api/client';

vi.mock('@/api/tenantClient', () => ({
  tenantClient: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
}));
vi.mock('@/api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof ApiClientModule>()),
  attemptRefresh: vi.fn(),
  forceLogout: vi.fn(),
}));

import { attemptRefresh, forceLogout } from '@/api/client';
import { tenantClient } from '@/api/tenantClient';
import { useAuthStore } from '@/store/useAuthStore';
import {
  ASSISTANT_BUSY,
  RATE_LIMITED,
  askAssistantStream,
  AskStreamHTTPError,
  conversationService,
  friendlyAskError,
} from './aiService';
import type { AskStreamHandlers } from './aiService';

/** Builds a Response whose body streams `frames` (already newline-joined
 *  SSE text) in one chunk — enough to exercise the frame parser without
 *  needing to simulate real network chunking. */
function sseResponse(frames: string, status = 200): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(frames));
      controller.close();
    },
  });
  return new Response(stream, { status });
}

/** Like sseResponse, but delivers each string in `chunks` as its own
 *  separate reader.read() resolution — for exercising the parser's
 *  cross-chunk buffering instead of always handing it one complete frame at
 *  a time. */
function chunkedSseResponse(chunks: string[], status = 200): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  return new Response(stream, { status });
}

function collect(): AskStreamHandlers & { sources: unknown[]; tokens: string[]; done?: unknown; error?: string } {
  const calls = { sources: [] as unknown[], tokens: [] as string[], done: undefined as unknown, error: undefined as string | undefined };
  return Object.assign(calls, {
    onSources: (s: unknown[]) => calls.sources.push(...s),
    onToken: (t: string) => calls.tokens.push(t),
    onDone: (d: unknown) => {
      calls.done = d;
    },
    onError: (m: string) => {
      calls.error = m;
    },
  });
}

describe('askAssistantStream', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
    useAuthStore.setState({ token: null });
  });
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('POSTs with credentials, the question + conversation_id body, and an Authorization header when a token is set', async () => {
    useAuthStore.setState({ token: 'jwt-123' });
    vi.mocked(global.fetch).mockResolvedValue(
      sseResponse('event: done\ndata: {"answer":"hi","citations":[]}\n\n'),
    );

    const handlers = collect();
    await askAssistantStream('how many leads?', 'conv-1', handlers, new AbortController().signal);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, init] = vi.mocked(global.fetch).mock.calls[0];
    expect(String(url)).toContain('/tenant/ai/ask/stream');
    expect(init?.method).toBe('POST');
    expect(init?.credentials).toBe('include');
    expect(JSON.parse(init?.body as string)).toEqual({ question: 'how many leads?', conversation_id: 'conv-1' });
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer jwt-123');
  });

  it('delivers sources, tokens, and done to the handlers in order', async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      sseResponse(
        [
          'event: sources',
          'data: {"citations":[{"source_type":"record","source_id":"r1","snippet":"Acme"}]}',
          '',
          'event: token',
          'data: "The "',
          '',
          'event: token',
          'data: "answer."',
          '',
          'event: done',
          'data: {"answer":"The answer.","citations":[],"conversation_id":"conv-9"}',
          '',
          '',
        ].join('\n'),
      ),
    );

    const handlers = collect();
    await askAssistantStream('q', undefined, handlers, new AbortController().signal);

    expect(handlers.sources).toEqual([{ source_type: 'record', source_id: 'r1', snippet: 'Acme' }]);
    expect(handlers.tokens).toEqual(['The ', 'answer.']);
    expect(handlers.done).toEqual({
      result: { answer: 'The answer.', citations: [], truncated: false },
      conversationId: 'conv-9',
    });
    expect(handlers.error).toBeUndefined();
  });

  it('ignores ": ping" heartbeat comment lines', async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      sseResponse(
        ': ping\n\nevent: token\ndata: "x"\n\n: ping\n\nevent: done\ndata: {"answer":"x","citations":[]}\n\n',
      ),
    );

    const handlers = collect();
    await askAssistantStream('q', undefined, handlers, new AbortController().signal);

    expect(handlers.tokens).toEqual(['x']);
  });

  it('throws AskStreamHTTPError with the parsed message on a non-2xx response, before any handler fires', async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      new Response(JSON.stringify({ success: false, message: 'Conversation not found.' }), { status: 404 }),
    );

    const handlers = collect();
    await expect(askAssistantStream('q', 'stale-conv', handlers, new AbortController().signal)).rejects.toMatchObject(
      { status: 404, message: 'Conversation not found.' },
    );
    expect(handlers.done).toBeUndefined();
    expect(handlers.error).toBeUndefined();
  });

  it('is an instance of AskStreamHTTPError specifically, so callers can retry on 404 like the non-streaming path', async () => {
    vi.mocked(global.fetch).mockResolvedValue(new Response('{}', { status: 404 }));
    try {
      await askAssistantStream('q', 'stale', collect(), new AbortController().signal);
      expect.fail('expected a throw');
    } catch (err) {
      expect(err).toBeInstanceOf(AskStreamHTTPError);
    }
  });

  it('calls onError when the connection closes before a done or error event arrives', async () => {
    vi.mocked(global.fetch).mockResolvedValue(sseResponse('event: token\ndata: "partial"\n\n'));

    const handlers = collect();
    await askAssistantStream('q', undefined, handlers, new AbortController().signal);

    expect(handlers.tokens).toEqual(['partial']);
    expect(handlers.error).toBe('The connection closed before the assistant finished responding.');
    expect(handlers.done).toBeUndefined();
  });

  it('resolves silently, calling neither onDone nor onError, on an intentional abort', async () => {
    vi.mocked(global.fetch).mockImplementation(() => {
      const err = new DOMException('The user aborted a request.', 'AbortError');
      return Promise.reject(err);
    });

    const handlers = collect();
    await askAssistantStream('q', undefined, handlers, new AbortController().signal);

    expect(handlers.done).toBeUndefined();
    expect(handlers.error).toBeUndefined();
  });

  it('calls onError with the server message for a dedicated "error" SSE event', async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      sseResponse('event: sources\ndata: {"citations":[]}\n\nevent: error\ndata: {"message":"The assistant took too long to respond."}\n\n'),
    );

    const handlers = collect();
    await askAssistantStream('q', undefined, handlers, new AbortController().signal);

    expect(handlers.error).toBe('The assistant took too long to respond.');
    expect(handlers.done).toBeUndefined();
  });

  it('drops a malformed "token" frame but keeps streaming the rest', async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      sseResponse(
        [
          'event: token',
          'data: "good-1"',
          '',
          'event: token',
          'data: not valid json',
          '',
          'event: token',
          'data: "good-2"',
          '',
          'event: done',
          'data: {"answer":"good-1good-2","citations":[]}',
          '',
          '',
        ].join('\n'),
      ),
    );

    const handlers = collect();
    await askAssistantStream('q', undefined, handlers, new AbortController().signal);

    expect(handlers.tokens).toEqual(['good-1', 'good-2']);
    expect(handlers.done).toEqual({ result: { answer: 'good-1good-2', citations: [], truncated: false }, conversationId: undefined });
    expect(handlers.error).toBeUndefined();
  });

  it('drops a malformed "sources" frame but keeps streaming the rest', async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      sseResponse('event: sources\ndata: not json\n\nevent: token\ndata: "x"\n\nevent: done\ndata: {"answer":"x","citations":[]}\n\n'),
    );

    const handlers = collect();
    await askAssistantStream('q', undefined, handlers, new AbortController().signal);

    expect(handlers.sources).toEqual([]);
    expect(handlers.tokens).toEqual(['x']);
    expect(handlers.error).toBeUndefined();
  });

  it('reports a clear error, not a raw parse exception, when the "done" frame itself is malformed', async () => {
    vi.mocked(global.fetch).mockResolvedValue(sseResponse('event: done\ndata: not valid json\n\n'));

    const handlers = collect();
    await askAssistantStream('q', undefined, handlers, new AbortController().signal);

    expect(handlers.error).toBe('The assistant sent an invalid response.');
    expect(handlers.done).toBeUndefined();
  });

  it('reassembles a token frame split across two reader chunks', async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      chunkedSseResponse(['event: token\ndata: "hel', 'lo"\n\nevent: done\ndata: {"answer":"hello","citations":[]}\n\n']),
    );

    const handlers = collect();
    await askAssistantStream('q', undefined, handlers, new AbortController().signal);

    expect(handlers.tokens).toEqual(['hello']);
    expect(handlers.done).toEqual({ result: { answer: 'hello', citations: [], truncated: false }, conversationId: undefined });
  });

  it('tolerates CRLF-framed SSE (a proxy that rewrites line endings in transit)', async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      sseResponse('event: token\r\ndata: "x"\r\n\r\nevent: done\r\ndata: {"answer":"x","citations":[]}\r\n\r\n'),
    );

    const handlers = collect();
    await askAssistantStream('q', undefined, handlers, new AbortController().signal);

    expect(handlers.tokens).toEqual(['x']);
    expect(handlers.done).toEqual({ result: { answer: 'x', citations: [], truncated: false }, conversationId: undefined });
    expect(handlers.error).toBeUndefined();
  });

  it('sends the CSRF header echoed from the csrf_token cookie', async () => {
    document.cookie = 'csrf_token=csrf-abc';
    vi.mocked(global.fetch).mockResolvedValue(sseResponse('event: done\ndata: {"answer":"x","citations":[]}\n\n'));

    await askAssistantStream('q', undefined, collect(), new AbortController().signal);

    const [, init] = vi.mocked(global.fetch).mock.calls[0];
    expect((init?.headers as Record<string, string>)['X-CSRF-Token']).toBe('csrf-abc');
    document.cookie = 'csrf_token=; expires=Thu, 01 Jan 1970 00:00:00 GMT';
  });

  it('refreshes the session once on a 401 and retries the stream', async () => {
    vi.mocked(attemptRefresh).mockResolvedValue(true);
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(new Response('{}', { status: 401 }))
      .mockResolvedValueOnce(sseResponse('event: done\ndata: {"answer":"ok","citations":[]}\n\n'));

    const handlers = collect();
    await askAssistantStream('q', undefined, handlers, new AbortController().signal);

    expect(attemptRefresh).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect((handlers.done as { result: { answer: string } }).result.answer).toBe('ok');
    expect(forceLogout).not.toHaveBeenCalled();
  });

  it('ends the session when the 401 survives a failed refresh', async () => {
    vi.mocked(attemptRefresh).mockResolvedValue(false);
    vi.mocked(global.fetch).mockResolvedValue(new Response('{}', { status: 401 }));

    await expect(askAssistantStream('q', undefined, collect(), new AbortController().signal)).rejects.toMatchObject({ status: 401 });
    expect(forceLogout).toHaveBeenCalledTimes(1);
  });

  it('carries the error code and Retry-After of a busy 429', async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      new Response(JSON.stringify({ success: false, code: 'assistant_busy', message: 'busy' }), {
        status: 429,
        headers: { 'Retry-After': '5' },
      }),
    );

    await expect(askAssistantStream('q', undefined, collect(), new AbortController().signal)).rejects.toMatchObject({
      status: 429,
      code: ASSISTANT_BUSY,
      retryAfter: 5,
    });
  });

  it('reports a network failure in plain words, not the raw TypeError', async () => {
    vi.mocked(global.fetch).mockRejectedValue(new TypeError('Failed to fetch'));

    const handlers = collect();
    await askAssistantStream('q', undefined, handlers, new AbortController().signal);

    expect(handlers.error).toBe("Couldn't reach the assistant. Check your connection and try again.");
  });

  it('passes truncated and persisted through from the done payload', async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      sseResponse('event: done\ndata: {"answer":"x","citations":[],"truncated":true,"conversation_id":"c1","persisted":false}\n\n'),
    );

    const handlers = collect();
    await askAssistantStream('q', 'c1', handlers, new AbortController().signal);

    expect(handlers.done).toEqual({ result: { answer: 'x', citations: [], truncated: true }, conversationId: 'c1', persisted: false });
  });

  it('gives up with an error when the stream goes silent past the inactivity window', async () => {
    vi.useFakeTimers();
    try {
      const stream = new ReadableStream<Uint8Array>({ start() {} }); // never sends a byte
      vi.mocked(global.fetch).mockResolvedValue(new Response(stream, { status: 200 }));

      const handlers = collect();
      const done = askAssistantStream('q', undefined, handlers, new AbortController().signal);
      await vi.advanceTimersByTimeAsync(46_000);
      await done;

      expect(handlers.error).toBe('The assistant stopped responding.');
    } finally {
      vi.useRealTimers();
    }
  });

  it('a "done" payload with no conversation_id delivers conversationId: undefined, not a clobbered value', async () => {
    vi.mocked(global.fetch).mockResolvedValue(sseResponse('event: done\ndata: {"answer":"x","citations":[]}\n\n'));

    const handlers = collect();
    await askAssistantStream('q', 'conv-should-not-leak-in', handlers, new AbortController().signal);

    expect((handlers.done as { conversationId?: string }).conversationId).toBeUndefined();
  });
});

describe('friendlyAskError', () => {
  it.each([
    [new AskStreamHTTPError(429, 'x', RATE_LIMITED), "You're asking questions too quickly — please wait a moment and try again."],
    [new AskStreamHTTPError(429, 'x', ASSISTANT_BUSY), 'The assistant is busy with other questions — please try again in a few seconds.'],
    [new AskStreamHTTPError(401, 'raw'), 'Your session has expired. Please sign in again.'],
    [new AskStreamHTTPError(400, 'question is too long, please shorten it.'), 'question is too long, please shorten it.'],
    [new AskStreamHTTPError(503, 'The assistant is starting up.'), 'The assistant is starting up.'],
    [new AskStreamHTTPError(418, 'teapot internals'), 'The assistant could not answer that. Please try again.'],
    [new TypeError('Failed to fetch'), "Couldn't reach the assistant. Check your connection and try again."],
    [new Error('some library detail'), 'The assistant could not answer that. Please try again.'],
  ])('%s -> %s', (err, want) => {
    expect(friendlyAskError(err)).toBe(want);
  });
});

describe('conversationService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('list() unwraps the data array', async () => {
    vi.mocked(tenantClient.get).mockResolvedValue({
      data: { success: true, data: [{ id: 'c1', ownerUserId: 'u1', title: 'T', createdAt: '', updatedAt: '' }] },
    });
    const convs = await conversationService.list();
    expect(convs).toHaveLength(1);
    expect(convs[0].id).toBe('c1');
  });

  it('get() unwraps conversation + messages', async () => {
    vi.mocked(tenantClient.get).mockResolvedValue({
      data: {
        success: true,
        data: {
          conversation: { id: 'c1', ownerUserId: 'u1', title: 'T', createdAt: '', updatedAt: '' },
          messages: [{ role: 'user', content: 'hi', createdAt: '' }],
        },
      },
    });
    const { conversation, messages } = await conversationService.get('c1');
    expect(conversation.id).toBe('c1');
    expect(messages).toHaveLength(1);
  });
});
