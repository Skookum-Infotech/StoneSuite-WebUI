import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useState } from 'react';
import type * as AiServiceModule from '@/services/aiService';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import type { AskStreamHandlers } from '@/services/aiService';
import type { AiConversation, Citation } from '@/types/ai';

// jsdom doesn't implement Element.scrollTo, which the follow-the-stream
// effect calls on every turns change.
Element.prototype.scrollTo = vi.fn();
// Nor scrollIntoView, which an [n] marker with nowhere to navigate calls via
// CitationChips' scrollToAndHighlight.
Element.prototype.scrollIntoView = vi.fn();

vi.mock('@/services/aiService', async (importOriginal) => ({
  ...(await importOriginal<typeof AiServiceModule>()),
  askAssistantStream: vi.fn(),
  conversationService: { create: vi.fn(), list: vi.fn(), get: vi.fn(), remove: vi.fn() },
  warmAssistant: vi.fn(),
}));

const hasPermission = vi.fn<(resource: string, action: string) => boolean>();
vi.mock('@/hooks/useUserPermissions', () => ({
  useUserPermissions: () => ({ hasPermission, grants: [], isLoading: false, activeRoleId: '' }),
}));

import { AssistantPanel } from './AssistantPanel';
import { useAssistantConversation } from './useAssistantConversation';
import { RATE_LIMITED, STARTING_UP, askAssistantStream, AskStreamHTTPError, conversationService, warmAssistant } from '@/services/aiService';
import { queryClient } from '@/lib/queryClient';
import { useAuthStore } from '@/store/useAuthStore';

// Trailing empty segment: the test user below carries no selectedRoleId.
const STORAGE_KEY = 'ai-conversation:t1:u1:';

function conv(id: string, title = ''): AiConversation {
  return { id, ownerUserId: 'u1', title, createdAt: '', updatedAt: new Date().toISOString() };
}

function LocationProbe() {
  return <div data-testid="location">{useLocation().pathname}</div>;
}

/** AssistantPanel's conversation/draft are owned by its caller (HelpMenu in
 *  the app) so a stream survives the panel unmounting — this harness plays
 *  that role for tests, the same way HelpMenu composes them. */
function Harness({ onClose }: { onClose: () => void }) {
  const conversation = useAssistantConversation();
  const [draft, setDraft] = useState('');
  return <AssistantPanel conversation={conversation} draft={{ value: draft, onChange: setDraft }} onClose={onClose} />;
}

function renderPanel(onClose = vi.fn(), initialPath = '/crm/prospect/p-1') {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[initialPath]}>
      {children}
      <LocationProbe />
    </MemoryRouter>
  );
  return { onClose, ...render(<Harness onClose={onClose} />, { wrapper }) };
}

function input(): HTMLElement {
  return screen.getByRole('textbox', { name: /ask the ai assistant/i });
}

async function ask(question: string): Promise<void> {
  const user = userEvent.setup();
  await user.type(input(), question);
  await user.click(screen.getByRole('button', { name: /send question/i }));
}

/** A stream that emits sources, then the answer as one token, then done. */
function streamWith(answer: string, opts: { sources?: Citation[]; citations?: Citation[]; truncated?: boolean; persisted?: boolean } = {}) {
  return async (_q: string, convId: string | undefined, handlers: AskStreamHandlers) => {
    handlers.onSources?.(opts.sources ?? []);
    handlers.onToken(answer);
    handlers.onDone({
      result: { answer, citations: opts.citations ?? [], truncated: opts.truncated },
      conversationId: convId,
      persisted: opts.persisted ?? true,
    });
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  useAuthStore.setState({ user: { id: 'u1', email: 'a@b.c', fullName: 'A', tenantId: 't1' } });
  hasPermission.mockReturnValue(true);
  vi.mocked(conversationService.create).mockResolvedValue(conv('conv-1'));
  vi.mocked(conversationService.list).mockResolvedValue([]);
  vi.mocked(warmAssistant).mockResolvedValue(undefined);
});

