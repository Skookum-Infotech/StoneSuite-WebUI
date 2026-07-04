import { tenantClient } from '@/api/tenantClient';
import type { AskResult } from '@/types/ai';

export const aiService = {
  askAssistant: (question: string): Promise<AskResult> =>
    tenantClient
      .post<{ success: boolean; data: AskResult }>('/tenant/ai/ask', { question })
      .then((r) => r.data.data),
};
