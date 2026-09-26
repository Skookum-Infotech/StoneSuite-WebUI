import { useCallback, useEffect, useRef, useState } from 'react';
import { isAxiosError } from 'axios';
import { queryClient } from '@/lib/queryClient';
import {
  ASSISTANT_BUSY,
  ASSISTANT_DISABLED,
  RATE_LIMITED,
  STARTING_UP,
  AskStreamHTTPError,
  askAssistantStream,
  conversationService,
  friendlyAskError,
} from '@/services/aiService';
import type { AskStreamHandlers } from '@/services/aiService';
import { useAuthStore } from '@/store/useAuthStore';
import type { AiMessage, Citation } from '@/types/ai';
import type { UserProfile } from '@/types/auth';

export interface ChatTurn {
  id: string;
  question: string;
  /** Accumulated streamed text; undefined until the first token lands. */
  answer?: string;
  /** The cited subset — set only on "done", once [n] markers can be checked,
   *  or when reloaded from a saved conversation's history. */
  citations?: Citation[];
  /** The raw retrieved set from "sources", in [n] order (marker n is
   *  sources[n-1]). Absent for turns reloaded from history. */
  sources?: Citation[];
  streaming?: boolean;
  /** Waiting on a busy model slot, or a starting_up retry, before retrying. */
  waiting?: boolean;
  error?: string;
  /** Stopped by the user; whatever streamed so far stays visible. */
  stopped?: boolean;
  truncated?: boolean;
  /** false when this turn is not in the saved conversation history (stopped,
   *  errored, or the save failed) — a follow-up question won't see it. */
  saved?: boolean;
  /** When this turn started waiting on an answer — drives the elapsed-time
   *  cold-start hint and countdown displays. */
  startedAt?: number;
  /** Epoch ms a running countdown (starting_up auto-retry, rate-limit
   *  cooldown) resolves at. */
  countdownUntil?: number;
  /** What countdownUntil is for: 'starting_up' auto-retries once it elapses;
   *  'rate_limited' just re-enables the Retry button. */
  countdownKind?: 'starting_up' | 'rate_limited';
}

/** Default wait before retrying a busy 429 that carried no Retry-After. */
const DEFAULT_BUSY_RETRY_SECONDS = 5;
/** How long to wait before the one automatic retry of a "starting_up" SSE
 *  error (Ollama still cold-starting). */
const STARTING_UP_RETRY_MS = 10_000;

/** Who is actually signed in right now, for keying both the in-memory
 *  conversation and its localStorage slot: tenant + user + active role
 *  together. A MainLayout role switch or a portal workspace switch
 *  re-authenticates in place (same mounted HelpMenu, same hook instance) —
 *  this is what lets the identity-change effect below notice and reset,
 *  instead of the hook quietly keeping the previous identity's turns and
 *  conversationId and posting the next question against them. */
function identityKeyOf(user: UserProfile | null, activeTenantId: string | null): string | null {
  if (!user?.id) return null;
  const tenantId = user.tenantId ?? activeTenantId ?? '';
  return `${tenantId}:${user.id}:${user.selectedRoleId ?? ''}`;
}

function storageKeyFor(identity: string | null): string | null {
  return identity ? `ai-conversation:${identity}` : null;
}

// localStorage is a per-viewer convenience here (which conversation to
// reopen); the server is the source of truth, so every access tolerates the
// storage being unavailable.
function loadStoredConversationId(identity: string | null): string | undefined {
  const key = storageKeyFor(identity);
  if (!key) return undefined;
  try {
    return localStorage.getItem(key) ?? undefined;
  } catch {
    return undefined;
  }
}

