import { memo, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Copy, Loader2, RotateCcw } from 'lucide-react';
import { AssistantMarkdown } from './AssistantMarkdown';
import { citationRoute } from './assistantText';
import { CitationChips, type CitationChipsHandle, type NumberedCitation } from './CitationChips';
import type { ChatTurn } from './useAssistantConversation';

const noteClass = 'text-2xs italic text-stone-400 dark:text-stone-500';
/** After this many seconds still waiting on the first token, swap "Thinking…"
 *  for a cold-start explanation — Ollama can take up to ~60s to load. */
const WARMUP_THRESHOLD_SECONDS = 8;
/** How long the "Copied" state shows before reverting to the copy icon. */
const COPIED_RESET_MS = 1500;

function RetryButton({ onRetry, disabled, countdownSeconds }: { onRetry: () => void; disabled: boolean; countdownSeconds?: number }) {
  return (
    <button
      type="button"
      onClick={onRetry}
      disabled={disabled}
      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-2xs font-semibold text-stone-600 hover:bg-stone-100 disabled:opacity-40 dark:text-stone-300 dark:hover:bg-white/10 cursor-pointer disabled:cursor-not-allowed"
    >
      <RotateCcw className="size-3" aria-hidden="true" />
      {countdownSeconds && countdownSeconds > 0 ? `Retry in ${countdownSeconds}s` : 'Retry'}
    </button>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), COPIED_RESET_MS);
        });
      }}
      aria-label={copied ? 'Copied answer to clipboard' : 'Copy answer'}
      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-2xs font-semibold text-stone-500 hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-white/10 cursor-pointer"
    >
      {copied ? <Check className="size-3" aria-hidden="true" /> : <Copy className="size-3" aria-hidden="true" />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

/** Finds the marker number (1-based position in the turn's raw retrieved
 *  set) a citation corresponds to, so a chip's [n] always matches the answer
 *  text's own [n]. Falls back to the citation's position among its cited
 *  siblings for a turn reloaded from history, which has no `sources`. */
function numberCitations(citations: NonNullable<ChatTurn['citations']>, sources: ChatTurn['sources']): NumberedCitation[] {
  return citations.map((citation, i) => {
    const idx = sources?.findIndex(
      (s) => s.source_type === citation.source_type && s.source_id === citation.source_id && s.snippet === citation.snippet,
    );
    return { citation, n: idx !== undefined && idx !== -1 ? idx + 1 : i + 1 };
  });
}

export const AssistantTurn = memo(function AssistantTurn({
  turn,
  onRetry,
  busy,
}: {
  turn: ChatTurn;
  /** Stable across renders (bind directly to useAssistantConversation's
   *  retry) — an inline arrow here would defeat this component's memo on
   *  every token of an unrelated turn. */
  onRetry: (turnId: string) => void;
  busy: boolean;
}) {
  const navigate = useNavigate();
  const chipsRef = useRef<CitationChipsHandle>(null);
  const pending = turn.answer === undefined && !turn.error && !turn.stopped;

  // Ticks once a second while a first token is pending or a countdown (busy
  // retry, starting_up retry, rate-limit cooldown) is running; idle otherwise.
  const [now, setNow] = useState(() => Date.now());
  const ticking = pending || turn.countdownUntil !== undefined;
  useEffect(() => {
    if (!ticking) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [ticking]);

  const elapsedSeconds = turn.startedAt ? Math.max(0, Math.floor((now - turn.startedAt) / 1000)) : 0;
  const countdownSeconds = turn.countdownUntil ? Math.max(0, Math.ceil((turn.countdownUntil - now) / 1000)) : 0;

  // [n] markers index the retrieved set (sources), in order.
  const routeFor = (n: number): string | null => {
    const source = turn.sources?.[n - 1];
    return source ? citationRoute(source) : null;
  };
  const canOpenCitation = (n: number): boolean => turn.sources?.[n - 1] !== undefined;
  const onOpenCitation = (n: number): void => {
    const route = routeFor(n);
    if (route) navigate(route);
    else chipsRef.current?.scrollToAndHighlight(n);
  };

  const numberedCitations = turn.citations ? numberCitations(turn.citations, turn.sources) : [];
  const retryDisabled = busy || (turn.countdownKind === 'rate_limited' && countdownSeconds > 0);

  return (
    <div className="space-y-2">
      <p className="ml-auto max-w-[85%] whitespace-pre-wrap break-words rounded-2xl bg-brand/10 px-3 py-2 text-xs font-semibold text-stone-700 dark:text-stone-200">
        {turn.question}
      </p>

      {turn.error && (
        <div className="flex max-w-[85%] flex-col items-start gap-1">
          <p role="alert" className="rounded-2xl bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {turn.error}
          </p>
          <RetryButton onRetry={() => onRetry(turn.id)} disabled={retryDisabled} countdownSeconds={turn.countdownKind === 'rate_limited' ? countdownSeconds : undefined} />
        </div>
      )}

      {pending && (
        <>
          <div className="flex items-center gap-2 rounded-2xl bg-stone-100 px-3 py-2 text-xs text-stone-500 dark:bg-white/[0.06] dark:text-stone-400">
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            <span>
              {turn.waiting
                ? turn.countdownKind === 'starting_up'
                  ? `The assistant is starting up — retrying in ${countdownSeconds}s…`
                  : 'The assistant is busy — retrying in a moment…'
                : turn.sources && turn.sources.length > 0
                  ? `Found ${turn.sources.length} source${turn.sources.length === 1 ? '' : 's'} — thinking…`
                  : elapsedSeconds >= WARMUP_THRESHOLD_SECONDS
                    ? 'Warming up the assistant — the first answer can take up to a minute.'
                    : 'Thinking…'}
            </span>
          </div>
          <span className="sr-only" role="status" aria-live="polite">Thinking…</span>
        </>
      )}

      {turn.answer !== undefined && (
        <div className="max-w-[95%] space-y-2">
          {turn.sources && turn.sources.length > 0 && (
            <p className={noteClass}>Found {turn.sources.length} source{turn.sources.length === 1 ? '' : 's'}</p>
          )}
          <div
            aria-busy={turn.streaming}
            className="rounded-2xl bg-stone-100 px-3 py-2 text-xs text-stone-700 dark:bg-white/[0.06] dark:text-stone-200"
          >
            <AssistantMarkdown text={turn.answer} canOpenCitation={canOpenCitation} onOpenCitation={onOpenCitation} />
            {turn.streaming && (
              <span className="ml-0.5 inline-block h-3 w-1 animate-pulse bg-current align-middle" aria-hidden="true" />
            )}
          </div>
          {/* Announces the finished answer once, politely — the bubble above
              isn't itself a live region, so mid-stream tokens don't spam
              assistive tech with a rewrite on every chunk. Prefixed so it
              never collides with the visible bubble's own exact text. */}
          {!turn.streaming && (
            <span className="sr-only" role="status" aria-live="polite">New answer: {turn.answer}</span>
          )}
          {numberedCitations.length > 0 && <CitationChips ref={chipsRef} items={numberedCitations} />}
          {turn.truncated && <p className={noteClass}>This answer was cut short — ask a narrower question for the rest.</p>}
          {!turn.streaming && !turn.stopped && turn.saved === false && (
            <p className={noteClass}>Not saved to this conversation, so follow-up questions won't see it.</p>
          )}
          {!turn.streaming && turn.answer && <CopyButton text={turn.answer} />}
        </div>
      )}

      {turn.stopped && (
        <div className="flex items-center gap-2">
          <p className={noteClass}>
            {turn.answer === undefined ? 'Stopped.' : 'Stopped — partial answer, not saved to this conversation.'}
          </p>
          <RetryButton onRetry={() => onRetry(turn.id)} disabled={busy} />
        </div>
      )}
    </div>
  );
});
