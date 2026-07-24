import type { StatusInfo, WorkflowRecord } from "@/types/tenant";
import { buildCsvText, buildCsvFilename, fmtCsvDate } from "@/lib/csvExport";

export { csvEscapeValue, downloadCsv, fmtCsvDate } from "@/lib/csvExport";

/** Builds CSV text (with header row) for a page of CRM lead/prospect/customer records. */
export function buildCrmRecordsCsv(
  records: WorkflowRecord[],
  statusMap: Map<string, StatusInfo>,
  showEmail: boolean,
): string {
  const headers = [
    "Record Number",
    "Company",
    "Status",
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
