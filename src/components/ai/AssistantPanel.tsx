import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Sparkles, X, Send, Square, Loader2, FileText, BookOpen } from 'lucide-react';
import { AskStreamHTTPError, askAssistantStream, conversationService } from '@/services/aiService';
import type { AskStreamHandlers } from '@/services/aiService';
import { apiErrorMessage } from '@/api/tenantClient';
import type { Citation } from '@/types/ai';
import { cn } from '@/lib/utils';

const MAX_QUESTION_LENGTH = 2000;

interface ChatTurn {
  id: string;
  question: string;
  // Accumulated streamed text — grows token by token while `streaming` is
  // true, and holds the final answer once it settles false. undefined until
  // the first token (or the synthetic single-shot token a count-route
  // answer arrives as) lands.
  answer?: string;
  // The cited subset, set only once the stream reaches "done" — never
  // populated while streaming, since which citations were actually
  // referenced isn't known until the full answer can be checked for [n]
  // markers.
  citations?: Citation[];
  // The raw retrieved set from the "sources" event, before generation
  // starts — rendered as a dimmed "found N sources" line, distinct from
  // (and generally a superset of) `citations`.
  sources?: Citation[];
  streaming?: boolean;
  error?: string;
}

/** Best-effort workflowKey resolution from the current route, e.g. /crm/lead/123 -> "lead". */
function resolveWorkflowKeyFromPath(pathname: string): string | null {
  const match = /^\/crm\/([^/]+)/.exec(pathname);
  return match ? match[1] : null;
}

// Streams, transparently recovering from a stale/deleted conversationId: the
// backend 404s a stream against a conversation that no longer exists (or
// isn't the caller's) before writing any SSE byte, so retry once as a
// fresh, conversation-less stream rather than surfacing that as an error the
// user did nothing to cause. Mirrors askWithRetry's non-streaming version.
async function streamAskWithRetry(
  question: string,
  conversationId: string | undefined,
  handlers: AskStreamHandlers,
  signal: AbortSignal,
): Promise<void> {
  try {
    await askAssistantStream(question, conversationId, handlers, signal);
  } catch (err) {
    if (conversationId && err instanceof AskStreamHTTPError && err.status === 404) {
      return askAssistantStream(question, undefined, handlers, signal);
    }
    throw err;
  }
}

function CitationChip({ citation, workflowKey }: { citation: Citation; workflowKey: string | null }) {
  const navigate = useNavigate();
  const isRecord = citation.source_type === 'record';
  const canNavigate = isRecord && Boolean(workflowKey);

  const handleActivate = (): void => {
    if (canNavigate && workflowKey) {
      navigate(`/crm/${workflowKey}/${citation.source_id}`);
    }
  };

  return (
    <button
      type="button"
      onClick={canNavigate ? handleActivate : undefined}
      onKeyDown={(e) => {
        if (canNavigate && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          handleActivate();
        }
      }}
      disabled={!canNavigate}
      aria-label={isRecord ? `Open referenced record ${citation.source_id}` : `Help reference: ${citation.snippet}`}
      title={citation.snippet}
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-2xs font-semibold transition-colors',
        canNavigate
          ? 'cursor-pointer border-brand/30 bg-brand/10 text-brand-dark hover:bg-brand/20'
          : 'cursor-default border-stone-200 bg-stone-100 text-stone-500 dark:border-white/10 dark:bg-white/[0.06] dark:text-stone-400',
      )}
    >
      {isRecord ? <FileText className="size-3 shrink-0" /> : <BookOpen className="size-3 shrink-0" />}
      <span className="truncate">{citation.snippet}</span>
    </button>
  );
}

