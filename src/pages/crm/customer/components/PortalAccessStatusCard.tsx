import { useQuery } from "@tanstack/react-query";
import { portalAccessService } from "@/services/portalAccessService";
import { PortalUserStatusBadge } from "@/components/customer/PortalUserStatusBadge";
import { Badge } from "@/components/tenant/ui";

const cardCls = "rounded-xl border border-stone-200 bg-white shadow-sm p-4 space-y-3 mb-4";
const rowCls = "flex justify-between items-center py-2 border-b border-stone-100 text-xs";

// Read-only summary of this customer's portal logins, shown in the sidebar
// next to Approval so staff can see at a glance whether anyone from this
// customer can already sign in — without opening the Portal Access tab.
// "Manage" jumps straight there. Shares the exact ["portal-users", customerUuid]
// query key with PortalAccessPanel, so mounting both costs one fetch, not two.
export function PortalAccessStatusCard({
  customerUuid,
  onManage,
}: {
  customerUuid: string;
  onManage: () => void;
}) {
  const usersQ = useQuery({
    queryKey: ["portal-users", customerUuid],
    queryFn: () => portalAccessService.listForCustomer(customerUuid),
    enabled: Boolean(customerUuid),
  });
  const users = usersQ.data ?? [];

  const active = users.filter((u) => u.status === "active");
  const suspended = users.filter((u) => u.status === "suspended");

  return (
    <div className={cardCls}>
      <p className="text-xs font-semibold text-stone-400">Portal Access</p>

      <div className={rowCls}>
        <span className="text-stone-500">Status</span>
        {usersQ.isLoading ? (
          <span className="text-stone-400">Loading…</span>
        ) : active.length > 0 ? (
          <PortalUserStatusBadge status="active" />
        ) : suspended.length > 0 ? (
          <PortalUserStatusBadge status="suspended" />
        ) : (
          <Badge>Not granted</Badge>
        )}
      </div>

      {!usersQ.isLoading && (active.length > 0 || suspended.length > 0) && (
        <div className="py-1 text-xs space-y-1">
          <p className="text-stone-500">Login{(active.length || suspended.length) > 1 ? "s" : ""}</p>
          <p className="font-medium text-stone-700">
            {active.length > 0
              ? active.length === 1
                ? active[0].email
                : `${active.length} active`
              : suspended.length === 1
                ? suspended[0].email
                : `${suspended.length} suspended`}
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={onManage}
        className="text-xs font-semibold text-brand-dark hover:underline"
      >
        Manage portal access →
      </button>
    </div>
  );
}
