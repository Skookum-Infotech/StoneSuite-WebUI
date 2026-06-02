import { useRef } from 'react';
import { X, Send } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { customerService } from '@/services/customerService';

type Props = {
  onClose: () => void;
};

export function InviteCustomerModal({ onClose }: Props) {
  const queryClient = useQueryClient();
  const dialogRef = useRef<HTMLDivElement>(null);

  const { mutate: sendInvitation, isPending, error } = useMutation({
    mutationFn: customerService.sendInvitation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const get = (key: string) => String(form.get(key) ?? '').trim();
    const expiresInHours = parseInt(get('expiresInHours'), 10) || 24;

    sendInvitation({
      companyName: get('companyName'),
      recipientName: get('recipientName'),
      recipientEmail: get('recipientEmail'),
      expiresInHours,
    });
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  const errorMessage = error instanceof AxiosError
    ? error.response?.data?.message ?? error.message
    : error instanceof Error
      ? error.message
      : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label="Invite customer"
    >
      <div
        ref={dialogRef}
        className="w-full max-w-md rounded-xl border border-stone-200 bg-white shadow-xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100">
              <Send className="size-3.5 text-blue-600" />
            </div>
            <h2 className="text-sm font-bold text-stone-800">Invite Customer</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="rounded p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-600 transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          <p className="text-xs text-stone-500">
            Send an email invitation with a secure link for the customer to complete their own onboarding.
          </p>

          <div className="space-y-3">
            <Field label="Company Name" required>
              <input
                name="companyName"
                required
                autoFocus
                placeholder="Acme Corp"
                className={inputClass}
              />
            </Field>
            <Field label="Recipient Name" required>
              <input
                name="recipientName"
                required
                placeholder="Jane Smith"
                className={inputClass}
              />
            </Field>
            <Field label="Email Address" required>
              <input
                name="recipientEmail"
                type="email"
                required
                placeholder="jane@acme.com"
                className={inputClass}
              />
            </Field>
            <Field label="Invitation Expires In (hours)">
              <input
                name="expiresInHours"
                type="number"
                min={1}
                max={720}
                defaultValue={24}
                className={inputClass}
              />
            </Field>
          </div>

          {errorMessage && (
            <p className="text-xs text-red-500">{errorMessage}</p>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="rounded border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold text-stone-600 hover:bg-stone-50 disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center gap-1.5 rounded bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              <Send className="size-3" />
              {isPending ? 'Sending…' : 'Send Invitation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const inputClass =
  'w-full rounded border border-stone-300 bg-white px-2 py-1.5 text-xs text-stone-800 outline-none placeholder:text-stone-300 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition';

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block text-[10px] font-semibold uppercase tracking-wide text-stone-500">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}
