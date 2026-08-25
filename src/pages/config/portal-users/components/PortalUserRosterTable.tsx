import { Link } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import { EmptyState } from "@/components/tenant/ui";
import { PortalUserStatusBadge } from "@/components/customer/PortalUserStatusBadge";
import { PortalInviteStatusBadge } from "@/components/customer/PortalInviteStatusBadge";
import type { PortalUserRosterEntry } from "@/types/portalUser";

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

// Read-only roster — actions (grant/suspend/resume/revoke) live on the
// customer's own Portal Access tab (PortalAccessPanel), reached here via the
// row link, so there is exactly one place those mutations happen.
export function PortalUserRosterTable({ entries }: { entries: PortalUserRosterEntry[] }) {
  if (entries.length === 0) {
    return <EmptyState>No portal logins match the current filters.</EmptyState>;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-stone-100 bg-stone-50 text-left text-2xs font-semibold uppercase tracking-wide text-stone-500">
            <th className="px-4 py-2.5">Login</th>
            <th className="px-4 py-2.5">Customer</th>
            <th className="px-4 py-2.5">Status</th>
            <th className="px-4 py-2.5">Invite</th>
            <th className="px-4 py-2.5">Granted</th>
            <th className="px-4 py-2.5">Granted by</th>
            <th className="px-4 py-2.5" />
          </tr>
        </thead>
        <tbody>
          {entries.map((u) => (
            <tr key={u.id} className="border-b border-stone-50 last:border-0 hover:bg-stone-50/60">
              <td className="px-4 py-2.5">
                <p className="font-medium text-stone-800">{u.fullName || u.email}</p>
                {u.fullName && <p className="text-xs text-stone-400">{u.email}</p>}
              </td>
              <td className="px-4 py-2.5 text-stone-600">{u.customerName}</td>
              <td className="px-4 py-2.5"><PortalUserStatusBadge status={u.status} /></td>
              <td className="px-4 py-2.5">
                <PortalInviteStatusBadge status={u.inviteStatus} expiresAt={u.inviteExpiresAt} />
              </td>
              <td className="px-4 py-2.5 text-stone-500">{fmtDate(u.createdAt)}</td>
              <td className="px-4 py-2.5 text-stone-500">{u.grantedByName || "—"}</td>
              <td className="px-4 py-2.5 text-right">
                <Link
                  to={`/crm/customer/${u.customerUuid}`}
                  state={{ initialTab: "portal" }}
                  aria-label={`View portal access for ${u.customerName}`}
                  title="Manage on customer record"
                  className="inline-flex items-center gap-1 text-xs font-medium text-brand-dark hover:underline"
                >
                  Manage <ExternalLink className="size-3" />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