describe('conversation wiring', () => {
  it('creates a conversation before the first ask and reuses it for every later ask', async () => {
    vi.mocked(askAssistantStream).mockImplementation(streamWith('first answer'));
    renderPanel();

    await ask('how many leads do we have?');
    await screen.findByText('first answer');
    await ask('what about last month?');
    await waitFor(() => expect(askAssistantStream).toHaveBeenCalledTimes(2));

    expect(conversationService.create).toHaveBeenCalledTimes(1);
    expect(vi.mocked(askAssistantStream).mock.calls.map((c) => c[1])).toEqual(['conv-1', 'conv-1']);
  });

  it('still asks (statelessly) if conversation creation fails', async () => {
    vi.mocked(conversationService.create).mockRejectedValue(new Error('boom'));
    vi.mocked(askAssistantStream).mockImplementation(streamWith('answered anyway'));
    renderPanel();

    await ask('quick question');

    await screen.findByText('answered anyway');
    expect(vi.mocked(askAssistantStream).mock.calls[0][1]).toBeUndefined();
  });

  it('remembers the conversation across close/reopen and restores its transcript', async () => {
    vi.mocked(askAssistantStream).mockImplementation(streamWith('an answer'));
    const first = renderPanel();
    await ask('remember me');
    await screen.findByText('an answer');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('conv-1');
    first.unmount();

    vi.mocked(conversationService.get).mockResolvedValue({
      conversation: conv('conv-1'),
      messages: [
        { role: 'user', content: 'remember me', createdAt: '' },
        { role: 'assistant', content: 'an answer', createdAt: '' },
      ],
    });
    renderPanel();

    expect(await screen.findByText('remember me')).toBeInTheDocument();
    expect(screen.getByText('an answer')).toBeInTheDocument();
    expect(conversationService.get).toHaveBeenCalledWith('conv-1');
  });

  it('forgets a remembered conversation that no longer exists', async () => {
    localStorage.setItem(STORAGE_KEY, 'gone');
    vi.mocked(conversationService.get).mockRejectedValue({ isAxiosError: true, response: { status: 404 } });
    renderPanel();

    await waitFor(() => expect(localStorage.getItem(STORAGE_KEY)).toBeNull());
  });

  it('recovers from a deleted conversation by starting a new one and retrying', async () => {
    localStorage.setItem(STORAGE_KEY, 'stale');
    vi.mocked(conversationService.get).mockResolvedValue({ conversation: conv('stale'), messages: [] });
    vi.mocked(conversationService.create).mockResolvedValue(conv('fresh'));
    vi.mocked(askAssistantStream)
      .mockRejectedValueOnce(new AskStreamHTTPError(404, 'Conversation not found.'))
      .mockImplementationOnce(streamWith('recovered'));
    renderPanel();
    await waitFor(() => expect(conversationService.get).toHaveBeenCalled());

    await ask('hello');

    await screen.findByText('recovered');
    expect(vi.mocked(askAssistantStream).mock.calls.map((c) => c[1])).toEqual(['stale', 'fresh']);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('fresh');
  });

  it('New chat starts over', async () => {
    vi.mocked(askAssistantStream).mockImplementation(streamWith('old answer'));
    renderPanel();
    await ask('old question');
    await screen.findByText('old answer');

    await userEvent.setup().click(screen.getByRole('button', { name: 'New chat' }));

    expect(screen.queryByText('old answer')).not.toBeInTheDocument();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});

describe('streaming', () => {
  it('renders tokens as they arrive, with a source count before the first token', async () => {
    let handlers!: AskStreamHandlers;
    let finish!: () => void;
    vi.mocked(askAssistantStream).mockImplementation((_q, _c, h) => {
      handlers = h;
      return new Promise<void>((resolve) => {
        finish = resolve;
      });
    });
    renderPanel();
    await ask('q');
    await waitFor(() => expect(handlers).toBeDefined());

    act(() => handlers.onSources?.([{ source_type: 'record', source_id: 'r1', snippet: 'Acme' }]));
    expect(await screen.findByText(/Found 1 source/)).toBeInTheDocument();

    act(() => handlers.onToken('Partial '));
    expect(await screen.findByText(/Partial/)).toBeInTheDocument();

    act(() => {
      handlers.onDone({ result: { answer: 'Partial answer.', citations: [] }, conversationId: 'conv-1', persisted: true });
      finish();
    });
    expect(await screen.findByText('Partial answer.')).toBeInTheDocument();
  });

  // Regression: Stop before the first token used to leave "Thinking…" forever,
  // because only turns already marked streaming were patched.
  it('Stop before the first token settles the turn and offers Retry', async () => {
    vi.mocked(askAssistantStream).mockImplementation(
      (_q, _c, _h, signal) => new Promise<void>((resolve) => signal.addEventListener('abort', () => resolve())),
    );
    renderPanel();
    await ask('slow question');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /stop generating/i }));

    expect(await screen.findByText('Stopped.')).toBeInTheDocument();
    expect(screen.queryByText('Thinking…')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send question/i })).toBeInTheDocument();
  });

  it('ignores a second submit while the conversation is still being created', async () => {
    let createDone!: (c: AiConversation) => void;
    vi.mocked(conversationService.create).mockReturnValue(new Promise((r) => { createDone = r; }));
    vi.mocked(askAssistantStream).mockImplementation(streamWith('once'));
    renderPanel();
    const user = userEvent.setup();

    await user.type(input(), 'first{Enter}');
    await user.type(input(), 'second{Enter}');
    act(() => createDone(conv('conv-1')));

    await screen.findByText('once');
    expect(askAssistantStream).toHaveBeenCalledTimes(1);
    expect(conversationService.create).toHaveBeenCalledTimes(1);
  });

  it('waits and retries once when the assistant is busy', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      vi.mocked(askAssistantStream)
        .mockRejectedValueOnce(new AskStreamHTTPError(429, 'busy', 'assistant_busy', 1))
        .mockImplementationOnce(streamWith('worth the wait'));
      renderPanel();
      await ask('q');

      expect(await screen.findByText(/busy — retrying/)).toBeInTheDocument();
      await act(() => vi.advanceTimersByTimeAsync(1_100));
      expect(await screen.findByText('worth the wait')).toBeInTheDocument();
      expect(askAssistantStream).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not retry a rate-limit 429, and says why', async () => {
    vi.mocked(askAssistantStream).mockRejectedValue(new AskStreamHTTPError(429, 'raw', 'rate_limited'));
    renderPanel();
    await ask('q');

    expect(await screen.findByRole('alert')).toHaveTextContent(/asking questions too quickly/);
    expect(askAssistantStream).toHaveBeenCalledTimes(1);
  });

  // The backend sends this as a pre-flight 403 (before any SSE byte), never
  // as the 429 assistant_busy code the retry loop above handles — it must
  // not be treated as "busy" and retried.
  it('shows the disabled message and refreshes ai-status when the assistant is turned off', async () => {
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    vi.mocked(askAssistantStream).mockRejectedValue(new AskStreamHTTPError(403, 'raw', 'assistant_disabled'));
    renderPanel();
    await ask('q');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The StoneSuite Assistant has been turned off by your administrator.',
    );
    expect(askAssistantStream).toHaveBeenCalledTimes(1);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['ai-status'] });
  });

  it('Retry re-asks an errored turn in place', async () => {
    vi.mocked(askAssistantStream)
      .mockImplementationOnce(async (_q, _c, h) => h.onError('The assistant is temporarily unavailable. Please try again.'))
      .mockImplementationOnce(streamWith('second time lucky'));
    renderPanel();
    await ask('flaky');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /retry/i }));

    expect(await screen.findByText('second time lucky')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getAllByText('flaky')).toHaveLength(1);
  });

  it('marks truncated and unsaved answers', async () => {
    vi.mocked(askAssistantStream).mockImplementation(streamWith('cut', { truncated: true, persisted: false }));
    renderPanel();
    await ask('q');

    expect(await screen.findByText(/cut short/)).toBeInTheDocument();
    expect(screen.getByText(/Not saved to this conversation/)).toBeInTheDocument();
  });
});

