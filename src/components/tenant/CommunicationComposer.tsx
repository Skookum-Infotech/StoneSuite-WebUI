import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check, EyeOff, Loader2, Mail, Paperclip, Reply, X } from 'lucide-react';
import { apiErrorMessage } from '@/api/tenantClient';
import { Switch } from '@/components/ui/switch';
import { recordEmailService } from '@/services/recordEmailService';
import {
  REPLY_FILE_ACCEPT,
  REPLY_MAX_CHARS,
  REPLY_MAX_FILES,
  REPLY_MAX_TOTAL_MB,
  communicationCopy,
  composerMode,
  formatFileSize,
  recordEmailKey,
  validateReplyFiles,
} from '@/lib/recordEmail';
import { cn } from '@/lib/utils';
import type { CommunicationAudience, RecordEmailReplyRequest, RecordEmailThread } from '@/types/recordEmail';

interface CommunicationComposerProps {
  recordId: string;
  // Who a reply goes to; 'internal' is a record that only keeps team notes.
  audience: CommunicationAudience;
  // What the conversation says about itself: whether inbound email is set up
  // (`enabled`), the address a reply goes to ('' until an email has been sent), and
  // whether the workspace can keep files.
  thread: Pick<RecordEmailThread, 'enabled' | 'replyTo' | 'attachmentsEnabled'>;
  // Called once a message or note was saved, so the tab can scroll to it.
  onSent: () => void;
}

const DELIVERY_FAILED = 'The reply was saved, but the email could not be delivered.';
const NO_STORAGE_NOTICE = 'File storage is not set up for this workspace, so files cannot be attached.';