function storeConversationId(identity: string | null, id: string | undefined): void {
  const key = storageKeyFor(identity);
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
      if (last && last.answer === undefined) {
        last.answer = m.content;
        if (m.citations) last.citations = m.citations;
      }
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
 *  so closing the panel or reloading the page reopens the same conversation.
 *  Meant to be instantiated once by a component that outlives the chat
 *  panel's own open/close (HelpMenu) so an in-flight answer survives the
 *  panel closing. */
export function useAssistantConversation() {
  // Reactive — unlike a one-time getState() read, this re-renders (and lets
  // the identity-change effect below fire) the moment a role switch or
  // workspace switch re-authenticates this same mounted hook instance.
  const identity = useAuthStore((s) => identityKeyOf(s.user, s.activeTenantId));
  const identityRef = useRef(identity);

  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [conversationId, setConversationIdState] = useState<string | undefined>(() => loadStoredConversationId(identity));
  const [draft, setDraft] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Synchronous guard against a double submit: isBusy only updates on the
  // next render, but a second Enter can land before that.
  const busyRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const conversationIdRef = useRef(conversationId);
  const turnsRef = useRef<ChatTurn[]>(turns);
  // The id a load failed for, kept only so Retry knows what to re-attempt —
  // distinct from conversationId, which is cleared on a failed initial
  // restore so the panel doesn't keep presenting a conversation it couldn't
  // confirm still exists.
  const failedLoadIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    turnsRef.current = turns;
  }, [turns]);

  const setConversationId = useCallback((id: string | undefined) => {
    conversationIdRef.current = id;
    setConversationIdState(id);
    storeConversationId(identityRef.current, id);
  }, []);

  const patchTurn = useCallback((id: string, patch: Partial<ChatTurn> | ((t: ChatTurn) => Partial<ChatTurn>)) => {
    setTurns((prev) => prev.map((t) => (t.id === id ? { ...t, ...(typeof patch === 'function' ? patch(t) : patch) } : t)));
  }, []);

  const openConversation = useCallback(async (id: string, opts?: { isInitialRestore?: boolean }): Promise<void> => {
    // Captured so a slow GET that resolves after a tenant/role switch can't
    // land the previous identity's transcript on top of the new one's —
    // discarded below instead of applied.
    const requestIdentity = identityRef.current;
    abortRef.current?.abort();
    setIsLoading(true);
    setLoadError(null);
    try {
      const { messages } = await conversationService.get(id);
      if (identityRef.current !== requestIdentity) return;
      failedLoadIdRef.current = undefined;
      setConversationId(id);
      setTurns(turnsFromMessages(messages));
    } catch (err) {
      if (identityRef.current !== requestIdentity) return;
      // Gone (deleted, retention) or not ours: forget it and start fresh.
      if (isAxiosError(err) && err.response?.status === 404) {
        failedLoadIdRef.current = undefined;
        setConversationId(undefined);
        setTurns([]);
      } else {
        failedLoadIdRef.current = id;
        setLoadError("Couldn't load that conversation. Please try again.");
        // Don't keep presenting a conversation we couldn't confirm as
        // "current" — clearing it (and its persisted id) stops every future
        // mount from silently retrying the same failure. Retry this session
        // still works via failedLoadIdRef.
        if (opts?.isInitialRestore) setConversationId(undefined);
      }
    } finally {
      if (identityRef.current === requestIdentity) setIsLoading(false);
    }
  }, [setConversationId]);

  const retryLoad = useCallback((): void => {
    if (failedLoadIdRef.current) void openConversation(failedLoadIdRef.current);
  }, [openConversation]);

  // Reopen the remembered conversation once, on mount.
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    const stored = conversationIdRef.current;
    if (stored) void openConversation(stored, { isInitialRestore: true });
  }, [openConversation]);

  // The security fix this hook exists for: HelpMenu instantiates this hook
  // once and it lives for the whole session, but MainLayout's switch-role
  // and switch-workspace handlers re-authenticate *in place* — no remount.
  // Left alone, the hook would keep the previous identity's turns and
  // conversationId and post the next question against the old tenant's
  // conversation. `identity` is skipped on mount (already handled by the
  // restore effect above); every change after that means the caller is now
  // someone else — abort whatever was in flight, forget everything about
  // who we were, and pick back up wherever (if anywhere) the new identity
  // left off.
  // Only sets state directly (no nested setState-via-function-call) so this
  // stays the "one direct synchronization" react-hooks/set-state-in-effect
  // wants — the actual restore fetch is a separate effect below, the same
  // split the mount-restore effect above already uses.
  const pendingRestoreRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (identity === identityRef.current) return;
    identityRef.current = identity;

    abortRef.current?.abort();
    abortRef.current = null;
    busyRef.current = false;
    setIsBusy(false);
    setTurns([]);
    setDraft('');
    setLoadError(null);
    failedLoadIdRef.current = undefined;

    const stored = loadStoredConversationId(identity);
    conversationIdRef.current = stored;
    setConversationIdState(stored);
    pendingRestoreRef.current = stored;
  }, [identity]);

  useEffect(() => {
    const pending = pendingRestoreRef.current;
    pendingRestoreRef.current = undefined;
    if (pending) void openConversation(pending, { isInitialRestore: true });
  }, [identity, openConversation]);

  // Unmounting mid-stream must not leak the fetch or its reader. This hook
  // is meant to live in a component that outlives the chat panel, so this
  // only fires when that owner itself unmounts (session end / logout), not
  // on a mere panel close.
  useEffect(() => () => abortRef.current?.abort(), []);

  const newChat = useCallback((): void => {
    abortRef.current?.abort();
    setConversationId(undefined);
    setTurns([]);
    setLoadError(null);
  }, [setConversationId]);

  /** Resolves the conversation id to ask against, creating one if needed.
   *  Checks `signal` after the create() await: if New chat or opening a
   *  different conversation happened while this was in flight, the same
   *  controller was aborted and the now-stale created id must not clobber
   *  whatever the newer action already set. */
  const ensureConversation = useCallback(async (signal: AbortSignal): Promise<string | undefined> => {
    if (conversationIdRef.current) return conversationIdRef.current;
    try {
      const conversation = await conversationService.create();
      if (signal.aborted) return conversationIdRef.current;
      setConversationId(conversation.id);
      return conversation.id;
    } catch {
      // Answering matters more than remembering: ask statelessly.
      return undefined;
    }
  }, [setConversationId]);

  const runTurn = useCallback(async (turnId: string, question: string): Promise<void> => {
    const controller = new AbortController();
    abortRef.current = controller;
    const { signal } = controller;

    let lastErrorCode: string | undefined;

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
          waiting: false,
          countdownKind: undefined,
          countdownUntil: undefined,
          saved: returnedId ? persisted !== false : false,
        });
      },
      onError: (message, code) => {
        lastErrorCode = code;
        patchTurn(turnId, { error: message, streaming: false, saved: false, countdownKind: undefined, countdownUntil: undefined });
      },
    };

    let conversationId = await ensureConversation(signal);
    let recoveredConversation = false;
    let retriedBusy = false;
    let retriedStartingUp = false;
    for (;;) {
      if (signal.aborted) break;
      lastErrorCode = undefined;
      try {
        await askAssistantStream(question, conversationId, handlers, signal);
        if (lastErrorCode === STARTING_UP && !retriedStartingUp && !signal.aborted) {
          // The model is still cold-starting: one silent auto-retry after a
          // shown countdown, same idea as the assistant_busy retry below.
          retriedStartingUp = true;
          patchTurn(turnId, {
            error: undefined,
            waiting: true,
            countdownKind: 'starting_up',
            countdownUntil: Date.now() + STARTING_UP_RETRY_MS,
          });
          await sleep(STARTING_UP_RETRY_MS, signal);
          patchTurn(turnId, { countdownKind: undefined, countdownUntil: undefined });
          continue;
        }
        break;
      } catch (err) {
        if (err instanceof AskStreamHTTPError && err.status === 404 && conversationId && !recoveredConversation) {
          // The conversation was deleted (another tab, retention): start a
          // new one instead of 404ing on every later question.
          recoveredConversation = true;
          setConversationId(undefined);
          conversationId = await ensureConversation(signal);
          continue;
        }
        if (err instanceof AskStreamHTTPError && err.code === ASSISTANT_BUSY && !retriedBusy) {
          retriedBusy = true;
          patchTurn(turnId, { waiting: true });
          await sleep((err.retryAfter ?? DEFAULT_BUSY_RETRY_SECONDS) * 1000, signal);
          continue;
        }
        // A 403 assistant_disabled is not a busy 429 — never retried, and
        // the cached ['ai-status'] is stale (a switch flipped since the Help
        // menu last fetched it), so refresh it to hide the entry/update the
        // settings toggle instead of leaving a now-wrong "on" behind.
        if (err instanceof AskStreamHTTPError && err.code === ASSISTANT_DISABLED) {
          void queryClient.invalidateQueries({ queryKey: ['ai-status'] });
        }
        // A rate-limited 429 is never auto-retried, but Retry stays disabled
        // for the server's own cooldown when it told us one.
        const rateLimitCountdown = err instanceof AskStreamHTTPError && err.code === RATE_LIMITED && err.retryAfter
          ? { countdownKind: 'rate_limited' as const, countdownUntil: Date.now() + err.retryAfter * 1000 }
          : {};
        patchTurn(turnId, { error: friendlyAskError(err), streaming: false, waiting: false, saved: false, ...rateLimitCountdown });
        break;
      }
    }

    if (signal.aborted) {
      // Stop pressed (possibly before the first token): settle the turn by
      // id — the stream resolves without calling either handler on abort.
      patchTurn(turnId, (t) => (t.streaming || (t.answer === undefined && !t.error)
        ? { streaming: false, waiting: false, stopped: true, saved: false, countdownKind: undefined, countdownUntil: undefined }
        : {}));
    }
    if (abortRef.current === controller) abortRef.current = null;
  }, [ensureConversation, patchTurn, setConversationId]);

  const ask = useCallback(async (question: string): Promise<void> => {
    const trimmed = question.trim();
    if (!trimmed || busyRef.current) return;
    busyRef.current = true;
    setIsBusy(true);
    const turnId = crypto.randomUUID();
    setTurns((prev) => [...prev, { id: turnId, question: trimmed, startedAt: Date.now() }]);
    try {
      await runTurn(turnId, trimmed);
    } finally {
      busyRef.current = false;
      setIsBusy(false);
    }
  }, [runTurn]);

  /** Re-asks an errored or stopped turn, moved to the end of the thread —
   *  matching how a real follow-up would land, and keeping the transcript in
   *  the order questions were actually answered. */
  const retry = useCallback(async (turnId: string): Promise<void> => {
    const turn = turnsRef.current.find((t) => t.id === turnId);
    if (!turn || busyRef.current) return;
    busyRef.current = true;
    setIsBusy(true);
    setTurns((prev) => [...prev.filter((t) => t.id !== turnId), { id: turn.id, question: turn.question, startedAt: Date.now() }]);
    try {
      await runTurn(turnId, turn.question);
    } finally {
      busyRef.current = false;
      setIsBusy(false);
    }
  }, [runTurn]);

  const stop = useCallback((): void => {
    abortRef.current?.abort();
  }, []);

  return { turns, conversationId, isBusy, isLoading, loadError, draft, setDraft, ask, retry, stop, newChat, openConversation, retryLoad };
}

/** The hook's return shape — the type AssistantPanel and HelpMenu pass
 *  around, since the hook itself is meant to be instantiated once, above
 *  where the chat panel opens and closes. */
export type AssistantConversation = ReturnType<typeof useAssistantConversation>;
