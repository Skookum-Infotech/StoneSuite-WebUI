import { useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Inbox, LifeBuoy, SquarePen } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { FeedbackSubmitForm } from '@/components/feedback/FeedbackSubmitForm';
import { FeedbackTicketInbox } from '@/components/feedback/FeedbackTicketInbox';
import { SUPPORT_TAB_PARAM, SUPPORT_TICKET_PARAM, resolveSupportTab } from '@/lib/feedback';
import type { SupportTab } from '@/lib/feedback';
import { cn } from '@/lib/utils';
import type { FeedbackTicket } from '@/types/feedback';

const TABS: { key: SupportTab; label: string; icon: LucideIcon }[] = [
  { key: 'tickets', label: 'My Tickets', icon: Inbox },
  { key: 'new', label: 'New Ticket', icon: SquarePen },
];

// Same gutters top to bottom — header, tab bar and content line up on every
// screen size, and the content runs the full width of the page.
const GUTTER_CLS = 'px-4 sm:px-6 3xl:px-10 4xl:px-14';

// The reporter-facing support surface for every signed-in user — tenant staff
// and customer-portal sessions alike (feedbackService picks the right API), so
// it declares no PermissionGuard. Two tabs: follow up on the tickets already
// filed ("My Tickets", the default — it is what the sidebar entry is called)
// or file a new one ("New Ticket"). The active tab lives in `?tab=` so the
// Help menu can deep-link it and a reload keeps it.
export default function SupportPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const activeTab = resolveSupportTab(searchParams.get(SUPPORT_TAB_PARAM));

  // replace: flipping between two tabs is not a navigation worth a Back stop.
  // Writing only `tab` also drops any open ticket, which belongs to My Tickets.
  const selectTab = (tab: SupportTab): void => {
    setSearchParams({ [SUPPORT_TAB_PARAM]: tab }, { replace: true });
  };

  const openTicket = (ticket: FeedbackTicket): void => {
    setSearchParams({ [SUPPORT_TAB_PARAM]: 'tickets', [SUPPORT_TICKET_PARAM]: ticket.id }, { replace: true });
  };

  // A freshly-submitted ticket must show up in "My Tickets" without a stale
  // cache if the reporter had already visited that tab earlier this session.
  const handleSubmitted = (): void => {
    void queryClient.invalidateQueries({ queryKey: ['feedback-mine'] });
  };

  return (
    <div className="flex flex-1 flex-col min-h-0 bg-background">
      <div className={cn('border-b border-stone-100 py-3 dark:border-white/10 sm:py-4', GUTTER_CLS)}>
        <div className="flex items-center gap-3.5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand/20 text-brand-dark">
            <LifeBuoy className="size-6" strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-white">Support</h1>
            <p className="text-sm text-stone-500">
              Report a bug, request a feature, or follow up on a ticket you have filed.
            </p>
          </div>
        </div>
      </div>

      <div className={cn('flex flex-1 flex-col gap-2 pt-2 sm:pt-3 pb-4 sm:pb-6 3xl:pb-10 4xl:pb-14', GUTTER_CLS)}>
        <div
          role="tablist"
          aria-label="Support sections"
          className="flex shrink-0 gap-1.5 self-start overflow-x-auto rounded-2xl border border-stone-200 bg-white p-1.5 shadow-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden dark:border-white/10 dark:bg-white/5"
        >
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              id={`support-tab-${tab.key}`}
              aria-selected={activeTab === tab.key}
              aria-controls={`support-tabpanel-${tab.key}`}
              onClick={() => selectTab(tab.key)}
              className={cn(
                'group flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 transition-all duration-150 cursor-pointer',
                activeTab === tab.key
                  ? 'bg-[#001219] text-white shadow-sm'
                  : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900 dark:text-stone-400 dark:hover:bg-white/10 dark:hover:text-stone-100',
              )}
            >
              <tab.icon className={cn('size-3.5 shrink-0', activeTab === tab.key ? 'text-brand' : 'text-stone-400 group-hover:text-stone-600 dark:group-hover:text-stone-300')} aria-hidden="true" />
              <span className="text-xs font-semibold whitespace-nowrap">{tab.label}</span>
            </button>
          ))}
        </div>

        <div
          id={`support-tabpanel-${activeTab}`}
          role="tabpanel"
          aria-labelledby={`support-tab-${activeTab}`}
        >
          {activeTab === 'new' ? (
            <FeedbackSubmitForm onSubmitted={handleSubmitted} onViewTicket={openTicket} />
          ) : (
            <FeedbackTicketInbox onCreateTicket={() => selectTab('new')} />
          )}
        </div>
      </div>
    </div>
  );
}