// The box under the conversation: write a message, press the reply icon, and it is
// emailed to the customer or vendor. Turn on "Internal only" and the same box saves
// a team note instead — kept on the record, never emailed. The box turns amber while
// that switch is on, so the mode is plain before anything is sent. A record that only
// keeps team notes has no switch and no amber: every message is a note. The paperclip
// attaches files (up to REPLY_MAX_FILES, REPLY_MAX_TOTAL_MB in total), to an email or
// to a note alike. A failed send keeps what was typed and attached; both are only
// cleared once the backend has accepted the message.
export function CommunicationComposer({ recordId, audience, thread, onSent }: CommunicationComposerProps) {
  const { enabled: emailEnabled, replyTo, attachmentsEnabled } = thread;
  const queryClient = useQueryClient();
  const [text, setText] = useState('');
  const [internalOnly, setInternalOnly] = useState(false);
  // Set when the reply was saved but the email did not go out (see
  // RecordEmailReplyResult.emailSent), which is not an HTTP error.
  const [deliveryError, setDeliveryError] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  // Why some of the files just picked were not added, until the next pick or removal.
  const [fileErrors, setFileErrors] = useState<string[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);

  const mode = composerMode({ emailEnabled, replyTo, internalOnly, audience });
  const copy = communicationCopy(audience);
  // Amber marks a note among emails; on a notes-only record it would be everywhere.
  const amber = mode.internal && !mode.notesOnly;
  const message = text.trim();
  const attachedBytes = files.reduce((sum, file) => sum + file.size, 0);

  const send = useMutation({
    mutationFn: (body: RecordEmailReplyRequest) => recordEmailService.reply(recordId, body),
    onMutate: () => setDeliveryError(null),
    onSuccess: (result, body) => {
      // The message is stored whether or not the email went out, so the thread
      // changes either way.
      void queryClient.invalidateQueries({ queryKey: recordEmailKey(recordId) });
      setText('');
      setFiles([]);
      setFileErrors([]);
      // Each send starts as an email to the other party again: an internal note is a
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
  const canAttach = attachmentsEnabled && !send.isPending && files.length < REPLY_MAX_FILES;

  function submit(): void {
    if (!canSend) return;
    send.mutate({ message, internalOnly: mode.internal, ...(files.length > 0 ? { files } : {}) });
  }

  function addFiles(e: React.ChangeEvent<HTMLInputElement>): void {
    const picked = Array.from(e.target.files ?? []);
    // Cleared so the same file can be chosen again after it was removed.
    e.target.value = '';
    const check = validateReplyFiles(files, picked);
    setFileErrors(check.errors);
    if (check.accepted.length > 0) setFiles((current) => [...current, ...check.accepted]);
  }

  function removeFile(index: number): void {
    setFiles((current) => current.filter((_, i) => i !== index));
    setFileErrors([]);
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
          amber
            ? 'border-amber-200 bg-amber-50 focus-within:ring-amber-300/50'
            : 'border-stone-200 bg-white focus-within:ring-brand/30',
        )}
      >
        <p className="flex items-start gap-1.5 break-words px-4 pt-3 text-xs text-stone-500">
          {mode.internal ? (
            <>
              <EyeOff className={cn('mt-0.5 size-3.5 shrink-0', amber ? 'text-amber-600' : 'text-stone-400')} aria-hidden="true" />
              <span>
                {mode.notesOnly
                  ? 'Internal note — only your team sees this.'
                  : 'Internal note — only your team sees this. Nothing is emailed.'}
              </span>
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
          placeholder={mode.internal ? 'Add an internal note…' : copy.replyPlaceholder}
          aria-label={mode.internal ? 'Internal note' : copy.replyLabel}
          className="block max-h-40 min-h-14 w-full resize-none bg-transparent px-4 py-2 text-sm leading-relaxed text-stone-900 outline-none placeholder:text-stone-500 [field-sizing:content]"
        />

        {files.length > 0 && (
          <div className="px-3 pb-2">
            <ul aria-label="Attached files" className="flex list-none flex-wrap gap-2">
              {files.map((file, index) => (
                <li
                  key={`${file.name}-${file.size}-${index}`}
                  className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-stone-200 bg-white/80 py-1 pl-2.5 pr-1 text-xs text-stone-700"
                >
                  <Paperclip className="size-3 shrink-0 text-stone-400" aria-hidden="true" />
                  <span className="max-w-48 truncate">{file.name}</span>
                  <span className="shrink-0 text-stone-500">{formatFileSize(file.size)}</span>
                  <button
                    type="button"
                    onClick={() => removeFile(index)}
                    disabled={send.isPending}
                    aria-label={`Remove ${file.name}`}
                    className="flex size-5 shrink-0 items-center justify-center rounded-full text-stone-400 hover:bg-stone-100 hover:text-stone-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-40"
                  >
                    <X className="size-3" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-1.5 text-2xs text-stone-500">
              {formatFileSize(attachedBytes)} of {REPLY_MAX_TOTAL_MB} MB
            </p>
          </div>
        )}

        <div
          className={cn(
            'flex items-center justify-between gap-3 border-t px-3 py-2',
            amber ? 'border-amber-200/70' : 'border-stone-100',
          )}
        >
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={!canAttach}
              aria-label="Attach files"
              title={
                attachmentsEnabled
                  ? `Attach files (up to ${REPLY_MAX_FILES}, ${REPLY_MAX_TOTAL_MB} MB in total)`
                  : NO_STORAGE_NOTICE
              }
              className="flex size-8 items-center justify-center rounded-full text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Paperclip className="size-4" aria-hidden="true" />
            </button>
            <input
              ref={fileInput}
              type="file"
              multiple
              accept={REPLY_FILE_ACCEPT}
              onChange={addFiles}
              aria-label="Choose files to attach"
              tabIndex={-1}
              className="hidden"
            />
            {!mode.notesOnly && (
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
            )}
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden text-2xs text-stone-500 sm:inline">Ctrl + Enter to send</span>
            <button
              type="submit"
              disabled={!canSend}
              aria-label={sendLabel}
              title={sendLabel}
              className={cn(
                'flex size-9 items-center justify-center rounded-full shadow-sm transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-40',
                amber ? 'bg-amber-500 text-white hover:bg-amber-600' : 'bg-brand text-stone-900 hover:bg-brand-hover',
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

      {mode.lockReason !== '' && <p className="px-1 text-xs text-stone-500">{mode.lockReason}</p>}
      {fileErrors.length > 0 && (
        <ul role="alert" className="list-none space-y-0.5 px-1 text-xs text-destructive">
          {fileErrors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      )}
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
