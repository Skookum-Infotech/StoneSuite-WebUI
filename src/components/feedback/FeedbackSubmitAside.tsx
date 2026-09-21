import { Lightbulb } from 'lucide-react';
import { StarRating } from '@/components/feedback/StarRating';
import { FEEDBACK_CARD_CLS } from '@/components/feedback/feedbackStyles';
import { cn } from '@/lib/utils';

const TICKET_TIPS = [
  'Say what you were trying to do.',
  'Describe what happened, and what you expected instead.',
  'Add a screenshot if you can — it saves a round trip.',
];

const TITLE_CLS = 'text-sm font-semibold text-stone-900 dark:text-stone-100';

// The right-hand column of the New Ticket form: the optional rating, a few
// pointers toward a ticket support can act on, and — so nothing is attached
// behind the reporter's back — the page the ticket will be filed against.
export function FeedbackSubmitAside({
  rating,
  onRatingChange,
  pagePath,
}: {
  rating: number | null;
  onRatingChange: (rating: number) => void;
  pagePath: string;
}) {
  return (
    <aside aria-label="Ticket guidance" className="space-y-4">
      <section className={cn(FEEDBACK_CARD_CLS, 'p-5')}>
        <h3 className={TITLE_CLS}>How is your experience so far?</h3>
        <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
          Optional. It helps us see how the product feels day to day.
        </p>
        <div className="mt-3 flex justify-center rounded-xl bg-stone-50 py-4 dark:bg-white/[0.04]">
          <StarRating value={rating} onChange={onRatingChange} />
        </div>
      </section>

      <section className={cn(FEEDBACK_CARD_CLS, 'p-5')}>
        <h3 className={cn(TITLE_CLS, 'flex items-center gap-2')}>
          <Lightbulb className="size-4 text-amber-500" aria-hidden="true" />
          Tips for a helpful ticket
        </h3>
        <ul className="mt-3 space-y-2 text-sm text-stone-600 dark:text-stone-300">
          {TICKET_TIPS.map((tip) => (
            <li key={tip} className="flex gap-2">
              <span className="mt-2 size-1 shrink-0 rounded-full bg-stone-300 dark:bg-stone-600" aria-hidden="true" />
              {tip}
            </li>
          ))}
        </ul>
      </section>

      {pagePath && (
        <section className={cn(FEEDBACK_CARD_CLS, 'p-5')}>
          <h3 className={TITLE_CLS}>Page we&apos;ll attach</h3>
          <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
            The page you were on before opening Support, so we can find the problem faster.
          </p>
          <code className="mt-3 block truncate rounded-lg bg-stone-100 px-2.5 py-1.5 font-mono text-[0.8125rem] text-stone-600 dark:bg-white/10 dark:text-stone-300">
            {pagePath}
          </code>
        </section>
      )}
    </aside>
  );
}