describe('rendering and citations', () => {
  it('renders markdown lists and never renders raw HTML from the answer', async () => {
    vi.mocked(askAssistantStream).mockImplementation(
      streamWith('Top leads:\n\n- Acme\n- Globex\n\n<img src=x onerror="alert(1)">'),
    );
    renderPanel();
    await ask('q');

    expect(await screen.findAllByRole('listitem')).toHaveLength(2);
    expect(document.querySelector('img')).toBeNull();
  });

  // Regression: chips used to build /crm/<type-of-current-page>/<id>, so a
  // lead cited from a prospect page opened /crm/prospect/<leadId>.
  it('a record chip links by its own record_type, not the current page', async () => {
    const lead: Citation = { source_type: 'record', source_id: 'lead-9', snippet: 'Acme lead', record_type: 'lead' };
    vi.mocked(askAssistantStream).mockImplementation(streamWith('See [1].', { sources: [lead], citations: [lead] }));
    renderPanel(vi.fn(), '/crm/prospect/p-1');
    await ask('q');
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Open lead: Acme lead' }));

    expect(screen.getByTestId('location')).toHaveTextContent('/crm/lead/lead-9');
  });

  it('an [n] marker opens source n', async () => {
    const help: Citation = { source_type: 'help', source_id: 'leads › Overview', snippet: 'About leads' };
    const customer: Citation = { source_type: 'record', source_id: 'c-4', snippet: 'Globex', record_type: 'customer' };
    vi.mocked(askAssistantStream).mockImplementation(streamWith('Globex is active [2].', { sources: [help, customer], citations: [customer] }));
    renderPanel();
    await ask('q');
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Open source 2' }));

    expect(screen.getByTestId('location')).toHaveTextContent('/crm/customer/c-4');
  });

  it('a help chip expands to show its passage', async () => {
    const help: Citation = { source_type: 'help', source_id: 'leads › Overview', snippet: 'Leads are new contacts.' };
    vi.mocked(askAssistantStream).mockImplementation(streamWith('See [1].', { sources: [help], citations: [help] }));
    renderPanel();
    await ask('q');
    const user = userEvent.setup();

    const chip = await screen.findByRole('button', { name: 'Help reference: leads › Overview' });
    expect(chip).toHaveAttribute('aria-expanded', 'false');
    await user.click(chip);
    expect(chip).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Leads are new contacts.')).toBeInTheDocument();
  });
});

