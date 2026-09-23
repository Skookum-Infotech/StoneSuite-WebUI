import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import type { AskStreamHandlers } from '@/services/aiService';

// jsdom doesn't implement Element.scrollTo — AssistantPanel's auto-scroll
// effect calls it on every turns[] change, which would otherwise throw and
// fail every test here regardless of what's actually under test.
Element.prototype.scrollTo = vi.fn();

vi.mock('@/services/aiService', () => ({
  askAssistantStream: vi.fn(),
  aiService: { askAssistant: vi.fn() },
  AskStreamHTTPError: class AskStreamHTTPError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
  conversationService: { create: vi.fn(), list: vi.fn(), get: vi.fn(), remove: vi.fn() },
}));

import { AssistantPanel } from './AssistantPanel';
import { aiService, askAssistantStream, AskStreamHTTPError, conversationService } from '@/services/aiService';

function renderPanel() {
  const wrapper = ({ children }: { children: ReactNode }) => <MemoryRouter>{children}</MemoryRouter>;
  return render(<AssistantPanel onClose={vi.fn()} />, { wrapper });
}

async function ask(question: string): Promise<void> {
  const user = userEvent.setup();
  await user.type(screen.getByRole('textbox', { name: /ask the ai assistant/i }), question);
  await user.click(screen.getByRole('button', { name: /send question/i }));
}

/** A one-shot stream mock: immediately delivers `answer` via onDone (no
 *  intermediate tokens), the shape most of these tests only care about. */
function resolveWith(answer: string, conversationId?: string) {
  return async (_q: string, convId: string | undefined, handlers: AskStreamHandlers) => {
    handlers.onDone({ result: { answer, citations: [] }, conversationId: conversationId ?? convId });
  };
}

beforeEach(() => vi.clearAllMocks());

describe('AssistantPanel conversation wiring', () => {
  // Regression test for the AI assistant's multi-turn history never
  // activating: the backend only threads history into an ask that already
  // carries a conversation_id, and never mints one on its own. Before this
  // fix, conversationId's only writer was the stream's own "done" event,
  // which is always undefined on a stateless first call -- so it stayed
  // undefined forever and every turn (however many the user sent) went out
  // stateless.
  it('creates a conversation before the first ask and reuses it for every later ask', async () => {
    vi.mocked(conversationService.create).mockResolvedValue({
      id: 'conv-1',
      ownerUserId: 'u1',
      title: '',
      createdAt: '',
      updatedAt: '',
    });
    vi.mocked(askAssistantStream).mockImplementation(resolveWith('first answer'));

    renderPanel();

    await ask('how many leads do we have?');
    await waitFor(() => expect(askAssistantStream).toHaveBeenCalledTimes(1));
    expect(conversationService.create).toHaveBeenCalledTimes(1);
    expect(vi.mocked(askAssistantStream).mock.calls[0][0]).toBe('how many leads do we have?');
    expect(vi.mocked(askAssistantStream).mock.calls[0][1]).toBe('conv-1');
    await screen.findByText('first answer');

    await ask('what about last month?');
    await waitFor(() => expect(askAssistantStream).toHaveBeenCalledTimes(2));
    expect(conversationService.create).toHaveBeenCalledTimes(1); // not called again
    expect(vi.mocked(askAssistantStream).mock.calls[1][0]).toBe('what about last month?');
    expect(vi.mocked(askAssistantStream).mock.calls[1][1]).toBe('conv-1');
  });

  it('still asks (statelessly) if conversation creation itself fails', async () => {
    vi.mocked(conversationService.create).mockRejectedValue(new Error('boom'));
    vi.mocked(askAssistantStream).mockImplementation(resolveWith('answered anyway'));

    renderPanel();
    await ask('quick question');

    await waitFor(() => expect(askAssistantStream).toHaveBeenCalledTimes(1));
    expect(vi.mocked(askAssistantStream).mock.calls[0][1]).toBeUndefined();
    await screen.findByText('answered anyway');
  });

  it('does not re-create a conversation if the backend already returned one for this turn', async () => {
    vi.mocked(conversationService.create).mockResolvedValue({
      id: 'conv-2',
      ownerUserId: 'u1',
      title: '',
      createdAt: '',
      updatedAt: '',
    });
    vi.mocked(askAssistantStream).mockImplementation(resolveWith('ok', 'conv-2'));

    renderPanel();
    await ask('one');
    await waitFor(() => expect(askAssistantStream).toHaveBeenCalledTimes(1));
    await screen.findByText('ok');

    await ask('two');
    await waitFor(() => expect(askAssistantStream).toHaveBeenCalledTimes(2));
    expect(conversationService.create).toHaveBeenCalledTimes(1);
    expect(vi.mocked(askAssistantStream).mock.calls[1][1]).toBe('conv-2');
  });
});

