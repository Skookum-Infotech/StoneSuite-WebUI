import { useCallback, useEffect, useRef, useState } from 'react';
import { isAxiosError } from 'axios';
import {
  ASSISTANT_BUSY,
  AskStreamHTTPError,
  askAssistantStream,
  conversationService,
  friendlyAskError,
} from '@/services/aiService';
import type { AskStreamHandlers } from '@/services/aiService';
import { useAuthStore } from '@/store/useAuthStore';
import type { AiMessage, Citation } from '@/types/ai';

export interface ChatTurn {
  id: string;
  question: string;
  /** Accumulated streamed text; undefined until the first token lands. */
  answer?: string;
  /** The cited subset — set only on "done", once [n] markers can be checked. */
  citations?: Citation[];
  /** The raw retrieved set from "sources", in [n] order (marker n is
   *  sources[n-1]). Absent for turns reloaded from history. */
  sources?: Citation[];
  streaming?: boolean;
  /** Waiting on a busy model slot before retrying. */
  waiting?: boolean;
  error?: string;
  /** Stopped by the user; whatever streamed so far stays visible. */
  stopped?: boolean;
  truncated?: boolean;
  /** false when this turn is not in the saved conversation history (stopped,
   *  errored, or the save failed) — a follow-up question won't see it. */
  saved?: boolean;
}

/** Default wait before retrying a busy 429 that carried no Retry-After. */
const DEFAULT_BUSY_RETRY_SECONDS = 5;

function storageKey(): string | null {
  const { user } = useAuthStore.getState();
  if (!user?.id) return null;
  return `ai-conversation:${user.tenantId ?? ''}:${user.id}`;
}

// localStorage is a per-viewer convenience here (which conversation to
// reopen); the server is the source of truth, so every access tolerates the
// storage being unavailable.
function loadStoredConversationId(): string | undefined {
  const key = storageKey();
  if (!key) return undefined;
  try {
    return localStorage.getItem(key) ?? undefined;
  } catch {
    return undefined;
  }
}

function storeConversationId(id: string | undefined): void {
  const key = storageKey();
  if (!key) return;
  try {
    if (id) localStorage.setItem(key, id);
    else localStorage.removeItem(key);
  } catch {
    // Storage unavailable (private mode, blocked) — the conversation still
    // works for this session, it just won't reopen after a reload.
  }
}

/** Rebuilds display turns from a stored transcript (user/assistant pairs). */
export function turnsFromMessages(messages: AiMessage[]): ChatTurn[] {
  const turns: ChatTurn[] = [];
  for (const m of messages) {
    if (m.role === 'user') {
      turns.push({ id: crypto.randomUUID(), question: m.content, saved: true });
    } else {
      const last = turns[turns.length - 1];
      if (last && last.answer === undefined) last.answer = m.content;
    }
  }
  return turns;
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => {
      clearTimeout(timer);
      resolve();
    }, { once: true });
  });
}

/** Owns one assistant conversation: its turns, the in-flight stream, and the
 *  conversation id the backend threads history through — persisted per user
 *  so closing the panel or reloading the page reopens the same conversation. */
