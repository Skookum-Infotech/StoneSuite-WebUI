import { useQuery } from '@tanstack/react-query';
import { Mail } from 'lucide-react';
import { Spinner } from '@/components/tenant/ui';
import { recordEmailService } from '@/services/recordEmailService';
import { RECORD_EMAIL_POLL_MS, newestFirst, recordEmailKey } from '@/lib/recordEmail';
import { CommunicationMessageCard } from './CommunicationMessageCard';

interface SalesOrderCommunicationTabProps {
  orderId: string;
}

// The order's email conversation with the customer: the Send-to-customer email
// first, then every reply that lands on the order's own reply address, newest on
// top. The customer's answer comes back here, so nothing depends on anyone's
// personal inbox.
export function SalesOrderCommunicationTab({ orderId }: SalesOrderCommunicationTabProps) {
  const thread = useQuery({
    queryKey: recordEmailKey(orderId),
    queryFn: () => recordEmailService.list(orderId),
    enabled: orderId !== '',
    refetchInterval: RECORD_EMAIL_POLL_MS,
  });

  if (thread.isLoading) return <div className="flex justify-center py-6"><Spinner label="Loading conversation…" /></div>;
  if (thread.isError || !thread.data) {
    return <p role="alert" className="py-6 text-center text-xs italic text-destructive/70">Failed to load the conversation.</p>;
  }

  const { enabled, messages } = thread.data;

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
          <p className="text-xs font-medium text-stone-500">
            {messages.length === 1 ? '1 email' : `${messages.length} emails`} · newest first
          </p>
          <ol aria-label="Email conversation" className="list-none">
            {newestFirst(messages).map((m, i, all) => (
              <CommunicationMessageCard key={m.id} message={m} isLast={i === all.length - 1} />
            ))}
          </ol>
        </>
      )}
    </div>
  );
}
