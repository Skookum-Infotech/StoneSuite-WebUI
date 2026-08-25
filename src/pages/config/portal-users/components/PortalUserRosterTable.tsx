import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, PauseCircle, PlayCircle, Loader2 } from "lucide-react";
import { portalAccessService } from "@/services/portalAccessService";
import { apiErrorMessage } from "@/api/tenantClient";
import { EmptyState, ErrorNote } from "@/components/tenant/ui";
import { PortalUserStatusBadge } from "@/components/customer/PortalUserStatusBadge";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { cn } from "@/lib/utils";
import type { PortalUserRosterEntry } from "@/types/portalUser";

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

// Roster with an inline enable/disable toggle — reversible only (suspend /
// resume), never a delete. Permanent revoke and resend-invite stay on the
// customer's own Portal Access tab (PortalAccessPanel), reached here via the
// row link, since those need the fuller confirm-to-revoke flow.
export function PortalUserRosterTable({ entries }: { entries: PortalUserRosterEntry[] }) {
  const qc = useQueryClient();
  const { hasPermission, isLoading: permissionsLoading } = useUserPermissions();
  const canUpdate = permissionsLoading || hasPermission("portal_access", "update");
  const [actionError, setActionError] = useState<string | null>(null);

  function invalidate(customerUuid: string) {
    qc.invalidateQueries({ queryKey: ["portal-users", "tenant"] });
    qc.invalidateQueries({ queryKey: ["portal-users", customerUuid] });
  }

  const suspendMut = useMutation({
    mutationFn: ({ customerUuid, id }: { customerUuid: string; id: string }) =>
      portalAccessService.suspend(customerUuid, id),
    onSuccess: (_data, { customerUuid }) => { setActionError(null); invalidate(customerUuid); },
    onError: (err) => setActionError(apiErrorMessage(err, "Failed to suspend portal login.")),
  });
  const resumeMut = useMutation({
    mutationFn: ({ customerUuid, id }: { customerUuid: string; id: string }) =>
      portalAccessService.resume(customerUuid, id),
    onSuccess: (_data, { customerUuid }) => { setActionError(null); invalidate(customerUuid); },
    onError: (err) => setActionError(apiErrorMessage(err, "Failed to resume portal login.")),
  });

  const busyId: string | null =
    [suspendMut, resumeMut].find((m) => m.isPending)?.variables.id ?? null;

  if (entries.length === 0) {
    return <EmptyState>No portal logins match the current filters.</EmptyState>;
  }

  return (
    <div className="space-y-3">
      {actionError && <ErrorNote>{actionError}</ErrorNote>}
      <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-100 bg-stone-50 text-left text-2xs font-semibold uppercase tracking-wide text-stone-500">
              <th className="px-4 py-2.5">Login</th>
              <th className="px-4 py-2.5">Customer</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5">Granted</th>
              <th className="px-4 py-2.5">Granted by</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {entries.map((u) => {
              const busy = busyId === u.id;
              return (
                <tr key={u.id} className="border-b border-stone-50 last:border-0 hover:bg-stone-50/60">
                  <td className="px-4 py-2.5">
                    <p className="font-medium text-stone-800">{u.fullName || u.email}</p>
                    {u.fullName && <p className="text-xs text-stone-400">{u.email}</p>}
                  </td>
                  <td className="px-4 py-2.5 text-stone-600">{u.customerName}</td>
                  <td className="px-4 py-2.5"><PortalUserStatusBadge status={u.status} /></td>
                  <td className="px-4 py-2.5 text-stone-500">{fmtDate(u.createdAt)}</td>
                  <td className="px-4 py-2.5 text-stone-500">{u.grantedByName || "—"}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-end gap-2">
                      {canUpdate && u.status === "active" && (
                        <button
                          type="button"
                          onClick={() => suspendMut.mutate({ customerUuid: u.customerUuid, id: u.id })}
                          disabled={busy}
                          aria-label={`Disable portal login for ${u.email}`}
                          title="Disable login"
                          className={cn(
                            "flex size-7 items-center justify-center rounded-lg text-amber-600 transition hover:bg-amber-50",
                            busy && "opacity-50 cursor-not-allowed",
                          )}
                        >
                          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <PauseCircle className="size-3.5" />}
                        </button>
                      )}
                      {canUpdate && u.status === "suspended" && (
                        <button
                          type="button"
                          onClick={() => resumeMut.mutate({ customerUuid: u.customerUuid, id: u.id })}
                          disabled={busy}
                          aria-label={`Enable portal login for ${u.email}`}
                          title="Enable login"
                          className={cn(
                            "flex size-7 items-center justify-center rounded-lg text-emerald-600 transition hover:bg-emerald-50",
                            busy && "opacity-50 cursor-not-allowed",
                          )}
                        >
                          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <PlayCircle className="size-3.5" />}
                        </button>
                      )}
                      <Link
                        to={`/crm/customer/${u.customerUuid}`}
                        state={{ initialTab: "portal" }}
                        aria-label={`View portal access for ${u.customerName}`}
                        title="Manage on customer record"
                        className="inline-flex items-center gap-1 text-xs font-medium text-brand-dark hover:underline"
                      >
                        Manage <ExternalLink className="size-3" />
                      </Link>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
