import { useEffect, useState } from 'react';
import { Loader2, MessageSquare, Trash2 } from 'lucide-react';
import { conversationService } from '@/services/aiService';
import { relativeTime } from '@/lib/recentRecordRoute';
import type { AiConversation } from '@/types/ai';
import { cn } from '@/lib/utils';

interface ConversationListProps {
  activeId?: string;
  onOpen: (id: string) => void;
  /** Called after a conversation is deleted, so the panel can drop it if it
   *  was the one open. */
  onDeleted: (id: string) => void;
}

/** The caller's past conversations, newest first — open one to continue it,
 *  or delete it (two clicks, since it can't be undone). */
export function ConversationList({ activeId, onOpen, onDeleted }: ConversationListProps) {
  const [items, setItems] = useState<AiConversation[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  // Kept separate from the load failure: a delete failing doesn't invalidate
  // the list already on screen, so it shouldn't blank the whole panel out.
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    conversationService
      .list()
      .then((list) => {
        if (!cancelled) {
          setItems(list);
          setLoadFailed(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [loadAttempt]);

  const remove = async (id: string): Promise<void> => {
    setConfirmingId(null);
    setDeleteError(null);
    try {
      await conversationService.remove(id);
      setItems((prev) => prev?.filter((c) => c.id !== id) ?? null);
      onDeleted(id);
    } catch {
      setDeleteError("Couldn't delete that conversation. Please try again.");
    }
  };

  if (loadFailed) {
    return (
      <div className="px-4 py-3">
        <p role="alert" className="text-xs text-destructive">Couldn't load your conversations.</p>
        <button
          type="button"
          onClick={() => setLoadAttempt((n) => n + 1)}
          className="mt-1.5 rounded-lg px-2 py-1 text-2xs font-semibold text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-white/10 cursor-pointer"
        >
          Retry
        </button>
      </div>
    );
  }
  if (items === null) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 text-xs text-stone-500">
        <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> Loading conversations…
      </div>
    );
  }
  if (items.length === 0) {
    return <p className="px-4 py-3 text-xs text-stone-500 dark:text-stone-400">No past conversations yet.</p>;
  }

  return (
    <>
      {deleteError && (
        <p role="alert" className="px-4 pb-1 text-xs text-destructive">{deleteError}</p>
      )}
      <ul aria-label="Recent conversations" className="divide-y divide-stone-100 dark:divide-white/5">
      {items.map((c) => {
        const title = c.title || 'Untitled conversation';
        return (
          <li key={c.id} className="flex items-center gap-1 px-2">
            <button
              type="button"
              onClick={() => onOpen(c.id)}
              aria-current={c.id === activeId ? 'true' : undefined}
              className={cn(
                'flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-2.5 text-left hover:bg-stone-100 dark:hover:bg-white/[0.06] cursor-pointer',
                c.id === activeId && 'bg-brand/10',
              )}
            >
              <MessageSquare className="size-3.5 shrink-0 text-stone-400" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-semibold text-stone-700 dark:text-stone-200">{title}</span>
                <span className="block text-2xs text-stone-400">{relativeTime(c.updatedAt)}</span>
              </span>
            </button>
            {confirmingId === c.id ? (
              <button
                type="button"
                onClick={() => void remove(c.id)}
                onBlur={() => setConfirmingId(null)}
                autoFocus
                aria-label={`Confirm delete ${title}`}
                className="shrink-0 rounded-lg bg-destructive/10 px-2 py-1 text-2xs font-semibold text-destructive hover:bg-destructive/20 cursor-pointer"
              >
                Delete?
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingId(c.id)}
                aria-label={`Delete conversation ${title}`}
                className="shrink-0 rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-destructive dark:hover:bg-white/10 cursor-pointer"
              >
                <Trash2 className="size-3.5" />
              </button>
            )}
          </li>
        );
      })}
      </ul>
    </>
  );
}