describe('history view', () => {
  it('lists past conversations, opens one, and deletes with a confirm step', async () => {
    vi.mocked(conversationService.list).mockResolvedValue([conv('c-a', 'Pipeline review'), conv('c-b', 'Q3 leads')]);
    vi.mocked(conversationService.get).mockResolvedValue({
      conversation: conv('c-b'),
      messages: [{ role: 'user', content: 'q3 question', createdAt: '' }],
    });
    vi.mocked(conversationService.remove).mockResolvedValue(undefined);
    renderPanel();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Recent conversations' }));
    const list = await screen.findByRole('list', { name: 'Recent conversations' });
    await user.click(within(list).getByRole('button', { name: 'Delete conversation Pipeline review' }));
    await user.click(within(list).getByRole('button', { name: 'Confirm delete Pipeline review' }));
    await waitFor(() => expect(conversationService.remove).toHaveBeenCalledWith('c-a'));
    expect(within(list).queryByText('Pipeline review')).not.toBeInTheDocument();

    await user.click(within(list).getByText('Q3 leads'));
    expect(await screen.findByText('q3 question')).toBeInTheDocument();
    expect(localStorage.getItem(STORAGE_KEY)).toBe('c-b');
  });
});

describe('panel behavior', () => {
  it('Escape closes only when focus is inside the panel', () => {
    const { onClose } = renderPanel();

    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.keyDown(input(), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows a help-only hint to a user who cannot read any CRM records', () => {
    hasPermission.mockReturnValue(false);
    renderPanel();

    expect(screen.getByText(/I can answer questions about using the app/)).toBeInTheDocument();
  });

  it('blocks a question over the byte limit and says so', async () => {
    renderPanel();
    // 700 three-byte characters = 2100 bytes, though only 700 characters.
    fireEvent.change(input(), { target: { value: '€'.repeat(700) } });

    expect(screen.getByText(/Too long/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send question/i })).toBeDisabled();
  });

  it('Shift+Enter adds a line instead of sending', async () => {
    renderPanel();
    const user = userEvent.setup();
    await user.type(input(), 'line one{Shift>}{Enter}{/Shift}line two');

    expect(input()).toHaveValue('line one\nline two');
    expect(askAssistantStream).not.toHaveBeenCalled();
  });

  it('keeps focus in the input after an answer arrives', async () => {
    vi.mocked(askAssistantStream).mockImplementation(streamWith('done'));
    renderPanel();
    await ask('q');
    await screen.findByText('done');

    await waitFor(() => expect(input()).toHaveFocus());
  });
});

