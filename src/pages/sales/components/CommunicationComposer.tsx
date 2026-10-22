import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check, EyeOff, Loader2, Mail, Reply } from 'lucide-react';
import { apiErrorMessage } from '@/api/tenantClient';
import { Switch } from '@/components/ui/switch';
import { recordEmailService } from '@/services/recordEmailService';
import { REPLY_MAX_CHARS, composerMode, recordEmailKey } from '@/lib/recordEmail';
import { cn } from '@/lib/utils';
import type { RecordEmailReplyRequest } from '@/types/recordEmail';

interface CommunicationComposerProps {
  orderId: string;
  // Inbound email is set up for the workspace (the thread's `enabled`).
  emailEnabled: boolean;
  // The customer address a reply goes to; '' until an email has been sent.
  replyTo: string;
  // Called once a message or note was saved, so the tab can scroll to it.
  onSent: () => void;
}

const DELIVERY_FAILED = 'The reply was saved, but the email could not be delivered.';

// The box under the conversation: write a message, press the reply icon, and it is
// emailed to the customer. Turn on "Internal only" and the same box saves a team
// note instead — kept on the order, never emailed. The box turns amber while that
// switch is on, so the mode is plain before anything is sent. A failed send keeps
// what was typed; it is only cleared once the backend has accepted it.
export function CommunicationComposer({ orderId, emailEnabled, replyTo, onSent }: CommunicationComposerProps) {
  const queryClient = useQueryClient();
  const [text, setText] = useState('');
  const [internalOnly, setInternalOnly] = useState(false);
  // Set when the reply was saved but the email did not go out (see
  // RecordEmailReplyResult.emailSent), which is not an HTTP error.
  const [deliveryError, setDeliveryError] = useState<string | null>(null);

  const mode = composerMode({ emailEnabled, replyTo, internalOnly });
  const message = text.trim();

  const send = useMutation({
    mutationFn: (body: RecordEmailReplyRequest) => recordEmailService.reply(orderId, body),
    onMutate: () => setDeliveryError(null),
    onSuccess: (result, body) => {
      // The message is stored whether or not the email went out, so the thread
      // changes either way.
      void queryClient.invalidateQueries({ queryKey: recordEmailKey(orderId) });
      setText('');
      // Each send starts as an email to the customer again: an internal note is a
      // deliberate choice, never a leftover from the last message.
      setInternalOnly(false);
      onSent();
      if (body.internalOnly) {
        toast.success('Internal note saved.');
      } else if (result.emailSent === false) {
        setDeliveryError(result.emailError ? `${DELIVERY_FAILED} ${result.emailError}` : DELIVERY_FAILED);
      } else {
        toast.success(`Reply sent to ${replyTo}.`);
      }
    },
  });

  const canSend = message !== '' && !send.isPending;

  function submit(): void {
    if (!canSend) return;
    send.mutate({ message, internalOnly: mode.internal });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>): void {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      submit();
    }
  }

  const sendLabel = mode.internal ? 'Save internal note' : 'Send reply';

  return (
    <div className="space-y-2">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        noValidate
        aria-label="Add to the conversation"
        className={cn(
          'rounded-2xl border shadow-sm transition-colors focus-within:ring-2',
          mode.internal
            ? 'border-amber-200 bg-amber-50 focus-within:ring-amber-300/50'
            : 'border-stone-200 bg-white focus-within:ring-brand/30',
        )}
      >
        <p className="flex items-start gap-1.5 break-words px-4 pt-3 text-xs text-stone-500">
          {mode.internal ? (
            <>
              <EyeOff className="mt-0.5 size-3.5 shrink-0 text-amber-600" aria-hidden="true" />
              <span>Internal note — only your team sees this. Nothing is emailed.</span>
            </>
          ) : (
            <>
              <Mail className="mt-0.5 size-3.5 shrink-0 text-stone-400" aria-hidden="true" />
              <span>
                Replying to <span className="font-medium text-stone-700">{replyTo}</span>
              </span>
            </>
          )}
        </p>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          readOnly={send.isPending}
          rows={2}
          maxLength={REPLY_MAX_CHARS}
          placeholder={mode.internal ? 'Add an internal note…' : 'Write a reply to the customer…'}
          aria-label={mode.internal ? 'Internal note' : 'Reply to the customer'}
          className="block max-h-40 min-h-14 w-full resize-none bg-transparent px-4 py-2 text-sm leading-relaxed text-stone-900 outline-none placeholder:text-stone-400 [field-sizing:content]"
        />

        <div
          className={cn(
            'flex items-center justify-between gap-3 border-t px-3 py-2',
            mode.internal ? 'border-amber-200/70' : 'border-stone-100',
          )}
        >
          <label htmlFor="comm-internal-only" className="flex cursor-pointer items-center gap-2 text-xs font-medium text-stone-600">
            <Switch
              id="comm-internal-only"
              checked={mode.internal}
              onCheckedChange={setInternalOnly}
              disabled={mode.locked || send.isPending}
              className="data-checked:bg-amber-500"
            />
            Internal only
          </label>

          <div className="flex items-center gap-3">
            <span className="hidden text-2xs text-stone-400 sm:inline">Ctrl + Enter to send</span>
            <button
              type="submit"
              disabled={!canSend}
              aria-label={sendLabel}
              title={sendLabel}
              className={cn(
                'flex size-9 items-center justify-center rounded-full shadow-sm transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-40',
                mode.internal ? 'bg-amber-500 text-white hover:bg-amber-600' : 'bg-brand text-stone-900 hover:bg-brand-hover',
              )}
            >
              {send.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : mode.internal ? (
                <Check className="size-4" aria-hidden="true" />
              ) : (
                <Reply className="size-4" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </form>

      {mode.locked && <p className="px-1 text-xs text-stone-500">{mode.lockReason}</p>}
      {send.isError && (
        <p role="alert" className="px-1 text-xs text-destructive">
          {apiErrorMessage(send.error, send.variables?.internalOnly ? 'Failed to save the note.' : 'Failed to send the reply.')}
        </p>
      )}
      {deliveryError && (
        <p role="alert" className="px-1 text-xs text-destructive">
          {deliveryError}
        </p>
      )}
    </div>
  );
}
