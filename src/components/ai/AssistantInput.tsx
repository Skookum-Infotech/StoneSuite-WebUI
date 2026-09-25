import { forwardRef, useLayoutEffect, useRef, useState } from 'react';
import type { ForwardedRef } from 'react';
import { Send, Square } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MAX_QUESTION_BYTES, questionBytes } from './assistantText';

/** Show the byte counter once a question is this close to the limit. */
const COUNTER_THRESHOLD_BYTES = 1600;
/** The textarea grows with its content up to this height, then scrolls. */
const MAX_INPUT_HEIGHT_PX = 120;

interface AssistantInputProps {
  busy: boolean;
  onSubmit: (question: string) => void;
  onStop: () => void;
  placeholder: string;
}

export const AssistantInput = forwardRef(function AssistantInput(
  { busy, onSubmit, onStop, placeholder }: AssistantInputProps,
  ref: ForwardedRef<HTMLTextAreaElement>,
) {
  const [question, setQuestion] = useState('');
  const localRef = useRef<HTMLTextAreaElement | null>(null);
  const bytes = questionBytes(question);
  const tooLong = bytes > MAX_QUESTION_BYTES;
  const canSend = !busy && question.trim() !== '' && !tooLong;

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
          placeholder={placeholder}
          aria-label="Ask the AI assistant a question"
          aria-invalid={tooLong}
          aria-describedby={bytes >= COUNTER_THRESHOLD_BYTES ? 'assistant-question-length' : undefined}
          className="flex-1 resize-none rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs text-stone-700 outline-none focus:border-brand aria-[invalid=true]:border-destructive dark:border-white/10 dark:bg-white/[0.04] dark:text-stone-200"
        />
        {busy ? (
          <button
            type="button"
            onClick={onStop}
            aria-label="Stop generating"
            className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-stone-200 text-stone-700 transition-colors hover:bg-stone-300 cursor-pointer dark:bg-white/10 dark:text-stone-200 dark:hover:bg-white/20"
          >
            <Square className="size-3.5 fill-current" />
          </button>
        ) : (
          <button
            type="submit"
            disabled={!canSend}
            aria-label="Send question"
            className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand text-stone-950 disabled:opacity-40 hover:bg-brand-dark transition-colors cursor-pointer disabled:cursor-not-allowed"
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
