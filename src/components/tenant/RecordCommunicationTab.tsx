import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Mail, StickyNote } from 'lucide-react';
import { Spinner } from '@/components/tenant/ui';
import { recordEmailService } from '@/services/recordEmailService';
import { RECORD_EMAIL_POLL_MS, communicationCopy, conversationSummary, recordEmailKey } from '@/lib/recordEmail';
import type { CommunicationAudience } from '@/types/recordEmail';
import { CommunicationComposer } from './CommunicationComposer';
import { CommunicationMessageCard } from './CommunicationMessageCard';

interface RecordCommunicationTabProps {
  recordId: string;
  // Who the conversation is with: the customer or vendor a document is emailed to,
  // or 'internal' for a record that only keeps team notes.
  audience: CommunicationAudience;
  // The viewer may update the record, which is what replying or adding a note needs.
  canReply: boolean;
}

// A record's conversation, read top to bottom like a chat: the document's
// Send email first, every reply after it, the newest at the bottom right above the
// box to answer in. The other party's answer comes back here, so nothing depends
// on anyone's personal inbox. Team-only notes sit in the same timeline, marked as
// internal. A record that only keeps team notes shows just those.
export function RecordCommunicationTab({ recordId, audience, canReply }: RecordCommunicationTabProps) {
  const thread = useQuery({
    queryKey: recordEmailKey(recordId),
    queryFn: () => recordEmailService.list(recordId),
    enabled: recordId !== '',
    refetchInterval: RECORD_EMAIL_POLL_MS,
  });
  const copy = communicationCopy(audience);
  const notesOnly = audience === 'internal';

  // The tab opens on its latest message and follows the user's own sends, but not
  // a reply arriving by the minute poll: that must not move a page someone is
  // reading. The marker sits after the pinned box, so scrolling to it brings the
  // end of the thread (and the box in its natural place) into view.
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
  const EmptyIcon = notesOnly ? StickyNote : Mail;

  return (
    <div className="flex flex-1 flex-col gap-5">
      {!notesOnly && !enabled && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-stone-700">
          {copy.notCapturedNotice}
        </p>
      )}

      {messages.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-stone-200 px-4 py-10 text-center">
          <EmptyIcon className="size-5 text-stone-300" aria-hidden="true" />
          <p className="text-sm font-medium text-stone-600">{copy.emptyTitle}</p>
          <p className="text-xs text-stone-400">{copy.emptyHint}</p>
        </div>
      ) : (
        <>
          <p className="text-xs font-medium text-stone-500">{conversationSummary(messages, audience)}</p>
          <ol aria-label="Conversation" className="list-none">
            {messages.map((m, i) => (
              <CommunicationMessageCard key={m.id} message={m} audience={audience} isLast={i === messages.length - 1} />
            ))}
          </ol>
        </>
      )}

      {/* The tab fills the page, so with a short (or empty) thread this auto margin drops the
          box to the bottom of the screen. Once the thread is taller than the screen it is
          pinned there instead, so a long conversation never pushes the box out of reach; it
          settles under the last message once the end of the thread is in view. */}
      {canReply && (
        <div className="sticky bottom-0 z-10 mt-auto bg-stone-50 pb-3 pt-2 before:pointer-events-none before:absolute before:inset-x-0 before:-top-4 before:h-4 before:bg-gradient-to-t before:from-stone-50 before:to-transparent">
          <CommunicationComposer
            recordId={recordId}
            audience={audience}
            emailEnabled={enabled}
            replyTo={replyTo}
            onSent={() => {
              followNextChange.current = true;
            }}
          />
        </div>
      )}
      {/* The negative margin cancels the flex gap above it, so this marker adds no space. */}
      <div ref={endRef} aria-hidden="true" className="-mt-5" />
    </div>
  );
}
