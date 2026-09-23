import { describe, it, expect, vi, beforeEach } from 'vitest';
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

vi.mock('@/services/aiService', async (importOriginal) => ({
  ...(await importOriginal<typeof AiServiceModule>()),
  askAssistantStream: vi.fn(),
  conversationService: { create: vi.fn(), list: vi.fn(), get: vi.fn(), remove: vi.fn() },
}));

const hasPermission = vi.fn<(resource: string, action: string) => boolean>();
vi.mock('@/hooks/useUserPermissions', () => ({
  useUserPermissions: () => ({ hasPermission, grants: [], isLoading: false, activeRoleId: '' }),
}));

import { AssistantPanel } from './AssistantPanel';
import { askAssistantStream, AskStreamHTTPError, conversationService } from '@/services/aiService';
import { useAuthStore } from '@/store/useAuthStore';

const STORAGE_KEY = 'ai-conversation:t1:u1';

function conv(id: string, title = ''): AiConversation {
  return { id, ownerUserId: 'u1', title, createdAt: '', updatedAt: new Date().toISOString() };
}

function LocationProbe() {
  return <div data-testid="location">{useLocation().pathname}</div>;
}

function renderPanel(onClose = vi.fn(), initialPath = '/crm/prospect/p-1') {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[initialPath]}>
      {children}
      <LocationProbe />
    </MemoryRouter>
  );
  return { onClose, ...render(<AssistantPanel onClose={onClose} />, { wrapper }) };
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
