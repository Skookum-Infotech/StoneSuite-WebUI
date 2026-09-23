import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, History, Loader2, Plus, Sparkles, X } from 'lucide-react';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { AssistantInput } from './AssistantInput';
import { AssistantTurn } from './AssistantTurn';
import { ConversationList } from './ConversationList';
import { useAssistantConversation } from './useAssistantConversation';

/** The CRM types the assistant can search; a caller with read on none of
 *  them gets help-docs-only answers (the backend enforces this — here it
 *  only changes the hint text). */
const RECORD_RESOURCES = ['lead', 'prospect', 'customer'];
/** How close to the bottom (px) still counts as "following" the stream. */
const FOLLOW_THRESHOLD_PX = 64;

const headerButton =
  'rounded p-1 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600 dark:hover:bg-white/10 dark:hover:text-stone-200 cursor-pointer';

/** Mounted only while open (`{open && <AssistantPanel onClose />}`); the
 *  conversation itself survives closing via useAssistantConversation's
 *  remembered id. Rendered through a portal so it stacks above page
 *  overlays rather than inside the header's stacking context. */
export function AssistantPanel({ onClose }: { onClose: () => void }): React.JSX.Element {
  const conversation = useAssistantConversation();
  const { turns, isBusy, isLoading, conversationId } = conversation;
  const [view, setView] = useState<'chat' | 'history'>('chat');
  const { hasPermission } = useUserPermissions();
  const canSearchRecords = RECORD_RESOURCES.some((r) => hasPermission(r, 'read'));

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const followRef = useRef(true);

  useEffect(() => {
    if (view === 'chat') inputRef.current?.focus();
  }, [view]);

  // Back in the input once an answer finishes, ready for the follow-up.
  const wasBusyRef = useRef(false);
  useEffect(() => {
    if (wasBusyRef.current && !isBusy) inputRef.current?.focus();
    wasBusyRef.current = isBusy;
  }, [isBusy]);

  // Follow the stream only while the reader is at the bottom — scrolling up
  // to reread must not be yanked back down on every token.
  useEffect(() => {
    const el = scrollRef.current;
    if (el && followRef.current) el.scrollTo({ top: el.scrollHeight, behavior: 'auto' });
  }, [turns]);

  const openFromHistory = (id: string): void => {
    followRef.current = true;
    setView('chat');
    void conversation.openConversation(id);
  };

  return createPortal(
    <div
      role="dialog"
      aria-label="StoneSuite Assistant chat"
      // Escape closes only while focus is inside the panel — a document-wide
      // listener also closed it (aborting the answer) from any Escape on the page.
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onClose();
        }
      }}
      className="fixed inset-0 z-50 flex flex-col overflow-hidden border-stone-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#1c1c1c] sm:inset-auto sm:top-[4.5rem] sm:right-6 sm:h-[32rem] sm:max-h-[calc(100dvh-5.5rem)] sm:w-96 sm:max-w-[calc(100vw-2rem)] sm:rounded-2xl sm:border"
    >
      <div className="flex items-center justify-between gap-2 border-b border-stone-200 px-4 py-3 dark:border-white/10">
        <div className="flex min-w-0 items-center gap-2">
          {view === 'history' ? (
            <button type="button" onClick={() => setView('chat')} aria-label="Back to chat" className={headerButton}>
              <ArrowLeft className="size-4" />
            </button>
          ) : (
            <Sparkles className="size-4 shrink-0 text-brand" aria-hidden="true" />
          )}
          <h2 className="truncate text-sm font-bold text-stone-700 dark:text-stone-200">
            {view === 'history' ? 'Recent conversations' : 'StoneSuite Assistant'}
          </h2>
        </div>
        <div className="flex items-center gap-1">
          {view === 'chat' && (
            <>
              <button
                type="button"
                onClick={() => {
                  conversation.newChat();
                  inputRef.current?.focus();
                }}
                aria-label="New chat"
                title="New chat"
                className={headerButton}
              >
                <Plus className="size-4" />
              </button>
              <button type="button" onClick={() => setView('history')} aria-label="Recent conversations" title="Recent conversations" className={headerButton}>
                <History className="size-4" />
              </button>
            </>
          )}
          <button type="button" onClick={onClose} aria-label="Close AI assistant" className={headerButton}>
            <X className="size-4" />
          </button>
        </div>
      </div>

      {view === 'history' ? (
        <div className="min-h-0 flex-1 overflow-y-auto py-1">
          <ConversationList
            activeId={conversationId}
            onOpen={openFromHistory}
            onDeleted={(id) => {
              if (id === conversationId) conversation.newChat();
            }}
          />
        </div>
      ) : (
        <>
          {/* min-h-0 lets this flex item shrink below its content so it scrolls. */}
          <div
            ref={scrollRef}
            onScroll={(e) => {
              const el = e.currentTarget;
              followRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < FOLLOW_THRESHOLD_PX;
            }}
            className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-3"
          >
            {isLoading && (
              <div className="flex items-center gap-2 text-xs text-stone-500">
                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> Loading conversation…
              </div>
            )}
            {!isLoading && turns.length === 0 && (
              <p className="text-xs text-stone-500 dark:text-stone-400">
                {canSearchRecords
                  ? 'Ask about a record, workflow, or how to do something in StoneSuite.'
                  : 'Ask how to do something in StoneSuite — I can answer questions about using the app.'}
              </p>
            )}
            {turns.map((turn) => (
              <AssistantTurn key={turn.id} turn={turn} busy={isBusy} onRetry={() => void conversation.retry(turn.id)} />
            ))}
          </div>

          <AssistantInput
            ref={inputRef}
            busy={isBusy}
            onSubmit={(q) => {
              followRef.current = true;
              void conversation.ask(q);
            }}
            onStop={conversation.stop}
            placeholder="Ask a question…"
          />
        </>
      )}
    </div>,
    document.body,
  );
}
