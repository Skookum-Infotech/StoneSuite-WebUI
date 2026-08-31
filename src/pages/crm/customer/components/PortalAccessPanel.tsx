import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  KeyRound, Plus, Send, PauseCircle, PlayCircle, XCircle, Loader2,
} from "lucide-react";
import { portalAccessService } from "@/services/portalAccessService";
import { apiErrorMessage } from "@/api/tenantClient";
import { Spinner, ErrorNote, EmptyState } from "@/components/tenant/ui";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { GrantPortalAccessModal } from "@/components/customer/GrantPortalAccessModal";
import { PortalUserStatusBadge } from "@/components/customer/PortalUserStatusBadge";
import { PortalInviteStatusBadge } from "@/components/customer/PortalInviteStatusBadge";
import { cn } from "@/lib/utils";
import type { PortalUser } from "@/types/portalUser";

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

// Shared shape for the per-login row actions (Resend / Suspend / Resume /
// Revoke) — icon + short text label, colour set per action by the caller.
const actionBtnCls =
  "flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50";

// Manages the one portal login a customer may hold — grant, suspend/resume,
// revoke, resend invite. The login is always the customer record's own contact
// email (customer_contact_email), so there is no address to choose: one
// customer, one login. Lives as a tab on CustomerDetailPage; the tenant-wide
// roster across every customer is a separate Config page
// (portalAccessService.listForTenant).
export function PortalAccessPanel({
  customerUuid,
  customerApproved,
  contactEmail,
  contactName,
}: {
  customerUuid: string;
  // Mirrors the backend's CustomerEligible gate (portal/store.go) — granting
  // is refused server-side (409) until the customer record is approved.
  // Disabling the action here up front avoids a click that's guaranteed to
  // fail; suspend/resume/revoke on an already-granted login are unaffected —
  // that gate only applies to a first grant, same as the backend.
  customerApproved: boolean;
  // The customer record's contact email (customer_contact_email) — the address
  // the portal login is minted for. Required at record creation, so normally
  // always present; the grant action is disabled if it is somehow blank.
  contactEmail: string;
  // Display name for the login — the authorized contact, falling back to the
  // company name. Sent alongside the email when granting.
  contactName: string;
}) {
  const qc = useQueryClient();
  const { hasPermission, isLoading: permissionsLoading } = useUserPermissions();
  const canCreate = permissionsLoading || hasPermission("portal_access", "create");
  const canUpdate = permissionsLoading || hasPermission("portal_access", "update");
  const canDelete = permissionsLoading || hasPermission("portal_access", "delete");

  const [showGrantModal, setShowGrantModal] = useState(false);
  const [confirmRevokeId, setConfirmRevokeId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const usersQ = useQuery({
    queryKey: ["portal-users", customerUuid],
    queryFn: () => portalAccessService.listForCustomer(customerUuid),
    enabled: Boolean(customerUuid),
  });
  const users = usersQ.data ?? [];

  // One login per customer: once a live (active or suspended) login exists,
  // there is nothing left to grant. A history of only revoked logins still
  // allows a fresh grant — the backend reactivates the same identity row.
  const hasLiveLogin = users.some(
    (u) => u.status === "active" || u.status === "suspended",
  );
  const hasContactEmail = contactEmail.trim().length > 0;
  const canGrant = customerApproved && hasContactEmail;

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["portal-users", customerUuid] });
  }

  const resendMut = useMutation({
    mutationFn: (id: string) => portalAccessService.resendInvite(customerUuid, id),
    onSuccess: () => { setActionError(null); invalidate(); },
    onError: (err) => setActionError(apiErrorMessage(err, "Failed to resend invitation.")),
  });
  const suspendMut = useMutation({
    mutationFn: (id: string) => portalAccessService.suspend(customerUuid, id),
    onSuccess: () => { setActionError(null); invalidate(); },
    onError: (err) => setActionError(apiErrorMessage(err, "Failed to suspend portal login.")),
  });
  const resumeMut = useMutation({
    mutationFn: (id: string) => portalAccessService.resume(customerUuid, id),
    onSuccess: () => { setActionError(null); invalidate(); },
    onError: (err) => setActionError(apiErrorMessage(err, "Failed to resume portal login.")),
  });
  const revokeMut = useMutation({
    mutationFn: (id: string) => portalAccessService.revoke(customerUuid, id),
    onSuccess: () => { setActionError(null); setConfirmRevokeId(null); invalidate(); },
    onError: (err) => setActionError(apiErrorMessage(err, "Failed to revoke portal login.")),
  });

  const busyId: string | null =
    [resendMut, suspendMut, resumeMut, revokeMut]
      .find((m) => m.isPending)?.variables ?? null;

  return (
    <div className="rounded-xl border border-stone-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-stone-100 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand/20 text-brand-dark">
            <KeyRound className="size-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-stone-800">Portal Access</h3>
            <p className="text-2xs text-stone-500">How this customer signs in to the portal.</p>
          </div>
        </div>
        {canCreate && !hasLiveLogin && (
          <button
            type="button"
            onClick={() => setShowGrantModal(true)}
            disabled={!canGrant}
            aria-label="Grant portal access"
            title={
              !customerApproved
                ? "Approve this customer record first."
                : !hasContactEmail
                  ? "Add a contact email to this customer record first."
                  : undefined
            }
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-stone-950 transition hover:bg-brand-hover",
              !canGrant && "opacity-50 cursor-not-allowed hover:bg-brand",
            )}
          >
            <Plus className="size-3.5" />
            Grant access
          </button>
        )}
      </div>

      <div className="p-4">
        {!hasLiveLogin && !customerApproved && (
          <div className="mb-3">
            <ErrorNote>
              Portal access can only be granted once this customer record is approved.
            </ErrorNote>
          </div>
        )}
        {!hasLiveLogin && customerApproved && !hasContactEmail && (
          <div className="mb-3">
            <ErrorNote>
              Add a contact email to this customer record before granting portal access.
            </ErrorNote>
          </div>
        )}
        {actionError && (
          <div className="mb-3">
            <ErrorNote>{actionError}</ErrorNote>
          </div>
        )}

        {usersQ.isLoading && <Spinner label="Loading portal logins…" />}
        {usersQ.isError && (
          <ErrorNote>{apiErrorMessage(usersQ.error, "Failed to load portal logins.")}</ErrorNote>
        )}
        {!usersQ.isLoading && !usersQ.isError && users.length === 0 && (
          <EmptyState>No portal logins granted yet.</EmptyState>
        )}

        {users.length > 0 && (
          <div className="space-y-2">
            {users.map((u) => (
              <PortalUserRow
                key={u.id}
                user={u}
                busy={busyId === u.id}
                canUpdate={canUpdate}
                canDelete={canDelete}
                confirmingRevoke={confirmRevokeId === u.id}
                onResend={() => resendMut.mutate(u.id)}
                onSuspend={() => suspendMut.mutate(u.id)}
                onResume={() => resumeMut.mutate(u.id)}
                onRequestRevoke={() => setConfirmRevokeId(u.id)}
                onCancelRevoke={() => setConfirmRevokeId(null)}
                onConfirmRevoke={() => revokeMut.mutate(u.id)}
                revoking={revokeMut.isPending && revokeMut.variables === u.id}
              />
            ))}
          </div>
        )}
      </div>

      {showGrantModal && (
        <GrantPortalAccessModal
          customerUuid={customerUuid}
          contactEmail={contactEmail}
          contactName={contactName}
          onClose={() => setShowGrantModal(false)}
        />
      )}
    </div>
  );
}

