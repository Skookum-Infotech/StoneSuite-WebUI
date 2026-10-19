import { useState } from 'react';
import { relativeTime } from '@/lib/recentRecordRoute';
import { avatarInitials, senderName } from '@/lib/recordEmail';
import type { RecordEmailMessage } from '@/types/recordEmail';

// A reply longer than this is folded behind "Show more", so one long email does
// not push the rest of the conversation off the screen.
const COLLAPSE_OVER_CHARS = 600;

interface CommunicationMessageCardProps {
  message: RecordEmailMessage;
  // The last card has no rail running down to a next message.
  isLast: boolean;
}

// One email in the Communication timeline. Every message — sent or received — has
// the same look: an initials avatar joined to the next one by a vertical rail, the
// author and relative time on one line, and the message in a roomy bordered card.
// Sent emails add a quiet "To …" line inside the card; nothing else differs.
export function CommunicationMessageCard({ message, isLast }: CommunicationMessageCardProps) {
  const [expanded, setExpanded] = useState(false);
  const name = senderName(message);
  const fromStaff = message.direction === 'out';
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
          <time
            dateTime={message.createdAt}
            title={Number.isNaN(sentAt.getTime()) ? undefined : sentAt.toLocaleString()}
            className="shrink-0 text-xs text-stone-500"
          >
            {relativeTime(message.createdAt)}
          </time>
        </div>

        <div className="rounded-xl border border-stone-200 bg-white px-5 py-4">
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
