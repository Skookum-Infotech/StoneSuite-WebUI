import { forwardRef, useLayoutEffect, useRef } from 'react';
import type { ForwardedRef } from 'react';
import { Send, Square } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MAX_QUESTION_BYTES, questionBytes } from './assistantText';

/** Show the byte counter once a question is this close to the limit. */
const COUNTER_THRESHOLD_BYTES = 1600;
/** The textarea grows with its content up to this height, then scrolls. */
const MAX_INPUT_HEIGHT_PX = 120;

interface AssistantInputProps {
  /** A stream is actively running — swaps Send for Stop. */
  busy: boolean;
  /** Sending is blocked for a reason other than streaming (a saved
   *  conversation is still loading) — Send stays visible but disabled,
   *  unlike `busy` which swaps it for Stop. */
  locked?: boolean;
  onSubmit: (question: string) => void;
  onStop: () => void;
  /** Lifted so the typed-but-unsent question survives the panel closing —
   *  the owner (HelpMenu) keeps it alongside the conversation itself. */
  draft: { value: string; onChange: (value: string) => void };
}

export const AssistantInput = forwardRef(function AssistantInput(
  { busy, locked, onSubmit, onStop, draft }: AssistantInputProps,
  ref: ForwardedRef<HTMLTextAreaElement>,
) {
  const { value: question, onChange: setQuestion } = draft;
  const localRef = useRef<HTMLTextAreaElement | null>(null);
  const bytes = questionBytes(question);
  const tooLong = bytes > MAX_QUESTION_BYTES;
  const canSend = !busy && !locked && question.trim() !== '' && !tooLong;

  useLayoutEffect(() => {
    const el = localRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_INPUT_HEIGHT_PX)}px`;
  }, [question]);

  const submit = (): void => {
    if (!canSend) return;
    onSubmit(question);
    setQuestion('');
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="border-t border-stone-200 p-3 dark:border-white/10"
      style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
    >
      <div className="flex items-end gap-2">
        {/* Stays enabled while an answer streams (only sending is blocked),
            so focus never drops out of the box between questions. */}
        <textarea
          ref={(el) => {
            localRef.current = el;
            if (typeof ref === 'function') ref(el);
            else if (ref) ref.current = el;
          }}
          rows={1}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Ask a question…"
          aria-label="Ask the AI assistant a question"
          aria-invalid={tooLong}
          aria-describedby={bytes >= COUNTER_THRESHOLD_BYTES ? 'assistant-question-length' : undefined}
          // text-base (16px) on small screens keeps iOS Safari from
          // auto-zooming the page on focus; sm+ reverts to the compact size.
          className="flex-1 resize-none rounded-xl border border-stone-200 bg-white px-3 py-2 text-base outline-none focus:border-brand aria-[invalid=true]:border-destructive dark:border-white/10 dark:bg-white/[0.04] dark:text-stone-200 sm:text-xs text-stone-700"
        />
        {busy ? (
          <button
            type="button"
            onClick={onStop}
            aria-label="Stop generating"
            className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-stone-200 text-stone-700 transition-colors hover:bg-stone-300 cursor-pointer dark:bg-white/10 dark:text-stone-200 dark:hover:bg-white/20 sm:size-9"
          >
            <Square className="size-3.5 fill-current" />
          </button>
        ) : (
          <button
            type="submit"
            disabled={!canSend}
            aria-label="Send question"
            className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand text-stone-950 disabled:opacity-40 hover:bg-brand-dark transition-colors cursor-pointer disabled:cursor-not-allowed sm:size-9"
          >
            <Send className="size-4" />
          </button>
        )}
      </div>
      {bytes >= COUNTER_THRESHOLD_BYTES && (
        <p
          id="assistant-question-length"
          className={cn('mt-1 text-right text-2xs', tooLong ? 'text-destructive' : 'text-stone-400')}
        >
          {tooLong ? 'Too long — please shorten your question. ' : ''}
          {bytes} / {MAX_QUESTION_BYTES}
        </p>
      )}
    </form>
  );
});
