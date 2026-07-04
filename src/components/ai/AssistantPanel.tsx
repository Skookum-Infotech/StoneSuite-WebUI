import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Sparkles, X, Send, Loader2, FileText, BookOpen } from 'lucide-react';
import { aiService } from '@/services/aiService';
import { apiErrorMessage } from '@/api/tenantClient';
import type { AskResult, Citation } from '@/types/ai';
import { cn } from '@/lib/utils';

const MAX_QUESTION_LENGTH = 2000;

interface ChatTurn {
  id: string;
  question: string;
  result?: AskResult;
  error?: string;
}

/** Best-effort workflowKey resolution from the current route, e.g. /crm/lead/123 -> "lead". */
function resolveWorkflowKeyFromPath(pathname: string): string | null {
  const match = /^\/crm\/([^/]+)/.exec(pathname);
  return match ? match[1] : null;
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

export function AssistantPanel(): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const workflowKey = resolveWorkflowKeyFromPath(location.pathname);

  const askMutation = useMutation({
    mutationFn: (q: string) => aiService.askAssistant(q),
  });

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [turns]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && isOpen) setIsOpen(false);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen]);

  const handleAsk = (e: React.FormEvent): void => {
    e.preventDefault();
    const trimmed = question.trim();
    if (!trimmed || askMutation.isPending) return;

    const turnId = `${Date.now()}`;
    setTurns((prev) => [...prev, { id: turnId, question: trimmed }]);
    setQuestion('');

    askMutation.mutate(trimmed, {
      onSuccess: (result) => {
        setTurns((prev) => prev.map((t) => (t.id === turnId ? { ...t, result } : t)));
      },
      onError: (err) => {
        setTurns((prev) =>
          prev.map((t) => (t.id === turnId ? { ...t, error: apiErrorMessage(err, 'The assistant could not answer that.') } : t)),
        );
      },
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        aria-label={isOpen ? 'Close AI assistant' : 'Open AI assistant'}
        aria-expanded={isOpen}
        className="fixed bottom-6 right-6 z-40 flex size-13 items-center justify-center rounded-full bg-brand text-stone-950 shadow-xl hover:bg-brand-dark transition-colors cursor-pointer"
      >
        {isOpen ? <X className="size-5" /> : <Sparkles className="size-5" />}
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-label="AI assistant chat"
          className="fixed bottom-24 right-6 z-40 flex h-[32rem] w-96 max-w-[calc(100vw-3rem)] flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#1c1c1c]"
        >
          <div className="flex items-center gap-2 border-b border-stone-200 px-4 py-3 dark:border-white/10">
            <Sparkles className="size-4 text-brand" />
            <h2 className="text-sm font-bold text-stone-700 dark:text-stone-200">StoneSuite Assistant</h2>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-3">
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
                {turn.result && (
                  <div className="max-w-[95%] space-y-2">
                    <p className="rounded-2xl bg-stone-100 px-3 py-2 text-xs text-stone-700 dark:bg-white/[0.06] dark:text-stone-200">
                      {turn.result.answer}
                    </p>
                    {turn.result.citations.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {turn.result.citations.map((citation, idx) => (
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
                {!turn.result && !turn.error && (
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
              className="flex-1 rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs text-stone-700 outline-none focus:border-brand dark:border-white/10 dark:bg-white/[0.04] dark:text-stone-200"
            />
            <button
              type="submit"
              disabled={!question.trim() || askMutation.isPending}
              aria-label="Send question"
              className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand text-stone-950 disabled:opacity-40 hover:bg-brand-dark transition-colors cursor-pointer disabled:cursor-not-allowed"
            >
              <Send className="size-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