// The conversation/draft are owned by whoever composes AssistantPanel
// (HelpMenu in the app), specifically so an in-flight answer and a
// half-typed question both survive the panel unmounting.
function OpenCloseHarness() {
  const conversation = useAssistantConversation();
  const [draft, setDraft] = useState('');
  const [open, setOpen] = useState(true);
  return (
    <MemoryRouter>
      <button type="button" onClick={() => setOpen((o) => !o)}>toggle panel</button>
      {open && (
        <AssistantPanel conversation={conversation} draft={{ value: draft, onChange: setDraft }} onClose={() => setOpen(false)} />
      )}
    </MemoryRouter>
  );
}

describe('surviving panel close (HIGH #3)', () => {
  it('keeps streaming after the panel closes and shows the finished answer on reopen', async () => {
    let finish!: () => void;
    vi.mocked(askAssistantStream).mockImplementation(
      (_q, convId, h) =>
        new Promise<void>((resolve) => {
          finish = () => {
            h.onToken('late answer');
            h.onDone({ result: { answer: 'late answer', citations: [] }, conversationId: convId ?? 'conv-1', persisted: true });
            resolve();
          };
        }),
    );
    render(<OpenCloseHarness />);
    await ask('slow one');

    await userEvent.setup().click(screen.getByRole('button', { name: 'Close AI assistant' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    act(() => finish());
    await userEvent.setup().click(screen.getByRole('button', { name: 'toggle panel' }));

    expect(await screen.findByText('late answer')).toBeInTheDocument();
    expect(askAssistantStream).toHaveBeenCalledTimes(1);
  });

  it('keeps the typed draft after closing and reopening the panel', async () => {
    render(<OpenCloseHarness />);
    fireEvent.change(input(), { target: { value: 'half-typed question' } });

    await userEvent.setup().click(screen.getByRole('button', { name: 'Close AI assistant' }));
    await userEvent.setup().click(screen.getByRole('button', { name: 'toggle panel' }));

    expect(input()).toHaveValue('half-typed question');
  });
});

describe('send disabled while a conversation loads (HIGH #1)', () => {
  it('disables Send (without swapping to Stop) while a saved conversation is loading', async () => {
    localStorage.setItem(STORAGE_KEY, 'conv-1');
    let resolveGet!: (v: { conversation: AiConversation; messages: never[] }) => void;
    vi.mocked(conversationService.get).mockReturnValue(new Promise((r) => { resolveGet = r; }));
    renderPanel();

    fireEvent.change(input(), { target: { value: 'question while loading' } });
    expect(screen.getByRole('button', { name: /send question/i })).toBeDisabled();
    expect(screen.queryByRole('button', { name: /stop generating/i })).not.toBeInTheDocument();

    act(() => resolveGet({ conversation: conv('conv-1'), messages: [] }));
    await waitFor(() => expect(screen.getByRole('button', { name: /send question/i })).toBeEnabled());
  });
});

describe('a superseded conversation-create doesn\'t clobber a newer action (HIGH #2)', () => {
  it('New chat during the first ask keeps the conversation empty once the stale create() resolves', async () => {
    let resolveCreate!: (c: AiConversation) => void;
    vi.mocked(conversationService.create).mockReturnValue(new Promise((r) => { resolveCreate = r; }));
    renderPanel();

    await userEvent.setup().type(input(), 'first question{Enter}');
    // A stream is in flight, so New chat asks for confirmation first (#20).
    await userEvent.setup().click(screen.getByRole('button', { name: 'New chat' }));
    await userEvent.setup().click(screen.getByRole('button', { name: 'Continue' }));
    await act(async () => {
      resolveCreate(conv('stale-conv'));
      await Promise.resolve();
    });

    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(screen.queryByText('first question')).not.toBeInTheDocument();
  });
});

describe('failed conversation loads (HIGH #4)', () => {
  it('shows an error with Retry and clears the stale id after a failed initial restore', async () => {
    localStorage.setItem(STORAGE_KEY, 'conv-1');
    vi.mocked(conversationService.get)
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce({ conversation: conv('conv-1'), messages: [{ role: 'user', content: 'q', createdAt: '' }] });
    renderPanel();

    expect(await screen.findByRole('alert')).toHaveTextContent(/couldn't load/i);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();

    await userEvent.setup().click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('q')).toBeInTheDocument();
  });
});

describe('cold start hint (HIGH #5)', () => {
  it('shows a warming-up hint after 8s still waiting on the first token', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      vi.mocked(askAssistantStream).mockImplementation(() => new Promise(() => {}));
      renderPanel();
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      await user.type(input(), 'slow start');
      await user.click(screen.getByRole('button', { name: /send question/i }));

      expect(screen.getByText('Thinking…', { selector: 'span:not(.sr-only)' })).toBeInTheDocument();
      await act(() => vi.advanceTimersByTimeAsync(8_100));
      expect(await screen.findByText(/Warming up the assistant/)).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('starting_up auto-retry (HIGH #7)', () => {
  it('shows a countdown and retries once after a starting_up error', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      vi.mocked(askAssistantStream)
        .mockImplementationOnce(async (_q, _c, h) => h.onError('The assistant is starting up.', STARTING_UP))
        .mockImplementationOnce(streamWith('warmed up now'));
      renderPanel();
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      await user.type(input(), 'q');
      await user.click(screen.getByRole('button', { name: /send question/i }));

      expect(await screen.findByText(/starting up — retrying in 10s/)).toBeInTheDocument();
      await act(() => vi.advanceTimersByTimeAsync(10_100));
      expect(await screen.findByText('warmed up now')).toBeInTheDocument();
      expect(askAssistantStream).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('rate-limit countdown (MEDIUM #15)', () => {
  it('disables Retry with a countdown honoring Retry-After, until it elapses', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      vi.mocked(askAssistantStream).mockRejectedValue(new AskStreamHTTPError(429, 'raw', RATE_LIMITED, 3));
      renderPanel();
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      await user.type(input(), 'q');
      await user.click(screen.getByRole('button', { name: /send question/i }));

      const retryButton = await screen.findByRole('button', { name: /retry in 3s/i });
      expect(retryButton).toBeDisabled();
      await act(() => vi.advanceTimersByTimeAsync(3_100));
      expect(await screen.findByRole('button', { name: 'Retry' })).toBeEnabled();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('empty state suggested questions (LOW #18)', () => {
  it('asks the question immediately when a suggestion is clicked', async () => {
    vi.mocked(askAssistantStream).mockImplementation(streamWith('suggested answer'));
    renderPanel();

    await userEvent.setup().click(screen.getByRole('button', { name: 'What can the assistant help with?' }));

    expect(await screen.findByText('suggested answer')).toBeInTheDocument();
    expect(vi.mocked(askAssistantStream).mock.calls[0][0]).toBe('What can the assistant help with?');
  });

  it('offers how-to-only suggestions to a user without CRM read access', () => {
    hasPermission.mockReturnValue(false);
    renderPanel();

    expect(screen.getByRole('button', { name: 'How do I invite a user?' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'How many leads do I have?' })).not.toBeInTheDocument();
  });
});

describe('copy button (LOW #17)', () => {
  it('copies the answer to the clipboard and shows a confirmation', async () => {
    vi.mocked(askAssistantStream).mockImplementation(streamWith('copy me'));
    renderPanel();
    await ask('q');
    await screen.findByText('copy me');

    // Defined right before use, after ask()'s own userEvent calls: userEvent
    // v14 installs its own clipboard stub on first use, which would
    // otherwise clobber a mock set up earlier in the test. fireEvent (not
    // userEvent) fires the actual click so nothing touches clipboard again.
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    fireEvent.click(screen.getByRole('button', { name: 'Copy answer' }));

    expect(writeText).toHaveBeenCalledWith('copy me');
    expect(await screen.findByRole('button', { name: 'Copied answer to clipboard' })).toBeInTheDocument();
  });
});

describe('new chat / history confirm while streaming (LOW #20)', () => {
  it('asks for confirmation before starting a new chat while an answer is streaming', async () => {
    vi.mocked(askAssistantStream).mockImplementation(() => new Promise(() => {}));
    renderPanel();
    await ask('slow question');

    await userEvent.setup().click(screen.getByRole('button', { name: 'New chat' }));
    expect(screen.getByText(/stop the current answer/i)).toBeInTheDocument();
    expect(screen.getByText('slow question')).toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.queryByText('slow question')).not.toBeInTheDocument();
  });
});

describe('citation chip numbering (MEDIUM #11)', () => {
  it('numbers chips to match their [n] marker and shows the found-sources line while streaming', async () => {
    const help: Citation = { source_type: 'help', source_id: 'leads › Overview', snippet: 'About leads' };
    const customer: Citation = { source_type: 'record', source_id: 'c-4', snippet: 'Globex', record_type: 'customer' };
    vi.mocked(askAssistantStream).mockImplementation(
      streamWith('Globex is active [2].', { sources: [help, customer], citations: [customer] }),
    );
    renderPanel();
    await ask('q');

    expect(await screen.findByText(/Found 2 sources/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open customer: Globex' })).toHaveTextContent('[2]');
  });
});

// A role or tenant/workspace switch re-authenticates MainLayout's session in
// place — this same mounted useAssistantConversation instance keeps running,
// so it must notice from the auth store itself rather than a remount.
describe('identity change clears the conversation (security)', () => {
  it('clears turns and stops reusing the conversation id after a role switch', async () => {
    vi.mocked(askAssistantStream).mockImplementation(streamWith('role A answer'));
    renderPanel();
    await ask('role A question');
    await screen.findByText('role A answer');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('conv-1');

    act(() => {
      useAuthStore.setState((s) => ({ user: s.user && { ...s.user, selectedRoleId: 'role-2' } }));
    });

    expect(screen.queryByText('role A question')).not.toBeInTheDocument();
    expect(screen.queryByText('role A answer')).not.toBeInTheDocument();

    vi.mocked(conversationService.create).mockResolvedValue(conv('conv-2'));
    vi.mocked(askAssistantStream).mockImplementation(streamWith('role B answer'));
    await ask('role B question');
    await screen.findByText('role B answer');

    expect(conversationService.create).toHaveBeenCalledTimes(2);
    expect(vi.mocked(askAssistantStream).mock.calls[1][1]).toBe('conv-2');
    // The old role's own saved conversation is untouched, not overwritten.
    expect(localStorage.getItem(STORAGE_KEY)).toBe('conv-1');
    expect(localStorage.getItem('ai-conversation:t1:u1:role-2')).toBe('conv-2');
  });

  it('clears turns and the conversation id when the tenant changes', async () => {
    vi.mocked(askAssistantStream).mockImplementation(streamWith('tenant A answer'));
    renderPanel();
    await ask('tenant A question');
    await screen.findByText('tenant A answer');

    act(() => {
      useAuthStore.setState((s) => ({ user: s.user && { ...s.user, tenantId: 't2' } }));
    });

    expect(screen.queryByText('tenant A question')).not.toBeInTheDocument();
    expect(screen.queryByText('tenant A answer')).not.toBeInTheDocument();
    // Nothing saved yet for t2, so no load was attempted against it.
    expect(conversationService.get).not.toHaveBeenCalled();

    vi.mocked(conversationService.create).mockResolvedValue(conv('conv-t2'));
    vi.mocked(askAssistantStream).mockImplementation(streamWith('tenant B answer'));
    await ask('tenant B question');

    expect(vi.mocked(askAssistantStream).mock.calls[1][1]).toBe('conv-t2');
  });

  it('clears turns and the conversation id on logout', async () => {
    vi.mocked(askAssistantStream).mockImplementation(streamWith('signed-in answer'));
    renderPanel();
    await ask('signed-in question');
    await screen.findByText('signed-in answer');

    act(() => useAuthStore.setState({ user: null }));

    expect(screen.queryByText('signed-in question')).not.toBeInTheDocument();
  });

  it('aborts an in-flight stream when the identity changes mid-ask', async () => {
    let capturedSignal: AbortSignal | undefined;
    vi.mocked(askAssistantStream).mockImplementation(
      (_q, _c, _h, signal) => {
        capturedSignal = signal;
        return new Promise<void>(() => {});
      },
    );
    renderPanel();
    await ask('slow question');
    await waitFor(() => expect(capturedSignal).toBeDefined());
    expect(capturedSignal!.aborted).toBe(false);

    act(() => {
      useAuthStore.setState((s) => ({ user: s.user && { ...s.user, selectedRoleId: 'role-2' } }));
    });

    expect(capturedSignal!.aborted).toBe(true);
  });
});

describe('background inertness while open (a11y)', () => {
  it('makes #root inert while the panel is mounted and restores it on unmount', () => {
    const root = document.createElement('div');
    root.id = 'root';
    document.body.appendChild(root);
    try {
      const { unmount } = renderPanel();
      expect(root).toHaveAttribute('inert');
      expect(root).toHaveAttribute('aria-hidden', 'true');

      unmount();
      expect(root).not.toHaveAttribute('inert');
      expect(root).not.toHaveAttribute('aria-hidden');
    } finally {
      root.remove();
    }
  });
});

describe('stop-answer confirm accessibility (a11y)', () => {
  it('is an alertdialog with a label, focuses Cancel when it appears, and returns focus to New chat on Cancel', async () => {
    vi.mocked(askAssistantStream).mockImplementation(() => new Promise(() => {}));
    renderPanel();
    await ask('slow question');
    const user = userEvent.setup();
    const newChatButton = screen.getByRole('button', { name: 'New chat' });

    await user.click(newChatButton);
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog.getAttribute('aria-label')).toBeTruthy();
    const cancelButton = within(dialog).getByRole('button', { name: 'Cancel' });
    expect(cancelButton).toHaveFocus();

    await user.click(cancelButton);

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(newChatButton).toHaveFocus();
  });
});

describe('citation marker focus and announcement (a11y)', () => {
  it('focuses the matching chip and announces it when an [n] marker with nowhere to navigate is activated', async () => {
    const help: Citation = { source_type: 'help', source_id: 'leads › Overview', snippet: 'About leads' };
    vi.mocked(askAssistantStream).mockImplementation(streamWith('See [1] for details.', { sources: [help], citations: [help] }));
    renderPanel();
    await ask('q');
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Open source 1' }));

    const chip = screen.getByRole('button', { name: 'Help reference: leads › Overview' });
    await waitFor(() => expect(chip).toHaveFocus());
    expect(screen.getByText('Source 1')).toBeInTheDocument();
  });
});
