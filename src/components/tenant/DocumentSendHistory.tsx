import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { documentService } from '@/services/documentService';
import { EmailStatusBadge } from '@/components/tenant/EmailStatusBadge';
import { relativeTime } from '@/lib/recentRecordRoute';
import { emailStatusExplanation } from '@/lib/emailStatus';
import { documentSendsKey } from '@/lib/documentSends';
import { cn } from '@/lib/utils';

const VISIBLE_SENDS = 5;

// DocumentSendHistory is the "Email history" card on a document's detail page:
// each time the document was emailed, to whom, when, and what actually happened
// to the email. Refreshes on mount, on window focus, after a send, and on
// demand — a delivery result can arrive a minute after the send.
export function DocumentSendHistory({ recordId }: { recordId: string }) {
  const [showAll, setShowAll] = useState(false);
  const sends = useQuery({
    queryKey: documentSendsKey(recordId),
    queryFn: () => documentService.listSends(recordId),
    enabled: recordId !== '',
  });

  const rows = sends.data ?? [];
  const visible = showAll ? rows : rows.slice(0, VISIBLE_SENDS);
  const hidden = rows.length - visible.length;

  return (
    <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-3 space-y-2 mb-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-stone-400">Email history</p>
        <button
          type="button"
          onClick={() => void sends.refetch()}
          aria-label="Refresh email history"
          className="rounded p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
        >
          <RefreshCw className={cn('size-3.5', sends.isFetching && 'animate-spin')} />
        </button>
      </div>

      {sends.isError && <p className="text-2xs text-stone-500">Couldn’t load email history.</p>}
      {sends.isSuccess && rows.length === 0 && <p className="text-2xs text-stone-500">Not emailed yet.</p>}

      {visible.length > 0 && (
        <ul className="space-y-2">
          {visible.map((s) => {
            const explanation = emailStatusExplanation(s);
            return (
              <li key={s.id} className="space-y-0.5 border-b border-stone-100 pb-2 last:border-0 last:pb-0">
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 text-xs text-stone-700 break-words">{s.sentTo}</p>
                  <EmailStatusBadge source={s} />
                </div>
                <p className="text-2xs text-stone-400 break-words" title={new Date(s.sentAt).toLocaleString()}>
                  {s.cc ? `cc ${s.cc} · ` : ''}
                  {relativeTime(s.sentAt)}
                </p>
                {explanation && <p className="text-2xs text-stone-500">{explanation}</p>}
              </li>
            );
          })}
        </ul>
      )}

      {hidden > 0 && (
        <button type="button" onClick={() => setShowAll(true)} className="text-2xs font-semibold text-stone-500 hover:text-stone-800">
          Show {hidden} more
        </button>
      )}
    </div>
  );
}
