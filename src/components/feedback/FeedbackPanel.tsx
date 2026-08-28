import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { LifeBuoy, X } from 'lucide-react';
import { FeedbackSubmitForm } from '@/components/feedback/FeedbackSubmitForm';
import { FeedbackTicketList } from '@/components/feedback/FeedbackTicketList';
import { cn } from '@/lib/utils';

type Tab = 'submit' | 'tickets';

const TABS: { key: Tab; label: string }[] = [
  { key: 'submit', label: 'Submit' },
  { key: 'tickets', label: 'My Tickets' },
];

// Floating card anchored under the header — same position, size, and
// non-modal (no backdrop, Escape + × to close) behavior as AssistantPanel,
// since both now open from the same Help menu and should read as one
// family. Two tabs: Submit a new ticket, or track ones already filed ("My
// Tickets"). Deliberately no dedicated page: this panel is the whole
// reporter-facing surface, for both tenant staff and customer-portal users
// (see HelpMenu, mounted in MainLayout for both session kinds).
export function FeedbackPanel({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('submit');
  const queryClient = useQueryClient();

  useEffect(() => {
    const handleKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  // A freshly-submitted ticket must show up in "My Tickets" without a stale
  // cache if the reporter had already visited that tab earlier this session.
  const handleSubmitted = (): void => {
    void queryClient.invalidateQueries({ queryKey: ['feedback-mine'] });
  };

  return (
    <div
      role="dialog"
      aria-label="Support"
      className="fixed top-[4.5rem] right-4 sm:right-6 z-40 flex h-[40rem] max-h-[calc(100vh-6rem)] w-96 max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#1c1c1c]"
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-stone-200 px-4 py-3 dark:border-white/10">
        <div className="flex items-center gap-2">
          <LifeBuoy className="size-4 text-brand-dark" />
          <h2 className="text-sm font-bold text-stone-700 dark:text-stone-200">Support</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close support panel"
          className="rounded p-1 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600 dark:hover:bg-white/10 dark:hover:text-stone-200"
        >
          <X className="size-4" />
        </button>
      </div>

      <div role="tablist" aria-label="Support panel sections" className="flex shrink-0 gap-1 border-b border-stone-200 px-4 pt-2 dark:border-white/10">
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

      {/* min-h-0 overrides the flex item's default min-height:auto — without
          it, this child grows to fit ALL ticket rows instead of shrinking to
          the space left under the header/tabs, and overflow-y-auto never
          gets a chance to kick in (the outer panel's overflow-hidden just
          clips the rest instead of making it scrollable). */}
      <div className="modal-scrollbar min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {tab === 'submit' ? <FeedbackSubmitForm onSubmitted={handleSubmitted} /> : <FeedbackTicketList />}
      </div>
    </div>
  );
}
