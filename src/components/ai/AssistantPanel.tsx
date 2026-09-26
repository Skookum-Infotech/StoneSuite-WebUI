import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ArrowDown, History, Loader2, Plus, Sparkles, X } from 'lucide-react';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { AssistantInput } from './AssistantInput';
import { AssistantTurn } from './AssistantTurn';
import { ConversationList } from './ConversationList';
import type { AssistantConversation } from './useAssistantConversation';

/** The CRM types the assistant can search; a caller with read on none of
 *  them gets help-docs-only answers (the backend enforces this — here it
 *  only changes the hint text and which suggested questions are offered). */
const RECORD_RESOURCES = ['lead', 'prospect', 'customer'];
/** How close to the bottom (px) still counts as "following" the stream. */
const FOLLOW_THRESHOLD_PX = 64;

const SUGGESTED_HOWTO = ['What can the assistant help with?', 'How do I create a quote?', 'How do I invite a user?'];
const SUGGESTED_DATA = ['How many leads do I have?', 'How do I convert a prospect to a customer?', 'What deals closed this month?'];

const headerButton =
  'flex min-h-11 min-w-11 items-center justify-center rounded p-1 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600 dark:hover:bg-white/10 dark:hover:text-stone-200 cursor-pointer sm:min-h-0 sm:min-w-0';

const FOCUSABLE_SELECTOR = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/** Mounted only while open (`{open && <AssistantPanel .../>}`); `conversation`
 *  and `draft` are owned by HelpMenu (which outlives the panel), so closing
 *  the panel neither aborts an in-flight stream nor loses what was typed.
 *  Rendered through a portal so it stacks above page overlays rather than
 *  inside the header's stacking context. */
