import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Send } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { documentService } from '@/services/documentService';
import { apiErrorMessage } from '@/api/tenantClient';
import type { DocumentSendResult } from '@/services/documentService';

interface SendToCustomerDialogProps {
  recordId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipientEmail: string;
  label: string;
  onSent: (result: DocumentSendResult) => void;
}

// Shared across every document detail page that gates a "Send to Customer"
// quick action behind its own required-field validation (Sales Order, Quote,
// Estimate, Invoice) — the backend's document/send route is generic and
// record-keyed (see documentService), so this dialog is too. Controlled: the
// caller runs its own field validation on click and only flips `open` once
// the record is actually sendable.
export function SendToCustomerDialog({
  recordId,
  open,
  onOpenChange,
  recipientEmail,
  label,
  onSent,
}: SendToCustomerDialogProps) {
  const send = useMutation({
    mutationFn: () => documentService.sendToCustomer(recordId),
    onSuccess: (result) => {
      onOpenChange(false);
      onSent(result);
    },
  });

  const cancelRef = useRef<HTMLButtonElement>(null);
  const sendRef = useRef<HTMLButtonElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  // Hand-rolled portal (no Radix Dialog underneath), so focus trap/return and
  // Escape-to-close have to be done manually here — moving focus in on open
  // and back to the trigger on close, since a portaled dialog otherwise
  // leaves keyboard/screen-reader focus stranded on `document.body`.
  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();
    return () => previouslyFocused.current?.focus?.();
  }, [open]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      onOpenChange(false);
      return;
    }
    if (e.key !== 'Tab') return;
    // Only two focusable elements in this dialog — a minimal trap that wraps
    // Tab/Shift+Tab between them instead of leaking into the page behind it.
    if (e.shiftKey && document.activeElement === cancelRef.current) {
      e.preventDefault();
      sendRef.current?.focus();
    } else if (!e.shiftKey && document.activeElement === sendRef.current) {
      e.preventDefault();
      cancelRef.current?.focus();
    }
  }

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="send-to-customer-dialog-title"
      onClick={(e) => e.target === e.currentTarget && onOpenChange(false)}
      onKeyDown={handleKeyDown}
    >
      <div className="mx-4 w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex size-9 flex-shrink-0 items-center justify-center rounded-full bg-brand/10">
            <Send className="size-4 text-stone-700" />
          </div>
          <div>
            <h3 id="send-to-customer-dialog-title" className="text-sm font-bold text-stone-900">
              Send to customer?
            </h3>
            <p className="text-xs text-stone-400 mt-0.5">An email with this order will be sent.</p>
          </div>
        </div>

        <p className="text-xs text-stone-600 mb-4">
          <span className="font-semibold">{label}</span> will be emailed to{' '}
          <span className="font-semibold">{recipientEmail}</span>.
        </p>

        {send.error && (
          <p className="mb-3 text-xs text-destructive">
            {apiErrorMessage(send.error, 'Failed to send document.')}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={send.isPending}
            aria-label="Cancel sending to customer"
            className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            ref={sendRef}
            type="button"
            onClick={() => send.mutate()}
            disabled={send.isPending}
            aria-label="Confirm send to customer"
            className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-stone-900 hover:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-all"
          >
            {send.isPending ? 'Sending…' : 'Send to Customer'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