function PortalUserRow({
  user, busy, canUpdate, canDelete, confirmingRevoke,
  onResend, onSuspend, onResume, onRequestRevoke, onCancelRevoke, onConfirmRevoke, revoking,
}: {
  user: PortalUser;
  busy: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  confirmingRevoke: boolean;
  onResend: () => void;
  onSuspend: () => void;
  onResume: () => void;
  onRequestRevoke: () => void;
  onCancelRevoke: () => void;
  onConfirmRevoke: () => void;
  revoking: boolean;
}) {
  // Nothing to resend once the invite has been accepted (a password is set) —
  // mirrors the backend's own check (controllers/portal_access.go's
  // ResendPortalInvite, which 409s once identity.PasswordHash is non-empty).
  const canResend = user.status === "active" && (user.inviteStatus === "pending" || user.inviteStatus === "expired");

  // The revoke trigger is replaced by an inline confirm block rather than
  // navigating anywhere, so focus has to be moved by hand in both directions
  // — otherwise a keyboard user's focus silently drops to <body> each time.
  const revokeTriggerRef = useRef<HTMLButtonElement>(null);
  const confirmRevokeRef = useRef<HTMLButtonElement>(null);
  const wasConfirmingRevoke = useRef(confirmingRevoke);
  useEffect(() => {
    if (confirmingRevoke && !wasConfirmingRevoke.current) {
      confirmRevokeRef.current?.focus();
    } else if (!confirmingRevoke && wasConfirmingRevoke.current) {
      revokeTriggerRef.current?.focus();
    }
    wasConfirmingRevoke.current = confirmingRevoke;
  }, [confirmingRevoke]);

  return (
    <div className="rounded-lg border border-stone-200 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-stone-800 truncate">
              {user.fullName || user.email}
            </p>
            <PortalUserStatusBadge status={user.status} />
            <PortalInviteStatusBadge status={user.inviteStatus} expiresAt={user.inviteExpiresAt} />
          </div>
          {user.fullName && (
            <p className="text-xs text-stone-500 truncate">{user.email}</p>
          )}
          <p className="text-2xs text-stone-400 mt-0.5">
            Granted {fmtDate(user.createdAt)}
          </p>
        </div>

        {!confirmingRevoke && (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
            {canResend && canUpdate && (
              <button
                type="button"
                onClick={onResend}
                disabled={busy}
                aria-label={`Resend invitation to ${user.email}`}
                className={cn(actionBtnCls, "text-stone-600 hover:bg-stone-100 hover:text-stone-800")}
              >
                <Send className="size-3.5" />
                Resend
              </button>
            )}
            {user.status === "active" && canUpdate && (
              <button
                type="button"
                onClick={onSuspend}
                disabled={busy}
                aria-label={`Suspend portal access for ${user.email}`}
                className={cn(actionBtnCls, "text-amber-700 hover:bg-amber-50")}
              >
                <PauseCircle className="size-3.5" />
                Suspend
              </button>
            )}
            {user.status === "suspended" && canUpdate && (
              <button
                type="button"
                onClick={onResume}
                disabled={busy}
                aria-label={`Resume portal access for ${user.email}`}
                className={cn(actionBtnCls, "text-emerald-700 hover:bg-emerald-50")}
              >
                <PlayCircle className="size-3.5" />
                Resume
              </button>
            )}
            {user.status !== "revoked" && canDelete && (
              <button
                ref={revokeTriggerRef}
                type="button"
                onClick={onRequestRevoke}
                disabled={busy}
                aria-label={`Revoke portal access for ${user.email}`}
                className={cn(actionBtnCls, "text-red-600 hover:bg-red-50")}
              >
                <XCircle className="size-3.5" />
                Revoke
              </button>
            )}
          </div>
        )}
      </div>

      {confirmingRevoke && (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-2.5 space-y-2">
          <p className="text-xs font-medium text-red-700">
            Revoke portal access for {user.email}? This ends their session immediately and cannot be undone from here — access would need to be granted again.
          </p>
          <div className="flex gap-2">
            <button
              ref={confirmRevokeRef}
              type="button"
              onClick={onConfirmRevoke}
              disabled={revoking}
              className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
            >
              {revoking && <Loader2 className="size-3 animate-spin" />}
              Yes, revoke
            </button>
            <button
              type="button"
              onClick={onCancelRevoke}
              disabled={revoking}
              className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
