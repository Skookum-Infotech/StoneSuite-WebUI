import { Upload, Plus } from "lucide-react";
import { Badge } from "@/components/tenant/ui";
import type { StatusInfo, WorkspaceUser } from "@/types/tenant";

type Props = {
  statusInfo?: StatusInfo;
  ownerUserId?: string;
  users: WorkspaceUser[];
  createdAt: string;
  updatedAt: string;
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const cardCls =
  "rounded-xl border border-stone-200 bg-white shadow-sm p-4 space-y-3 mb-4";
const headingCls =
  "text-[10px] font-semibold uppercase tracking-widest text-stone-400";
const rowCls =
  "flex justify-between items-center py-2 border-b border-stone-100 last:border-0 text-sm";
const actionRowCls =
  "flex items-center gap-2.5 hover:bg-gray-50 rounded-lg px-3 py-2 cursor-pointer text-sm text-stone-700 w-full transition-colors";

/** Sticky right-panel shown on all CRM record detail pages. */
export function CrmDetailSidebar({
  statusInfo,
  ownerUserId,
  users,
  createdAt,
  updatedAt,
}: Props) {
  const owner = ownerUserId
    ? users.find((u) => u.id === ownerUserId)
    : undefined;

  return (
    <div>
      {/* Quick Actions */}
      <div className={cardCls}>
        <p className={headingCls}>Quick Actions</p>
        <div className="space-y-0.5">
          <button type="button" className={actionRowCls}>
            <Upload className="size-4 text-stone-400 shrink-0" />
            Upload file
          </button>
          <button type="button" className={actionRowCls}>
            <Plus className="size-4 text-stone-400 shrink-0" />
            Add note
          </button>
        </div>
      </div>

      {/* Status */}
      <div className={cardCls}>
        <p className={headingCls}>Status</p>
        <div className={rowCls}>
          <span className="text-stone-500">Status</span>
          {statusInfo ? (
            <Badge color={statusInfo.color}>{statusInfo.statusLabel}</Badge>
          ) : (
            <span className="text-stone-400">—</span>
          )}
        </div>
        <div className={rowCls}>
          <span className="text-stone-500">Account owner</span>
          <span
            className={
              owner ? "text-stone-800 font-medium" : "text-stone-400"
            }
          >
            {owner?.fullName ?? "—"}
          </span>
        </div>
        <div className={rowCls}>
          <span className="text-stone-500">Created</span>
          <span className="font-semibold text-stone-700">
            {fmtDate(createdAt)}
          </span>
        </div>
        <div className={rowCls}>
          <span className="text-stone-500">Updated</span>
          <span className="font-semibold text-stone-700">
            {fmtDate(updatedAt)}
          </span>
        </div>
      </div>

      {/* Activity Summary */}
      <div className={cardCls}>
        <p className={headingCls}>Activity Summary</p>
        <div className={rowCls}>
          <span className="text-stone-500">Open opportunities</span>
          <span className="font-semibold text-stone-700">0</span>
        </div>
        <div className={rowCls}>
          <span className="text-stone-500">Open tasks</span>
          <span className="font-semibold text-stone-700">0</span>
        </div>
        <div className={rowCls}>
          <span className="text-stone-500">Total revenue</span>
          <span className="text-stone-400">—</span>
        </div>
        <div className={rowCls}>
          <span className="text-stone-500">Last contact</span>
          <span className="text-stone-400">—</span>
        </div>
      </div>
    </div>
  );
}
