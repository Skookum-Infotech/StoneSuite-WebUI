import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/api/tenantClient', () => ({
  tenantClient: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
}));

import { tenantClient } from '@/api/tenantClient';
import { useAuthStore } from '@/store/useAuthStore';
import { aiService, askAssistantStream, AskStreamHTTPError, conversationService } from './aiService';
import type { AskStreamHandlers } from './aiService';

describe('aiService.askAssistant', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sends conversation_id and a >=120s timeout, and returns the conversationId back', async () => {
    vi.mocked(tenantClient.post).mockResolvedValue({
      data: { success: true, data: { answer: 'hi', citations: [] }, conversation_id: 'conv-1' },
    });

    const res = await aiService.askAssistant('how many leads?', 'conv-1');

    expect(tenantClient.post).toHaveBeenCalledWith(
      '/tenant/ai/ask',
      { question: 'how many leads?', conversation_id: 'conv-1' },
      expect.objectContaining({ timeout: expect.any(Number) }),
    );
    const [, , config] = vi.mocked(tenantClient.post).mock.calls[0];
    // Must clear the backend's WriteTimeout (120s) with margin, not just
    // match it -- 90_000 used to be exactly equal to the server's OLD 90s
    // value, so a completion landing at 89.9s still surfaced as a client
    // timeout instead of the real response.
    expect((config as { timeout: number }).timeout).toBeGreaterThanOrEqual(120_000);
    expect(res).toEqual({ result: { answer: 'hi', citations: [] }, conversationId: 'conv-1' });
  });

  it('omits conversationId from the response when the backend omits it (stateless ask)', async () => {
    vi.mocked(tenantClient.post).mockResolvedValue({
      data: { success: true, data: { answer: 'hi', citations: [] } },
    });

    const res = await aiService.askAssistant('how many leads?');

    expect(tenantClient.post).toHaveBeenCalledWith(
      '/tenant/ai/ask',
      { question: 'how many leads?', conversation_id: undefined },
      expect.anything(),
    );
    expect(res.conversationId).toBeUndefined();
  });
});

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
      result: { answer: 'The answer.', citations: [] },
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
