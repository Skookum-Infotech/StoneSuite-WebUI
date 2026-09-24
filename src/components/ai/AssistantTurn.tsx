import { useNavigate } from 'react-router-dom';
import { Loader2, RotateCcw } from 'lucide-react';
import { AssistantMarkdown } from './AssistantMarkdown';
import { citationRoute } from './assistantText';
import { CitationChips } from './CitationChips';
import type { ChatTurn } from './useAssistantConversation';

const noteClass = 'text-2xs italic text-stone-400 dark:text-stone-500';

function RetryButton({ onRetry, disabled }: { onRetry: () => void; disabled: boolean }) {
  return (
    <button
      type="button"
      onClick={onRetry}
      disabled={disabled}
      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-2xs font-semibold text-stone-600 hover:bg-stone-100 disabled:opacity-40 dark:text-stone-300 dark:hover:bg-white/10 cursor-pointer disabled:cursor-not-allowed"
    >
      <RotateCcw className="size-3" aria-hidden="true" />
      Retry
    </button>
  );
}

export function AssistantTurn({ turn, onRetry, busy }: { turn: ChatTurn; onRetry: () => void; busy: boolean }) {
  const navigate = useNavigate();
  // [n] markers index the retrieved set (sources), in order.
  const routeFor = (n: number): string | null => {
    const source = turn.sources?.[n - 1];
    return source ? citationRoute(source) : null;
  };
  const pending = turn.answer === undefined && !turn.error && !turn.stopped;

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
          <RetryButton onRetry={onRetry} disabled={busy} />
        </div>
      )}

      {pending && (
        <div className="flex items-center gap-2 rounded-2xl bg-stone-100 px-3 py-2 text-xs text-stone-500 dark:bg-white/[0.06] dark:text-stone-400">
          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          {turn.waiting
            ? 'The assistant is busy — retrying in a moment…'
            : turn.sources && turn.sources.length > 0
              ? `Found ${turn.sources.length} source${turn.sources.length === 1 ? '' : 's'} — thinking…`
              : 'Thinking…'}
        </div>
      )}

      {turn.answer !== undefined && (
        <div className="max-w-[95%] space-y-2">
          <div
            role="status"
            aria-live="polite"
            className="rounded-2xl bg-stone-100 px-3 py-2 text-xs text-stone-700 dark:bg-white/[0.06] dark:text-stone-200"
          >
            <AssistantMarkdown
              text={turn.answer}
              canOpenCitation={(n) => routeFor(n) !== null}
              onOpenCitation={(n) => {
                const route = routeFor(n);
                if (route) navigate(route);
              }}
            />
            {turn.streaming && (
              <span className="ml-0.5 inline-block h-3 w-1 animate-pulse bg-current align-middle" aria-hidden="true" />
            )}
          </div>
          {turn.citations && <CitationChips citations={turn.citations} />}
          {turn.truncated && <p className={noteClass}>This answer was cut short — ask a narrower question for the rest.</p>}
          {!turn.streaming && !turn.stopped && turn.saved === false && (
            <p className={noteClass}>Not saved to this conversation, so follow-up questions won't see it.</p>
          )}
        </div>
      )}

      {turn.stopped && (
        <div className="flex items-center gap-2">
          <p className={noteClass}>
            {turn.answer === undefined ? 'Stopped.' : 'Stopped — partial answer, not saved to this conversation.'}
          </p>
          <RetryButton onRetry={onRetry} disabled={busy} />
        </div>
      )}
    </div>
  );
}
