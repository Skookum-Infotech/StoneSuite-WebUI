import { tenantClient } from '@/api/tenantClient';
import type { AiConversation, AiMessage, AskResponse, AskResult } from '@/types/ai';

// The full-RAG path (embed -> retrieve -> optional rerank -> generate) can
// run long on a cold Ollama model — matches the backend's write timeout for
// /ai/ask (see docs/ai-assistant.md).
const ASK_TIMEOUT_MS = 90_000;

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
