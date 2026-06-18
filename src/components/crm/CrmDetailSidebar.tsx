import { type ReactNode } from "react";
import { Upload, Plus, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/tenant/ui";
import type { StatusInfo, WorkspaceUser } from "@/types/tenant";

type Props = {
  statusInfo?: StatusInfo;
  ownerUserId?: string;
  users: WorkspaceUser[];
  createdAt: string;
  updatedAt: string;
  onUploadFile?: () => void;
  onEdit?: () => void;
  deleteSlot?: ReactNode;
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
  "flex items-center gap-2.5 hover:bg-stone-50 rounded-lg px-3 py-2 cursor-pointer text-sm text-stone-700 w-full transition-colors text-left";

/** Sticky right-panel shown on all CRM record detail and edit pages. */
export function CrmDetailSidebar({
  statusInfo,
  ownerUserId,
  users,
  createdAt,
  updatedAt,
  onUploadFile,
  onEdit,
  deleteSlot,
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
          <button
            type="button"
            onClick={onUploadFile}
            className={actionRowCls}
            aria-label="Upload file"
          >
            <Upload className="size-4 text-stone-400 shrink-0" />
            Upload file
          </button>
          {onEdit && (
            <button
              type="button"
              onClick={onEdit}
              className={actionRowCls}
              aria-label="Edit record"
            >
              <Pencil className="size-4 text-stone-400 shrink-0" />
              Edit record
            </button>
          )}
          <button type="button" className={actionRowCls} aria-label="Add note">
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
            className={owner ? "text-stone-900 font-medium" : "text-stone-400"}
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

      {/* Danger Zone */}
      {deleteSlot && (
        <div className="rounded-xl border border-red-100 bg-red-50/60 shadow-sm p-4 mb-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-red-400 mb-3">
            Danger Zone
          </p>
          <div
            className="[&>button]:flex [&>button]:w-full [&>button]:items-center [&>button]:gap-2.5
                       [&>button]:rounded-lg [&>button]:px-3 [&>button]:py-2 [&>button]:text-sm
                       [&>button]:font-medium [&>button]:text-red-600 [&>button]:transition-colors
                       [&>button]:text-left [&>button]:cursor-pointer
                       [&>button]:hover:bg-red-100/70"
          >
            {/* Inject the Trash2 icon before the deleteSlot label via a wrapper */}
            <DeleteSlotWrapper>{deleteSlot}</DeleteSlotWrapper>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Wraps the deleteSlot trigger with a Trash2 icon prepended.
 * Works when deleteSlot renders a <button> as its root element.
 */
function DeleteSlotWrapper({ children }: { children: ReactNode }) {
  return (
    <div className="relative">
      <Trash2
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-red-500"
        aria-hidden
      />
      <div className="[&>button]:pl-9">{children}</div>
    </div>
  );
}