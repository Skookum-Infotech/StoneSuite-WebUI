import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useQueryClient } from '@tanstack/react-query';
import { MessageSquare, X } from 'lucide-react';
import { useModalDialog } from '@/hooks/useModalDialog';
import { FeedbackSubmitForm } from '@/components/feedback/FeedbackSubmitForm';
import { FeedbackTicketList } from '@/components/feedback/FeedbackTicketList';
import { cn } from '@/lib/utils';

type Tab = 'submit' | 'tickets';

const TABS: { key: Tab; label: string }[] = [
  { key: 'submit', label: 'Submit' },
  { key: 'tickets', label: 'My Tickets' },
];

// Right slide-over with two tabs — Submit a new ticket, or track ones already
// filed ("My Tickets"). Deliberately no dedicated page: this panel is the
// whole reporter-facing surface, for both tenant staff and customer-portal
// users (see FeedbackWidget, mounted in MainLayout for both session kinds).
export function FeedbackPanel({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('submit');
  const contentRef = useModalDialog(onClose);
  const queryClient = useQueryClient();

  // A freshly-submitted ticket must show up in "My Tickets" without a stale
  // cache if the reporter had already visited that tab earlier this session.
  const handleSubmitted = (): void => {
    void queryClient.invalidateQueries({ queryKey: ['feedback-mine'] });
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9998] flex justify-end bg-black/40 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="feedback-panel-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div ref={contentRef} tabIndex={-1} className="flex h-full w-full max-w-md flex-col bg-white shadow-2xl outline-none dark:bg-[#141414]">
        <div className="flex shrink-0 items-center justify-between border-b border-stone-200 px-4 py-3.5 dark:border-white/10">
          <div className="flex items-center gap-2">
            <MessageSquare className="size-4 text-brand-dark" aria-hidden="true" />
            <h2 id="feedback-panel-title" className="text-sm font-bold text-stone-900 dark:text-stone-100">
              Send Us Your Feedback
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close feedback panel"
            className="rounded p-1 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600 dark:hover:bg-white/10 dark:hover:text-stone-200"
          >
            <X className="size-4" />
          </button>
        </div>

        <div role="tablist" aria-label="Feedback panel sections" className="flex shrink-0 gap-1 border-b border-stone-200 px-4 pt-2 dark:border-white/10">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                'rounded-t-lg px-3 py-2 text-xs font-semibold transition-colors',
                tab === t.key
                  ? 'border-b-2 border-brand text-brand-dark'
                  : 'border-b-2 border-transparent text-stone-400 hover:text-stone-600 dark:hover:text-stone-300',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="modal-scrollbar flex-1 overflow-y-auto px-4 py-4">
          {tab === 'submit' ? <FeedbackSubmitForm onSubmitted={handleSubmitted} /> : <FeedbackTicketList />}
        </div>
      </div>
    </div>,
    document.body,
  );
}
