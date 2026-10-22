import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Mail } from 'lucide-react';
import { Spinner } from '@/components/tenant/ui';
import { recordEmailService } from '@/services/recordEmailService';
import { RECORD_EMAIL_POLL_MS, conversationSummary, recordEmailKey } from '@/lib/recordEmail';
import { CommunicationComposer } from './CommunicationComposer';
import { CommunicationMessageCard } from './CommunicationMessageCard';

interface SalesOrderCommunicationTabProps {
  orderId: string;
  // The viewer may update the order, which is what replying or adding a note needs.
  canReply: boolean;
}

// The order's conversation with the customer, read top to bottom like a chat: the
// Send-to-customer email first, every reply after it, the newest at the bottom
// right above the box to answer in. The customer's answer comes back here, so
// nothing depends on anyone's personal inbox. Team-only notes sit in the same
// timeline, marked as internal.
export function SalesOrderCommunicationTab({ orderId, canReply }: SalesOrderCommunicationTabProps) {
  const thread = useQuery({
    queryKey: recordEmailKey(orderId),
    queryFn: () => recordEmailService.list(orderId),
    enabled: orderId !== '',
    refetchInterval: RECORD_EMAIL_POLL_MS,
  });

  // The tab opens on its latest message and follows the user's own sends, but not
  // a customer's reply arriving by the minute poll: that must not move a page
  // someone is reading. The marker sits after the pinned box, so scrolling to it
  // brings the end of the thread (and the box in its natural place) into view.
  const endRef = useRef<HTMLDivElement>(null);
  const followNextChange = useRef(true);
  const loaded = thread.data !== undefined;
  const messageCount = thread.data?.messages.length ?? 0;

  useEffect(() => {
    if (!loaded) return;
    const frame = requestAnimationFrame(() => {
      if (!followNextChange.current) return;
      followNextChange.current = false;
      endRef.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
    });
    return () => cancelAnimationFrame(frame);
  }, [loaded, messageCount]);

  if (thread.isLoading) return <div className="flex justify-center py-6"><Spinner label="Loading conversation…" /></div>;
  if (thread.isError || !thread.data) {
    return <p role="alert" className="py-6 text-center text-xs italic text-destructive/70">Failed to load the conversation.</p>;
  }

  const { enabled, replyTo, messages } = thread.data;

  return (
    <div className="space-y-5">
      {!enabled && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-stone-700">
          Customer replies are not being captured yet. Ask your administrator to set up inbound email.
        </p>
      )}

      {messages.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-stone-200 px-4 py-10 text-center">
          <Mail className="size-5 text-stone-300" aria-hidden="true" />
          <p className="text-sm font-medium text-stone-600">No emails yet</p>
          <p className="text-xs text-stone-400">Use Send to customer to start the conversation.</p>
        </div>
      ) : (
        <>
          <p className="text-xs font-medium text-stone-500">{conversationSummary(messages)}</p>
          <ol aria-label="Conversation" className="list-none">
            {messages.map((m, i) => (
              <CommunicationMessageCard key={m.id} message={m} isLast={i === messages.length - 1} />
            ))}
          </ol>
        </>
      )}

      {/* Pinned to the bottom of the screen while the thread is taller than it, so a long
          conversation never pushes the box out of reach; it settles under the last
          message once the end of the thread is in view. */}
      {canReply && (
        <div className="sticky bottom-0 z-10 bg-stone-50 pb-3 pt-2 before:pointer-events-none before:absolute before:inset-x-0 before:-top-4 before:h-4 before:bg-gradient-to-t before:from-stone-50 before:to-transparent">
          <CommunicationComposer
            orderId={orderId}
            emailEnabled={enabled}
            replyTo={replyTo}
            onSent={() => {
              followNextChange.current = true;
            }}
          />
        </div>
      )}
      <div ref={endRef} aria-hidden="true" />
    </div>
  );
}
