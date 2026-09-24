export type CitationSourceType = 'record' | 'help';

/** CRM record types a record citation can point at — each is also the
 *  /crm/<type>/:id route segment. */
export type CitationRecordType = 'lead' | 'prospect' | 'customer';

export interface Citation {
  source_type: CitationSourceType;
  /** Omitted by the backend when empty. For a record, its id; for help, a
   *  "<doc> › <section>" label. */
  source_id?: string;
  snippet: string;
  /** Set on record citations — which CRM type the record is, so a chip can
   *  link to it. Absent on help citations (and on records indexed before
   *  the backend tracked it), which then render unlinked. */
  record_type?: CitationRecordType;
}

export interface AskResult {
  answer: string;
  citations: Citation[];
  /** The answer hit the model's output cap and may end mid-sentence. */
  truncated?: boolean;
}

/** The terminal "done" payload of a streamed ask. conversationId/persisted
 *  are present only when the ask was part of a conversation. */
export interface AskResponse {
  result: AskResult;
  conversationId?: string;
  /** false when the answer arrived but couldn't be saved to the
   *  conversation's history. */
  persisted?: boolean;
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

/** Whether the StoneSuite Assistant is reachable for the caller's tenant —
 *  `available` is the AND of the platform master switch and the tenant's own
 *  switch, exactly the condition the ask endpoints enforce server-side. */
export interface AIStatus {
  platformEnabled: boolean;
  tenantEnabled: boolean;
  available: boolean;
}

/** Self-hosted Ollama's coarse run state across however many Fly machines
 *  are leased for it — "mixed" when some are up and some aren't. */
export type OllamaState = 'started' | 'stopped' | 'mixed' | 'unknown';

/** Platform-admin view of the assistant's global master switch. */
export interface PlatformAISettings {
  enabled: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
  helpCorpusSyncedAt: string | null;
  ollamaState?: OllamaState;
  /** Other tenants currently holding a warm-model lease on the same Ollama
   *  instance — populated only when non-empty. */
  leaseHolders?: string[];
}