export function AssistantPanel({
  conversation,
  draft,
  onClose,
}: {
  conversation: AssistantConversation;
  draft: { value: string; onChange: (value: string) => void };
  onClose: () => void;
}): React.JSX.Element {
  const { turns, isBusy, isLoading, loadError, conversationId } = conversation;
  const [view, setView] = useState<'chat' | 'history'>('chat');
  const [confirmAction, setConfirmAction] = useState<'newChat' | 'history' | null>(null);
  const [isFollowing, setIsFollowing] = useState(true);
  const { hasPermission } = useUserPermissions();
  const canSearchRecords = RECORD_RESOURCES.some((r) => hasPermission(r, 'read'));

  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const followRef = useRef(true);
  const newChatButtonRef = useRef<HTMLButtonElement>(null);
  const historyButtonRef = useRef<HTMLButtonElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (view === 'chat') inputRef.current?.focus();
    else panelRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)?.focus();
  }, [view]);

  // This panel is rendered through a portal, so it sits beside #root, not
  // inside it — it is always aria-modal, on every breakpoint (mobile renders
  // it full-screen; the Tab trap already treats it as modal at every size),
  // so the rest of the app must be unreachable to more than just Tab while
  // it's open: assistive tech and pointer users get the same guarantee.
  // aria-hidden is a fallback for tech that doesn't yet honor `inert`.
  useEffect(() => {
    const appRoot = document.getElementById('root');
    if (!appRoot) return undefined;
    appRoot.setAttribute('inert', '');
    appRoot.setAttribute('aria-hidden', 'true');
    return () => {
      appRoot.removeAttribute('inert');
      appRoot.removeAttribute('aria-hidden');
    };
  }, []);

  // Focus the confirm's Cancel button the moment it appears (it's the
  // non-destructive default), and hand focus back to whichever header button
  // opened it when Cancel is chosen — Continue's own action (new chat /
  // history) already places focus appropriately on its own.
  useEffect(() => {
    if (confirmAction) cancelButtonRef.current?.focus();
  }, [confirmAction]);

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

  const scrollToBottom = (): void => {
    followRef.current = true;
    setIsFollowing(true);
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  };

  const openFromHistory = (id: string): void => {
    followRef.current = true;
    setIsFollowing(true);
    setView('chat');
    void conversation.openConversation(id);
  };

  const startNewChat = (): void => {
    conversation.newChat();
    inputRef.current?.focus();
  };

  // New chat / History while a stream is running would abandon it — ask
  // first, inline, rather than a browser confirm() dialog.
  const requestAction = (action: 'newChat' | 'history'): void => {
    if (isBusy) {
      setConfirmAction(action);
      return;
    }
    if (action === 'newChat') startNewChat();
    else setView('history');
  };

  const confirmPendingAction = (): void => {
    const action = confirmAction;
    setConfirmAction(null);
    if (action === 'newChat') startNewChat();
    else if (action === 'history') setView('history');
  };

  // A minimal focus trap: Tab/Shift+Tab wrap within the panel instead of
  // escaping to the page behind it, matching the panel's modal semantics.
  const trapFocus = (e: React.KeyboardEvent): void => {
    if (e.key !== 'Tab' || !panelRef.current) return;
    const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
      (el) => !el.hasAttribute('disabled'),
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const suggestions = canSearchRecords
    ? [...SUGGESTED_DATA.slice(0, 3), ...SUGGESTED_HOWTO.slice(0, 3)]
    : SUGGESTED_HOWTO;

  const askSuggested = (q: string): void => {
    followRef.current = true;
    setIsFollowing(true);
    void conversation.ask(q);
  };

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-label="StoneSuite Assistant chat"
      // Escape closes only while focus is inside the panel — a document-wide
      // listener also closed it (aborting the answer) from any Escape on the
      // page. Closing no longer aborts anything: the conversation is owned
      // by HelpMenu, which stays mounted, so an in-flight answer keeps
      // streaming while the panel is closed.
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onClose();
        } else {
          trapFocus(e);
        }
      }}
      className="fixed inset-0 z-50 flex flex-col overflow-hidden overscroll-contain border-stone-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#1c1c1c] sm:inset-auto sm:top-[4.5rem] sm:right-6 sm:h-[32rem] sm:max-h-[calc(100dvh-5.5rem)] sm:w-96 sm:max-w-[calc(100vw-2rem)] sm:rounded-2xl sm:border"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
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
              <button ref={newChatButtonRef} type="button" onClick={() => requestAction('newChat')} aria-label="New chat" title="New chat" className={headerButton}>
                <Plus className="size-4" />
              </button>
              <button ref={historyButtonRef} type="button" onClick={() => requestAction('history')} aria-label="Recent conversations" title="Recent conversations" className={headerButton}>
                <History className="size-4" />
              </button>
            </>
          )}
          <button type="button" onClick={onClose} aria-label="Close AI assistant" className={headerButton}>
            <X className="size-4" />
          </button>
        </div>
      </div>

      {confirmAction && (
        <div
          role="alertdialog"
          aria-label="Confirm stopping the current answer"
          className="flex items-center justify-between gap-2 border-b border-stone-200 bg-amber-50 px-4 py-2 text-2xs text-stone-700 dark:border-white/10 dark:bg-amber-500/10 dark:text-stone-200"
        >
          <span>This will stop the current answer. Continue?</span>
          <span className="flex shrink-0 gap-1">
            <button
              type="button"
              onClick={confirmPendingAction}
              className="rounded-lg bg-stone-900 px-2 py-1 font-semibold text-white hover:bg-stone-700 cursor-pointer dark:bg-white dark:text-stone-900"
            >
              Continue
            </button>
            <button
              ref={cancelButtonRef}
              type="button"
              onClick={() => {
                const trigger = confirmAction === 'newChat' ? newChatButtonRef : historyButtonRef;
                setConfirmAction(null);
                trigger.current?.focus();
              }}
              className="rounded-lg px-2 py-1 font-semibold text-stone-600 hover:bg-stone-100 cursor-pointer dark:text-stone-300 dark:hover:bg-white/10"
            >
              Cancel
            </button>
          </span>
        </div>
      )}

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
          <div className="relative min-h-0 flex-1">
            <div
              ref={scrollRef}
              onScroll={(e) => {
                const el = e.currentTarget;
                const following = el.scrollHeight - el.scrollTop - el.clientHeight < FOLLOW_THRESHOLD_PX;
                followRef.current = following;
                setIsFollowing(following);
              }}
              className="h-full space-y-4 overflow-y-auto px-4 py-3"
            >
              {isLoading && (
                <div className="flex items-center gap-2 text-xs text-stone-500">
                  <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> Loading conversation…
                </div>
              )}
              {!isLoading && loadError && (
                <div className="flex flex-col items-start gap-1">
                  <p role="alert" className="text-xs text-destructive">{loadError}</p>
                  <button
                    type="button"
                    onClick={conversation.retryLoad}
                    className="rounded-lg px-2 py-1 text-2xs font-semibold text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-white/10 cursor-pointer"
                  >
                    Retry
                  </button>
                </div>
              )}
              {!isLoading && !loadError && turns.length === 0 && (
                <div className="space-y-3">
                  <p className="text-xs text-stone-500 dark:text-stone-400">
                    {canSearchRecords
                      ? 'Ask about a record, workflow, or how to do something in StoneSuite.'
                      : 'Ask how to do something in StoneSuite — I can answer questions about using the app.'}
                  </p>
                  <div className="flex flex-col items-start gap-1.5">
                    {suggestions.map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => askSuggested(q)}
                        className="rounded-xl border border-stone-200 px-2.5 py-1.5 text-left text-2xs font-medium text-stone-600 hover:bg-stone-100 dark:border-white/10 dark:text-stone-300 dark:hover:bg-white/[0.06] cursor-pointer"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {turns.map((turn) => (
                <AssistantTurn key={turn.id} turn={turn} busy={isBusy} onRetry={conversation.retry} />
              ))}
            </div>

            {!isFollowing && (
              <button
                type="button"
                onClick={scrollToBottom}
                aria-label="Jump to latest message"
                className="absolute bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full border border-stone-200 bg-white px-2.5 py-1 text-2xs font-semibold text-stone-600 shadow-md hover:bg-stone-50 dark:border-white/10 dark:bg-stone-800 dark:text-stone-200 cursor-pointer"
              >
                <ArrowDown className="size-3" aria-hidden="true" />
                Jump to latest
              </button>
            )}
          </div>

          <AssistantInput
            ref={inputRef}
            busy={isBusy}
            locked={isLoading}
            draft={draft}
            onSubmit={(q) => {
              followRef.current = true;
              setIsFollowing(true);
              void conversation.ask(q);
            }}
            onStop={conversation.stop}
          />
        </>
      )}
    </div>,
    document.body,
  );
}