describe('AssistantPanel streaming', () => {
  it('renders tokens as they arrive, before the stream settles', async () => {
    vi.mocked(conversationService.create).mockResolvedValue({
      id: 'conv-3',
      ownerUserId: 'u1',
      title: '',
      createdAt: '',
      updatedAt: '',
    });
    let deliverToken: ((t: string) => void) | undefined;
    vi.mocked(askAssistantStream).mockImplementation(
      (_q, _convId, handlers: AskStreamHandlers) =>
        new Promise<void>((resolve) => {
          deliverToken = (t: string) => handlers.onToken(t);
          // never resolves in this test — the point is to inspect the
          // partial state while streaming is still in progress.
          void resolve;
        }),
    );

    renderPanel();
    await ask('stream this');

    await waitFor(() => expect(deliverToken).toBeDefined());
    deliverToken?.('The ');
    deliverToken?.('answer');

    await screen.findByText('The answer');
    // The Send button becomes a Stop button while a stream is in flight —
    // proof the panel knows generation hasn't finished yet.
    expect(screen.getByRole('button', { name: /stop generating/i })).toBeInTheDocument();
  });

  it('shows a dimmed source count once "sources" arrives, before any token', async () => {
    vi.mocked(conversationService.create).mockResolvedValue({
      id: 'conv-4',
      ownerUserId: 'u1',
      title: '',
      createdAt: '',
      updatedAt: '',
    });
    vi.mocked(askAssistantStream).mockImplementation(
      (_q, _convId, handlers: AskStreamHandlers) =>
        new Promise<void>(() => {
          handlers.onSources?.([{ source_type: 'record', source_id: 'r1', snippet: 'Acme deal' }]);
        }),
    );

    renderPanel();
    await ask('who is acme?');

    await screen.findByText(/found 1 source/i);
  });

  it('Stop aborts the in-flight stream and leaves the panel usable again', async () => {
    vi.mocked(conversationService.create).mockResolvedValue({
      id: 'conv-5',
      ownerUserId: 'u1',
      title: '',
      createdAt: '',
      updatedAt: '',
    });
    let capturedSignal: AbortSignal | undefined;
    vi.mocked(askAssistantStream).mockImplementation(
      (_q, _convId, _handlers, signal: AbortSignal) =>
        new Promise<void>((resolve) => {
          capturedSignal = signal;
          signal.addEventListener('abort', () => resolve());
        }),
    );

    renderPanel();
    await ask('long question');

    const stopButton = await screen.findByRole('button', { name: /stop generating/i });
    await userEvent.click(stopButton);

    await waitFor(() => expect(capturedSignal?.aborted).toBe(true));
    // The input is usable again — no longer stuck disabled behind a stream
    // that will now never resolve on its own.
    await waitFor(() => expect(screen.getByRole('textbox', { name: /ask the ai assistant/i })).not.toBeDisabled());
  });

  // Regression test for the process-global maxConcurrentStreams=2 semaphore
  // (shared across every tenant): the third concurrent streaming user
  // anywhere gets a 429 with no queuing. Rather than surfacing that as a
  // dead end, the panel falls back to the plain non-streaming ask so the
  // user still gets an answer.
  it('falls back to the non-streaming ask and still renders an answer on a 429', async () => {
    vi.mocked(conversationService.create).mockResolvedValue({
      id: 'conv-429',
      ownerUserId: 'u1',
      title: '',
      createdAt: '',
      updatedAt: '',
    });
    vi.mocked(askAssistantStream).mockRejectedValue(
      new AskStreamHTTPError(429, 'The assistant is handling too many conversations right now.'),
    );
    vi.mocked(aiService.askAssistant).mockResolvedValue({
      result: { answer: 'fallback answer', citations: [] },
      conversationId: 'conv-429',
    });

    renderPanel();
    await ask('busy question');

    await screen.findByText('fallback answer');
    expect(aiService.askAssistant).toHaveBeenCalledWith('busy question', 'conv-429');
    // No error bubble, no stuck Stop button — this must read as a normal
    // completed turn, not a failure the user has to notice and route around.
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send question/i })).toBeInTheDocument();
  });

  it('surfaces an error if the 429 fallback ask itself fails', async () => {
    vi.mocked(conversationService.create).mockResolvedValue({
      id: 'conv-429b',
      ownerUserId: 'u1',
      title: '',
      createdAt: '',
      updatedAt: '',
    });
    vi.mocked(askAssistantStream).mockRejectedValue(new AskStreamHTTPError(429, 'busy'));
    vi.mocked(aiService.askAssistant).mockRejectedValue(new Error('network down'));

    renderPanel();
    await ask('busy question');

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
  });

  // Regression test for P1-5: a later "done" payload that omits
  // conversation_id (the backend never does this once a conversation
  // exists, but nothing before this asserted it) must not silently drop
  // multi-turn context by overwriting a good id with undefined.
  it('does not clobber a held conversationId when a later done payload omits it', async () => {
    vi.mocked(conversationService.create).mockResolvedValue({
      id: 'conv-keep',
      ownerUserId: 'u1',
      title: '',
      createdAt: '',
      updatedAt: '',
    });
    vi.mocked(askAssistantStream)
      .mockImplementationOnce(resolveWith('first answer', 'conv-keep'))
      // Explicitly omits conversation_id in the "done" payload, unlike
      // resolveWith's default of echoing back whatever convId it was
      // called with -- that echo would mask exactly the bug this test
      // exists to catch.
      .mockImplementationOnce(async (_q, _convId, handlers: AskStreamHandlers) => {
        handlers.onDone({ result: { answer: 'second answer', citations: [] }, conversationId: undefined });
      });

    renderPanel();

    await ask('one');
    await screen.findByText('first answer');

    await ask('two');
    await screen.findByText('second answer');

    await ask('three');
    await waitFor(() => expect(askAssistantStream).toHaveBeenCalledTimes(3));
    // Still 'conv-keep', not undefined -- the second turn's omitted
    // conversation_id must not have wiped it.
    expect(vi.mocked(askAssistantStream).mock.calls[2][1]).toBe('conv-keep');
  });
});
