import type { StatusInfo, WorkflowRecord } from "@/types/tenant";
import { recordApprovalState } from "@/types/tenant";
import { buildCsvText, buildCsvFilename, fmtCsvDate } from "@/lib/csvExport";

export { csvEscapeValue, downloadCsv, fmtCsvDate } from "@/lib/csvExport";

const APPROVAL_LABEL: Record<ReturnType<typeof recordApprovalState>, string> = {
  none: "",
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
};

/**
 * Builds CSV text (with header row) for CRM lead/prospect/customer records.
 * The columns follow the list table (Company, Status, Owner, Email, Created),
 * plus the record number, approval state and last-updated date. `ownerNames`
 * maps a user id to a display name, as the table's Owner cell does; a record
 * with no owner, or one that is not in the map, gets an empty cell.
 */
export function buildCrmRecordsCsv(
  records: WorkflowRecord[],
  statusMap: Map<string, StatusInfo>,
  showEmail: boolean,
  ownerNames: ReadonlyMap<string, string> = new Map(),
): string {
  const headers = [
    "Record Number",
    "Company",
    "Status",
    "Owner",
    "Approval",
    ...(showEmail ? ["Email"] : []),
    "Created",
    "Updated",
  ];

  const rows = records.map((record) => {
    const statusInfo = statusMap.get(record.currentStateId);
    return [
      record.recordNumber ?? "",
      String(record.coreFields.customer_name ?? ""),
      statusInfo?.statusLabel ?? "",
      (record.ownerUserId && ownerNames.get(record.ownerUserId)) || "",
      APPROVAL_LABEL[recordApprovalState(record)],
      ...(showEmail ? [String(record.coreFields.customer_contact_email ?? "")] : []),
      fmtCsvDate(record.createdAt),
      fmtCsvDate(record.updatedAt),
    ];
  });

  return buildCsvText(headers, rows);
}

/** Builds a date-stamped filename for a CRM CSV export, e.g. "leads-2026-07-10.csv". */
export function buildCrmCsvFilename(label: string): string {
  return buildCsvFilename(label);
}
