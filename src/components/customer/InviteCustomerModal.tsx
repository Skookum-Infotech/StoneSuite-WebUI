import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, Send, Copy } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { platformService } from '@/services/tenantServices';
import { apiErrorMessage } from '@/api/tenantClient';
import type { CreateTenantResult } from '@/types/tenant';

const inviteSchema = z.object({
  companyName: z.string().min(1, 'Company name is required'),
  recipientName: z.string().optional(),
  contactEmail: z.string().min(1, 'Email is required').email('Enter a valid email'),
  expiresInHours: z.number().int().min(1, 'Must be at least 1 hour'),
});
type InviteFields = z.infer<typeof inviteSchema>;

const inputClass =
  'w-full rounded border border-stone-300 bg-white px-2.5 py-1.5 text-xs text-stone-800 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition';

export function InviteCustomerModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [result, setResult] = useState<CreateTenantResult | null>(null);
  const [copied, setCopied] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<InviteFields>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { expiresInHours: 24 },
  });

  const invite = useMutation({
    mutationFn: (vars: InviteFields) =>
      platformService.inviteCustomer({
        companyName: vars.companyName,
        recipientName: vars.recipientName ?? '',
        contactEmail: vars.contactEmail,
        expiresInHours: vars.expiresInHours,
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['tenants'] });
      setResult(res);
    },
  });

  const copyLink = async () => {
    if (!result?.inviteLink) return;
    await navigator.clipboard.writeText(result.inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label="Invite customer"
    >
      <div className="w-full max-w-md rounded-xl border border-stone-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-stone-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand/20">
              <Send className="size-3.5 text-brand-dark" />
            </div>
            <h2 className="text-sm font-bold text-stone-800">Invite Customer</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-600">
            <X className="size-4" />
          </button>
        </div>

        {result ? (
          <div className="space-y-4 px-5 py-5">
            <p className="text-xs text-stone-500">
              Invite created{result.emailSent ? ' and emailed' : ''}. Share this link so the customer can complete
              their onboarding{result.emailSent ? '' : ' (email not configured — copy it)'}:
            </p>
            <div className="flex items-center gap-2 rounded-lg border border-stone-200 bg-stone-50 p-2">
              <code className="flex-1 truncate px-2 text-label text-stone-700">{result.inviteLink}</code>
              <button type="button" onClick={copyLink} aria-label="Copy invite link" className="flex items-center gap-1 rounded-md bg-brand px-2.5 py-1.5 text-label font-semibold text-stone-950">
                <Copy className="size-3.5" /> {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <button type="button" onClick={onClose} className="w-full rounded-lg bg-brand py-2 text-xs font-semibold text-stone-950">
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit((data) => invite.mutate(data))} className="space-y-4 px-5 py-4">
            <p className="text-xs text-stone-500">
              Send an email invitation with a secure link for the customer to complete their own onboarding.
            </p>
            <Field label="Company Name" required error={errors.companyName?.message}>
              <input {...register('companyName')} autoFocus placeholder="Acme Corp" className={inputClass} aria-invalid={Boolean(errors.companyName)} />
            </Field>
            <Field label="Recipient Name">
              <input {...register('recipientName')} placeholder="Jane Doe" className={inputClass} />
            </Field>
            <Field label="Recipient Email" required error={errors.contactEmail?.message}>
              <input {...register('contactEmail')} type="email" placeholder="jane@acme.com" className={inputClass} aria-invalid={Boolean(errors.contactEmail)} />
            </Field>
            <Field label="Invite expires in (hours)" error={errors.expiresInHours?.message}>
              <input {...register('expiresInHours', { valueAsNumber: true })} type="number" min={1} className={inputClass} aria-invalid={Boolean(errors.expiresInHours)} />
            </Field>
            {invite.error && <p className="text-xs text-red-600">{apiErrorMessage(invite.error)}</p>}
            <button type="submit" disabled={invite.isPending} className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand py-2 text-xs font-semibold text-stone-950 hover:bg-brand-hover disabled:opacity-50">
              <Send className="size-3.5" /> {invite.isPending ? 'Sending…' : 'Send Invite'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-label font-semibold text-stone-600">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
