import { useQuery } from "@tanstack/react-query";
import { KeyRound } from "lucide-react";
import { DeleteRecordDialog } from "@/components/crm/DeleteRecordDialog";
import { portalAccessService } from "@/services/portalAccessService";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import type { PortalUser } from "@/types/portalUser";

// Wraps the shared DeleteRecordDialog for the Customer workflow: a customer
// with a portal login that can still sign in (active or suspended) must have
// that access revoked first, otherwise the record's soft-delete would orphan
// the portal user, its control-plane link, invites and refresh tokens. Staff
// revoke access from the Portal Access tab (PortalAccessPanel), which tears all
// of that down together. The backend enforces the same rule with a 409 — this
// is the friendly, pre-emptive version of it.
export function CustomerDeleteButton({
  recordId,
  company,
  onDeleted,
  onManagePortal,
}: {
  recordId: string;
  company: string;
  onDeleted: () => void;
  onManagePortal: () => void;
}) {
  const { hasPermission, isLoading: permissionsLoading } = useUserPermissions();
  const canReadPortalAccess = permissionsLoading || hasPermission("portal_access", "read");

  const { data: portalUsers, isSuccess } = useQuery({
    // Same key PortalAccessStatusCard / PortalAccessPanel use — mounting this
    // alongside them costs one fetch, not two.
    queryKey: ["portal-users", recordId],
    queryFn: () => portalAccessService.listForCustomer(recordId),
    enabled: Boolean(recordId) && canReadPortalAccess,
  });

  const blockingUsers: PortalUser[] = (portalUsers ?? []).filter(
    (u) => u.status === "active" || u.status === "suspended",
  );

  // Only block once we have actually confirmed a live login. If the caller
  // can't read portal access, or the list hasn't loaded, let the delete
  // proceed — the backend 409 is the backstop.
  const blocked = isSuccess && blockingUsers.length > 0;

  return (
    <DeleteRecordDialog
      recordId={recordId}
      workflowKey="customer"
      label={`Customer — ${company}`}
      onDeleted={onDeleted}
      guard={{
        blocked,
        content: (close) => (
          <div className="space-y-3">
            <p className="text-xs text-stone-600">
              <span className="font-semibold">{company}</span> has{" "}
              {blockingUsers.length === 1 ? "a portal login" : `${blockingUsers.length} portal logins`} that
              can still access the workspace. Revoke portal access before deleting this customer.
            </p>
            <ul className="rounded-lg border border-stone-200 bg-stone-50 divide-y divide-stone-100">
              {blockingUsers.map((u) => (
                <li key={u.id} className="flex items-center gap-2 px-3 py-2 text-xs text-stone-700">
                  <KeyRound className="size-3.5 shrink-0 text-stone-400" />
                  <span className="truncate">{u.email}</span>
                  <span className="ml-auto shrink-0 text-stone-400 capitalize">{u.status}</span>
                </li>
              ))}
            </ul>
            <button
              type="button"
              aria-label="Manage portal access"
              onClick={() => {
                close();
                onManagePortal();
              }}
              className="text-xs font-semibold text-brand-dark hover:underline"
            >
              Manage portal access →
            </button>
          </div>
        ),
      }}
    />
  );
}
