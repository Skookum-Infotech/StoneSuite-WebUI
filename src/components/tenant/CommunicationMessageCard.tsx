import { useState } from 'react';
import { EyeOff } from 'lucide-react';
import { relativeTime } from '@/lib/recentRecordRoute';
import { avatarInitials, senderName } from '@/lib/recordEmail';
import { cn } from '@/lib/utils';
import type { CommunicationAudience, RecordEmailMessage } from '@/types/recordEmail';

// A reply longer than this is folded behind "Show more", so one long email does
// not push the rest of the conversation off the screen.
const COLLAPSE_OVER_CHARS = 600;

interface CommunicationMessageCardProps {
  message: RecordEmailMessage;
  // Who the conversation is with; names an unknown sender, and on a team-notes
  // record ('internal') stops every card being flagged as an internal note.
  audience: CommunicationAudience;
  // The last card has no rail running down to a next message.
  isLast: boolean;
}

// One message in the Communication timeline. Every email — sent or received — has
// the same look: an initials avatar joined to the next one by a vertical rail, the
// author and relative time on one line, and the message in a roomy bordered card.
// Sent emails add a quiet "To …" line inside the card. An internal note is the one
// thing that looks different: an amber card with an "Internal" badge, so nobody
// mistakes it for something the customer or vendor received. On a record that only
// keeps team notes every card is a note, so none is marked.
export function CommunicationMessageCard({ message, audience, isLast }: CommunicationMessageCardProps) {
  const [expanded, setExpanded] = useState(false);
  const name = senderName(message, audience);
  const fromStaff = message.direction === 'out';
  const internal = message.internal && audience !== 'internal';
  const sentAt = new Date(message.createdAt);
  const body = message.body || '(no message)';
  const foldable = body.length > COLLAPSE_OVER_CHARS;

  return (
    <li className="relative flex gap-4 pb-8 last:pb-0">
      {!isLast && <span aria-hidden="true" className="absolute left-5 top-12 bottom-1 w-px bg-stone-200" />}

      <span
        aria-hidden="true"
        className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-lime text-sm font-semibold text-accent-foreground"
      >
        {avatarInitials(name)}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3 pb-2 pt-1.5">
          <p className="min-w-0 truncate text-sm font-semibold text-stone-950">{name}</p>
          <div className="flex shrink-0 items-center gap-2">
            {internal && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-2xs font-semibold text-amber-700">
                <EyeOff className="size-2.5" aria-hidden="true" />
                Internal note
              </span>
            )}
            <time
              dateTime={message.createdAt}
              title={Number.isNaN(sentAt.getTime()) ? undefined : sentAt.toLocaleString()}
              className="text-xs text-stone-500"
            >
              {relativeTime(message.createdAt)}
            </time>
          </div>
        </div>

        <div
          className={cn(
            'rounded-xl border px-5 py-4',
            internal ? 'border-amber-200 bg-amber-50' : 'border-stone-200 bg-white',
          )}
        >
          {fromStaff && message.to && (
            <p className="mb-3 break-words text-xs text-stone-500">
              To {message.to}
              {message.cc ? ` · cc ${message.cc}` : ''}
            </p>
          )}
          <p
            className={
              'whitespace-pre-wrap break-words text-sm leading-relaxed text-stone-900' +
              (foldable && !expanded ? ' line-clamp-6' : '')
            }
          >
            {body}
          </p>
          {foldable && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              className="mt-2 text-xs font-medium text-stone-600 underline-offset-2 hover:text-stone-900 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              {expanded ? 'Show less' : 'Show more'}
            </button>
          )}
          {message.attachmentCount > 0 && (
            <p className="mt-3 text-xs italic text-stone-400">
              {message.attachmentCount === 1
                ? 'This email had 1 attachment (not shown).'
                : `This email had ${message.attachmentCount} attachments (not shown).`}
            </p>
          )}
        </div>
      </div>
    </li>
  );
}
