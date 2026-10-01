import { useState } from 'react';
import { Copy, KeyRound, RefreshCw } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { platformService } from '@/services/tenantServices';
import { apiErrorMessage } from '@/api/tenantClient';
import { TENANT_STATUS_COLOR } from '@/lib/tenantDisplay';
import { Badge, Spinner, ErrorNote, EmptyState } from '@/components/tenant/ui';
import { EmailStatusBadge } from '@/components/tenant/EmailStatusBadge';
import type { Tenant } from '@/types/tenant';

const COPIED_RESET_MS = 2000;
const EXPIRED_COLOR = '#ef4444';

export function TenantInvitesPanel({ tenant }: { tenant: Tenant }) {
  const qc = useQueryClient();
  const [copied, setCopied] = useState<string | null>(null);
  const invitesQ = useQuery({
    queryKey: ['invites', tenant.id],
    queryFn: () => platformService.listInvites(tenant.id),
  });

  const resend = useMutation({
    mutationFn: () => platformService.resendInvite(tenant.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invites', tenant.id] });
      qc.invalidateQueries({ queryKey: ['tenants'] });
    },
  });

  const resentNote =
    resend.isSuccess && resend.data
      ? resend.data.emailSent
        ? 'Invite re-sent — email delivered.'
        : 'Invite re-issued with a fresh key & expiry. Email could not be sent — copy the link below.'
      : null;

  // Hide resend when there are no invites at all, or every invite has been accepted.
  const hideResend =
    invitesQ.data !== undefined &&
    (invitesQ.data.length === 0 || invitesQ.data.every((inv) => inv.status === 'accepted'));

  const copy = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied((c) => (c === id ? null : c)), COPIED_RESET_MS);
  };

  return (
    <div className="border-t border-stone-100 bg-stone-50/50 px-4 py-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xs font-bold text-stone-600">Invites</h3>
        {!hideResend && (
          <button
            type="button"
            onClick={() => resend.mutate()}
            disabled={resend.isPending}
            className="inline-flex items-center gap-1 rounded-lg bg-brand px-2.5 py-1.5 text-label font-semibold text-stone-950 disabled:opacity-50"
          >
            <RefreshCw className={`size-3 ${resend.isPending ? 'animate-spin' : ''}`} />
            {resend.isPending ? 'Sending…' : 'Resend invite'}
          </button>
        )}
      </div>

      {invitesQ.isLoading && <Spinner label="Loading invites…" />}
      {invitesQ.error && <ErrorNote>{apiErrorMessage(invitesQ.error)}</ErrorNote>}
      {resend.error && (
        <div className="mb-2">
          <ErrorNote>{apiErrorMessage(resend.error)}</ErrorNote>
        </div>
      )}
      {resentNote && (
        <p className="mb-2 rounded-lg bg-brand/15 px-3 py-2 text-label font-medium text-stone-600">{resentNote}</p>
      )}
      {invitesQ.data && invitesQ.data.length === 0 && <EmptyState>No invites yet.</EmptyState>}

      <div className="space-y-2">
        {invitesQ.data?.map((inv) => {
          const status = inv.expired ? 'expired' : inv.status;
          return (
            <div key={inv.id} className="rounded-lg border border-stone-200 bg-white p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-stone-700">{inv.contactEmail}</span>
                <Badge color={inv.expired ? EXPIRED_COLOR : TENANT_STATUS_COLOR[inv.status]}>{status}</Badge>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <KeyRound className="size-3.5 shrink-0 text-stone-400" />
                <code className="flex-1 truncate rounded bg-stone-100 px-2 py-1 text-label text-stone-600">{inv.token}</code>
                <button
                  type="button"
                  onClick={() => copy(inv.token, `key-${inv.id}`)}
                  aria-label="Copy invite key"
                  className="rounded p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
                >
                  <Copy className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => copy(inv.inviteLink, `link-${inv.id}`)}
                  className="rounded-md border border-stone-200 px-2 py-1 text-2xs font-semibold text-stone-500 hover:bg-stone-100"
                >
                  {copied === `link-${inv.id}` ? 'Link copied' : copied === `key-${inv.id}` ? 'Key copied' : 'Copy link'}
                </button>
              </div>
              <p className="mt-1.5 text-2xs text-stone-400">
                Expires {new Date(inv.expiresAt).toLocaleString()}
                {inv.acceptedAt && ` · accepted ${new Date(inv.acceptedAt).toLocaleDateString()}`}
              </p>
              {inv.status === 'pending' && (
                <div className="mt-1.5">
                  <EmailStatusBadge source={inv} showMessage />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