export function useAssistantConversation() {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [conversationId, setConversationIdState] = useState<string | undefined>(loadStoredConversationId);
  const [isBusy, setIsBusy] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  // Synchronous guard against a double submit: isBusy only updates on the
  // next render, but a second Enter can land before that.
  const busyRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const conversationIdRef = useRef(conversationId);

  const setConversationId = useCallback((id: string | undefined) => {
    conversationIdRef.current = id;
    setConversationIdState(id);
    storeConversationId(id);
  }, []);

  const patchTurn = useCallback((id: string, patch: Partial<ChatTurn> | ((t: ChatTurn) => Partial<ChatTurn>)) => {
    setTurns((prev) => prev.map((t) => (t.id === id ? { ...t, ...(typeof patch === 'function' ? patch(t) : patch) } : t)));
  }, []);

  const openConversation = useCallback(async (id: string): Promise<void> => {
    abortRef.current?.abort();
    setIsLoading(true);
    try {
      const { messages } = await conversationService.get(id);
      setConversationId(id);
      setTurns(turnsFromMessages(messages));
    } catch (err) {
      // Gone (deleted, retention) or not ours: forget it and start fresh.
      if (isAxiosError(err) && err.response?.status === 404) {
        setConversationId(undefined);
        setTurns([]);
      }
    } finally {
      setIsLoading(false);
    }
  }, [setConversationId]);

  // Reopen the remembered conversation once, on mount.
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    const stored = conversationIdRef.current;
    if (stored) void openConversation(stored);
  }, [openConversation]);

  // Unmounting mid-stream must not leak the fetch or its reader.
  useEffect(() => () => abortRef.current?.abort(), []);

  const newChat = useCallback((): void => {
    abortRef.current?.abort();
    setConversationId(undefined);
    setTurns([]);
  }, [setConversationId]);

  const ensureConversation = async (): Promise<string | undefined> => {
    if (conversationIdRef.current) return conversationIdRef.current;
    try {
      const conversation = await conversationService.create();
      setConversationId(conversation.id);
      return conversation.id;
    } catch {
      // Answering matters more than remembering: ask statelessly.
      return undefined;
    }
  };

  const runTurn = async (turnId: string, question: string): Promise<void> => {
    const controller = new AbortController();
    abortRef.current = controller;
    const { signal } = controller;

    const handlers: AskStreamHandlers = {
      onSources: (sources) => patchTurn(turnId, { sources, waiting: false }),
      onToken: (token) => patchTurn(turnId, (t) => ({ answer: (t.answer ?? '') + token, streaming: true, waiting: false })),
      onDone: ({ result, conversationId: returnedId, persisted }) => {
        if (returnedId) setConversationId(returnedId);
        patchTurn(turnId, {
          answer: result.answer,
          citations: result.citations,
          truncated: result.truncated,
          streaming: false,
          saved: returnedId ? persisted !== false : false,
        });
      },
      onError: (message) => patchTurn(turnId, { error: message, streaming: false, saved: false }),
    };

    let conversationId = await ensureConversation();
    let recoveredConversation = false;
    let retriedBusy = false;
    for (;;) {
      if (signal.aborted) break;
      try {
        await askAssistantStream(question, conversationId, handlers, signal);
        break;
      } catch (err) {
        if (err instanceof AskStreamHTTPError && err.status === 404 && conversationId && !recoveredConversation) {
          // The conversation was deleted (another tab, retention): start a
          // new one instead of 404ing on every later question.
          recoveredConversation = true;
          setConversationId(undefined);
          conversationId = await ensureConversation();
          continue;
        }
        if (err instanceof AskStreamHTTPError && err.code === ASSISTANT_BUSY && !retriedBusy) {
          retriedBusy = true;
          patchTurn(turnId, { waiting: true });
          await sleep((err.retryAfter ?? DEFAULT_BUSY_RETRY_SECONDS) * 1000, signal);
          continue;
        }
        patchTurn(turnId, { error: friendlyAskError(err), streaming: false, waiting: false, saved: false });
        break;
      }
    }

    if (signal.aborted) {
      // Stop pressed (possibly before the first token): settle the turn by
      // id — the stream resolves without calling either handler on abort.
      patchTurn(turnId, (t) => (t.streaming || (t.answer === undefined && !t.error)
        ? { streaming: false, waiting: false, stopped: true, saved: false }
        : {}));
    }
    if (abortRef.current === controller) abortRef.current = null;
  };

  const ask = async (question: string): Promise<void> => {
    const trimmed = question.trim();
    if (!trimmed || busyRef.current) return;
    busyRef.current = true;
    setIsBusy(true);
    const turnId = crypto.randomUUID();
    setTurns((prev) => [...prev, { id: turnId, question: trimmed }]);
    try {
      await runTurn(turnId, trimmed);
    } finally {
      busyRef.current = false;
      setIsBusy(false);
    }
  };

  /** Re-asks an errored or stopped turn in place. */
  const retry = async (turnId: string): Promise<void> => {
    const turn = turns.find((t) => t.id === turnId);
    if (!turn || busyRef.current) return;
    busyRef.current = true;
    setIsBusy(true);
    setTurns((prev) => prev.map((t) => (t.id === turnId ? { id: t.id, question: t.question } : t)));
    try {
      await runTurn(turnId, turn.question);
    } finally {
      busyRef.current = false;
      setIsBusy(false);
    }
  };

  const stop = (): void => {
    abortRef.current?.abort();
  };

  return { turns, conversationId, isBusy, isLoading, ask, retry, stop, newChat, openConversation };
}
