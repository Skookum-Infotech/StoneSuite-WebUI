export type CitationSourceType = 'record' | 'help';

export interface Citation {
  source_type: CitationSourceType;
  source_id: string;
  snippet: string;
}

export interface AskResult {
  answer: string;
  citations: Citation[];
}

/** Response envelope for POST /tenant/ai/ask — conversationId is present only
 *  when the ask was made (or started) as part of a conversation. */
export interface AskResponse {
  result: AskResult;
  conversationId?: string;
}

export interface AiConversation {
  id: string;
  ownerUserId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface AiMessage {
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}