// Controlled: the trigger lives in HelpMenu now (a "StoneSuite Assistant"
// item in its dropdown, alongside "Support"), so this component is only
// ever mounted while open — `{open && <AssistantPanel onClose />}`.
export function AssistantPanel({ onClose }: { onClose: () => void }): React.JSX.Element {
  const [question, setQuestion] = useState('');
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  // Held across turns (not reset per-ask) so the backend threads this
  // conversation's history into the prompt from the second question on —
  // set once the first successful ask returns one.
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const [isStreaming, setIsStreaming] = useState(false);
  // The in-flight stream's abort handle — Stop calls this directly rather
  // than going through React state, since it must take effect immediately
  // on click, not on the next render.
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const workflowKey = resolveWorkflowKeyFromPath(location.pathname);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [turns]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  // Unmounting mid-stream (panel closed while the assistant is still
  // generating) must not leak the fetch or its reader — the panel is
  // `{open && <AssistantPanel/>}`, so closing genuinely unmounts this
  // component rather than just hiding it.
  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const handleAsk = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    const trimmed = question.trim();
    if (!trimmed || isStreaming) return;

    const turnId = `${Date.now()}`;
    setTurns((prev) => [...prev, { id: turnId, question: trimmed }]);
    setQuestion('');

    // The backend only threads history into an ask that already carries a
    // conversation_id — it never mints one on its own. Create lazily, on
    // the first question asked (not on panel open), so opening the panel
    // and never asking anything doesn't litter an empty conversation. Read
    // the freshly minted id from a local variable, not the conversationId
    // state var: setState here wouldn't be visible to the stream call below
    // in the same tick.
    let activeConversationId = conversationId;
    if (!activeConversationId) {
      try {
        const conversation = await conversationService.create();
        activeConversationId = conversation.id;
        setConversationId(activeConversationId);
      } catch {
        // A conversation-create failure must not block the user from
        // getting an answer — fall through and ask statelessly, same as
        // before this existed.
      }
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setIsStreaming(true);

    const patchTurn = (patch: Partial<ChatTurn>): void => {
      setTurns((prev) => prev.map((t) => (t.id === turnId ? { ...t, ...patch } : t)));
    };

    try {
      await streamAskWithRetry(
        trimmed,
        activeConversationId,
        {
          onSources: (sources) => patchTurn({ sources }),
          onToken: (token) => {
            setTurns((prev) =>
              prev.map((t) => (t.id === turnId ? { ...t, answer: (t.answer ?? '') + token, streaming: true } : t)),
            );
          },
          onDone: ({ result, conversationId: newConversationId }) => {
            setConversationId(newConversationId);
            patchTurn({ answer: result.answer, citations: result.citations, streaming: false });
          },
          onError: (message) => patchTurn({ error: message, streaming: false }),
        },
        controller.signal,
      );
    } catch (err) {
      patchTurn({ error: apiErrorMessage(err, 'The assistant could not answer that.'), streaming: false });
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setIsStreaming(false);
    }
  };

  const handleStop = (): void => {
    abortRef.current?.abort();
    // askAssistantStream resolves silently on an intentional abort (calls
    // neither onDone nor onError), so the in-flight turn is patched here
    // instead — leave whatever partial answer already streamed in place
    // rather than discarding it, since a truncated-but-real answer is more
    // useful than nothing.
    setTurns((prev) =>
      prev.map((t) => (t.streaming ? { ...t, streaming: false, error: t.answer ? undefined : 'Stopped.' } : t)),
    );
  };

  return (
    <div
      role="dialog"
      aria-label="StoneSuite Assistant chat"
      className="fixed top-[4.5rem] right-4 sm:right-6 z-40 flex h-[32rem] w-96 max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#1c1c1c]"
    >
      <div className="flex items-center justify-between gap-2 border-b border-stone-200 px-4 py-3 dark:border-white/10">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-brand" />
          <h2 className="text-sm font-bold text-stone-700 dark:text-stone-200">StoneSuite Assistant</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close AI assistant"
          className="rounded p-1 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600 dark:hover:bg-white/10 dark:hover:text-stone-200"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* min-h-0 overrides this flex item's default min-height:auto — without
          it, a long conversation grows the item to fit every turn instead of
          shrinking to the space under the header, and overflow-y-auto never
          gets a chance to scroll it. */}
      <div ref={scrollRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-3">
        {turns.length === 0 && (
          <p className="text-xs text-stone-500 dark:text-stone-400">
            Ask about a record, workflow, or how to do something in StoneSuite.
          </p>
        )}
        {turns.map((turn) => (
          <div key={turn.id} className="space-y-2">
            <p className="ml-auto max-w-[85%] rounded-2xl bg-brand/10 px-3 py-2 text-xs font-semibold text-stone-700 dark:text-stone-200">
              {turn.question}
            </p>
            {turn.error && (
              <p className="max-w-[85%] rounded-2xl bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {turn.error}
              </p>
            )}
            {!turn.error && turn.answer === undefined && turn.sources && turn.sources.length > 0 && (
              <p className="text-2xs italic text-stone-400 dark:text-stone-500">
                Found {turn.sources.length} source{turn.sources.length === 1 ? '' : 's'}…
              </p>
            )}
            {turn.answer !== undefined && (
              <div className="max-w-[95%] space-y-2">
                <p className="rounded-2xl bg-stone-100 px-3 py-2 text-xs text-stone-700 dark:bg-white/[0.06] dark:text-stone-200">
                  {turn.answer}
                  {turn.streaming && (
                    <span className="ml-0.5 inline-block h-3 w-1 animate-pulse bg-current align-middle" aria-hidden="true" />
                  )}
                </p>
                {turn.citations && turn.citations.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {turn.citations.map((citation, idx) => (
                      <CitationChip
                        key={`${citation.source_type}-${citation.source_id}-${idx}`}
                        citation={citation}
                        workflowKey={workflowKey}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
            {!turn.error && turn.answer === undefined && !turn.sources && (
              <div className="flex items-center gap-2 rounded-2xl bg-stone-100 px-3 py-2 text-xs text-stone-500 dark:bg-white/[0.06] dark:text-stone-400">
                <Loader2 className="size-3.5 animate-spin" />
                Thinking…
              </div>
            )}
          </div>
        ))}
      </div>

      <form onSubmit={handleAsk} className="flex items-center gap-2 border-t border-stone-200 p-3 dark:border-white/10">
        <input
          ref={inputRef}
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          maxLength={MAX_QUESTION_LENGTH}
          placeholder="Ask a question…"
          aria-label="Ask the AI assistant a question"
          disabled={isStreaming}
          className="flex-1 rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs text-stone-700 outline-none focus:border-brand disabled:opacity-60 dark:border-white/10 dark:bg-white/[0.04] dark:text-stone-200"
        />
        {isStreaming ? (
          <button
            type="button"
            onClick={handleStop}
            aria-label="Stop generating"
            className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-stone-200 text-stone-700 transition-colors hover:bg-stone-300 cursor-pointer dark:bg-white/10 dark:text-stone-200 dark:hover:bg-white/20"
          >
            <Square className="size-3.5 fill-current" />
          </button>
        ) : (
          <button
            type="submit"
            disabled={!question.trim()}
            aria-label="Send question"
            className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand text-stone-950 disabled:opacity-40 hover:bg-brand-dark transition-colors cursor-pointer disabled:cursor-not-allowed"
          >
            <Send className="size-4" />
          </button>
        )}
      </form>
    </div>
  );
}
