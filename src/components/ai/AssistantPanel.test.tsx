import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';

// jsdom doesn't implement Element.scrollTo — AssistantPanel's auto-scroll
// effect calls it on every turns[] change, which would otherwise throw and
// fail every test here regardless of what's actually under test.
Element.prototype.scrollTo = vi.fn();

vi.mock('@/services/aiService', () => ({
  aiService: { askAssistant: vi.fn() },
  conversationService: { create: vi.fn(), list: vi.fn(), get: vi.fn(), remove: vi.fn() },
}));

import { AssistantPanel } from './AssistantPanel';
import { aiService, conversationService } from '@/services/aiService';

function renderPanel() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
  return render(<AssistantPanel onClose={vi.fn()} />, { wrapper });
}

async function ask(question: string): Promise<void> {
  const user = userEvent.setup();
  await user.type(screen.getByRole('textbox', { name: /ask the ai assistant/i }), question);
  await user.click(screen.getByRole('button', { name: /send question/i }));
}

beforeEach(() => vi.clearAllMocks());

describe('AssistantPanel conversation wiring', () => {
  // Regression test for the AI assistant's multi-turn history never
  // activating: the backend only threads history into an ask that already
  // carries a conversation_id, and never mints one on its own. Before this
  // fix, conversationId's only writer was askAssistant's own response, which
  // is always undefined on a stateless first call -- so it stayed undefined
  // forever and every turn (however many the user sent) went out stateless.
  it('creates a conversation before the first ask and reuses it for every later ask', async () => {
    vi.mocked(conversationService.create).mockResolvedValue({
      id: 'conv-1',
      ownerUserId: 'u1',
      title: '',
      createdAt: '',
      updatedAt: '',
    });
    vi.mocked(aiService.askAssistant).mockImplementation(async (_q, conversationId) => ({
      result: { answer: 'first answer', citations: [] },
      conversationId,
    }));

    renderPanel();

    await ask('how many leads do we have?');
    await waitFor(() => expect(aiService.askAssistant).toHaveBeenCalledTimes(1));
    expect(conversationService.create).toHaveBeenCalledTimes(1);
    expect(aiService.askAssistant).toHaveBeenNthCalledWith(1, 'how many leads do we have?', 'conv-1');
    await screen.findByText('first answer');

    await ask('what about last month?');
    await waitFor(() => expect(aiService.askAssistant).toHaveBeenCalledTimes(2));
    expect(conversationService.create).toHaveBeenCalledTimes(1); // not called again
    expect(aiService.askAssistant).toHaveBeenNthCalledWith(2, 'what about last month?', 'conv-1');
  });

  it('still asks (statelessly) if conversation creation itself fails', async () => {
    vi.mocked(conversationService.create).mockRejectedValue(new Error('boom'));
    vi.mocked(aiService.askAssistant).mockResolvedValue({
      result: { answer: 'answered anyway', citations: [] },
    });

    renderPanel();
    await ask('quick question');

    await waitFor(() => expect(aiService.askAssistant).toHaveBeenCalledTimes(1));
    expect(aiService.askAssistant).toHaveBeenCalledWith('quick question', undefined);
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
    vi.mocked(aiService.askAssistant).mockResolvedValue({
      result: { answer: 'ok', citations: [] },
      conversationId: 'conv-2',
    });

    renderPanel();
    await ask('one');
    await waitFor(() => expect(aiService.askAssistant).toHaveBeenCalledTimes(1));
    await screen.findByText('ok');

    await ask('two');
    await waitFor(() => expect(aiService.askAssistant).toHaveBeenCalledTimes(2));
    expect(conversationService.create).toHaveBeenCalledTimes(1);
    expect(aiService.askAssistant).toHaveBeenNthCalledWith(2, 'two', 'conv-2');
  });
});
