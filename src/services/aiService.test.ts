import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/api/tenantClient', () => ({
  tenantClient: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
}));

import { tenantClient } from '@/api/tenantClient';
import { aiService, conversationService } from './aiService';

describe('aiService.askAssistant', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sends conversation_id and a >=90s timeout, and returns the conversationId back', async () => {
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
    expect((config as { timeout: number }).timeout).toBeGreaterThanOrEqual(90_000);
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
