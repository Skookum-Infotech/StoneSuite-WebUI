import { useState, type ReactNode } from "react";
import { Upload, Plus, Pencil, X, LayoutList, FileDown, Loader2 } from "lucide-react";
import { Badge, ErrorNote } from "@/components/tenant/ui";
import { resolveStatusColor } from "@/components/crm/formUtils";
import { cn } from "@/lib/utils";
import type { StatusInfo, WorkspaceUser } from "@/types/tenant";

type Props = {
  statusInfo?: StatusInfo;
  /** Interactive status pill (StatusDropdown variant="pill") for the Status
   *  row — lets status be changed right here instead of only via Edit. Falls
   *  back to the static badge derived from `statusInfo` when omitted. */
  statusControl?: ReactNode;
  ownerUserId?: string;
  users: WorkspaceUser[];
  createdAt: string;
  updatedAt: string;
  onUploadFile?: () => void;
  onEdit?: () => void;
  onExportPdf?: () => void;
  exportingPdf?: boolean;
  exportPdfError?: string;
  approvalSlot?: ReactNode;
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
  "text-xs font-semibold text-stone-400";
const rowCls =
  "flex justify-between items-center py-2 border-b border-stone-100 last:border-0 text-xs";
const actionRowCls =
  "flex items-center gap-2.5 hover:bg-stone-50 rounded-lg px-3 py-2 cursor-pointer text-xs text-stone-700 w-full transition-colors text-left";

/** Sticky right-panel shown on all CRM record detail pages.
 *  On lg+: renders inline. On mobile: FAB in bottom-right corner → slide-up sheet. */
export function CrmDetailSidebar({
  statusInfo,
  statusControl,
  ownerUserId,
  users,
  createdAt,
  updatedAt,
  onUploadFile,
  onEdit,
  onExportPdf,
  exportingPdf,
  exportPdfError,
  approvalSlot,
  deleteSlot,
}: Props) {
  const [open, setOpen] = useState(false);

  const owner = ownerUserId
    ? users.find((u) => u.id === ownerUserId)
    : undefined;

  const content = (
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
          {onExportPdf && (
            <button
              type="button"
              onClick={onExportPdf}
              disabled={exportingPdf}
              className={cn(actionRowCls, exportingPdf && "opacity-60 cursor-not-allowed")}
              aria-label="Export as PDF"
            >
              {exportingPdf ? (
                <Loader2 className="size-4 text-stone-400 shrink-0 animate-spin" />
              ) : (
                <FileDown className="size-4 text-stone-400 shrink-0" />
              )}
              {exportingPdf ? "Exporting…" : "Export PDF"}
            </button>
          )}
        </div>
        {exportPdfError && (
          <div className="pt-1">
            <ErrorNote>{exportPdfError}</ErrorNote>
          </div>
        )}
      </div>

      {approvalSlot}

      {/* Status */}
      <div className={cardCls}>
        <p className={headingCls}>Status</p>
        <div className={rowCls}>
          <span className="text-xs text-stone-500">Status</span>
          {statusControl ?? (statusInfo ? (
            <Badge color={resolveStatusColor(statusInfo.stateKey, statusInfo.color)}>{statusInfo.statusLabel}</Badge>
          ) : (
            <span className="text-stone-400">—</span>
          ))}
        </div>
        <div className={rowCls}>
          <span className="text-xs text-stone-500">Account owner</span>
          <span className={owner ? "text-xs text-stone-700" : "text-xs text-stone-400"}>
            {owner?.fullName ?? "—"}
          </span>
        </div>
        <div className={rowCls}>
          <span className="text-xs text-stone-500">Created</span>
          <span className="text-xs text-stone-700">{fmtDate(createdAt)}</span>
        </div>
        <div className={rowCls}>
          <span className="text-xs text-stone-500">Updated</span>
          <span className="text-xs text-stone-700">{fmtDate(updatedAt)}</span>
        </div>
      </div>

      {/* Danger Zone */}
      {deleteSlot && (
        <div className={cardCls}>
          <p className="text-xs font-semibold text-red-400">Danger Zone</p>
          <div className="space-y-0.5">{deleteSlot}</div>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* ── Desktop lg+: normal inline sidebar ── */}
      <div className="hidden lg:block">{content}</div>

      {/* ── Mobile: floating badge + slide-up bottom sheet ── */}
      <div className="lg:hidden">
        {/* FAB */}
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open record details"
          className="fixed bottom-6 right-4 z-30 flex items-center gap-1.5 rounded-full bg-stone-800 px-3.5 py-2 text-xs font-semibold text-white shadow-lg hover:bg-stone-700 active:scale-95 transition-all"
        >
          <LayoutList className="size-3.5" />
          Details
        </button>

        {/* Backdrop */}
        <div
          aria-hidden="true"
          onClick={() => setOpen(false)}
          className={cn(
            "fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-300",
            open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
          )}
        />

        {/* Bottom sheet */}
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Record details"
          className={cn(
            "fixed bottom-0 left-0 right-0 z-50 flex flex-col rounded-t-2xl bg-stone-50 shadow-xl transition-transform duration-300 max-h-[82vh]",
            open ? "translate-y-0" : "translate-y-full",
          )}
        >
          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-1 shrink-0">
            <div className="h-1 w-10 rounded-full bg-stone-300" />
          </div>

          {/* Sheet header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-stone-200 shrink-0">
            <h3 className="text-sm font-semibold text-stone-800">Record Details</h3>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close details"
              className="flex size-7 items-center justify-center rounded-full hover:bg-stone-100 transition-colors"
            >
              <X className="size-4 text-stone-500" />
            </button>
          </div>

          {/* Scrollable content */}
          <div className="overflow-y-auto px-4 pt-4 pb-10 modal-scrollbar">
            {content}
          </div>
        </div>
      </div>
    </>
  );
}
