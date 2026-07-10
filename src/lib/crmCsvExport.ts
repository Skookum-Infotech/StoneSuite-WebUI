import type { StatusInfo, WorkflowRecord } from "@/types/tenant";

const CSV_ESCAPE_PATTERN = /[",\r\n]/;

/** Escapes a single value for CSV — quotes it (doubling embedded quotes) only when needed. */
export function csvEscapeValue(value: unknown): string {
  const str = value === null || value === undefined ? "" : String(value);
  return CSV_ESCAPE_PATTERN.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

/** Formats an ISO timestamp as a plain date for spreadsheet columns. */
export function fmtCsvDate(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

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
    const cells = [
      record.recordNumber ?? "",
      String(record.coreFields.customer_name ?? ""),
      statusInfo?.statusLabel ?? "",
      ...(showEmail ? [String(record.coreFields.customer_contact_email ?? "")] : []),
      fmtCsvDate(record.createdAt),
      fmtCsvDate(record.updatedAt),
    ];
    return cells.map(csvEscapeValue).join(",");
  });

  return [headers.map(csvEscapeValue).join(","), ...rows].join("\r\n");
}

/** Builds a date-stamped filename for a CRM CSV export, e.g. "leads-2026-07-10.csv". */
export function buildCrmCsvFilename(label: string): string {
  const safeLabel = label.toLowerCase().replace(/[^a-z0-9-_]+/gi, "-");
  const date = new Date().toISOString().slice(0, 10);
  return `${safeLabel}s-${date}.csv`;
}

/** Triggers a browser download of the given CSV text under the given filename. */
export function downloadCsv(filename: string, csvContent: string): void {
  const blob = new Blob(["﻿", csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
