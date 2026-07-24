import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  CRM_CORE_SECTIONS,
  CRM_CUSTOMER_BALANCE_SECTION,
  type CrmCoreField,
} from "@/lib/crmFields";
import type { CrmLookups, LookupItem } from "@/services/lookupService";
import {
  MARGIN_X,
  PAGE_BOTTOM_SAFE,
  BRAND_LIME,
  BRAND_DARK_ACCENT,
  INK,
  STONE_200,
  STONE_400,
  STONE_600,
  HEADER_BAND_HEIGHT,
  HEADER_ACCENT_HEIGHT,
  drawMasthead,
  drawFooterOnAllPages,
  fmtDate,
  type DocWithAutoTable,
} from "@/lib/pdfBranding";

export { fmtDate } from "@/lib/pdfBranding";

export type CrmExportRecordType = "lead" | "prospect" | "customer";

export interface CrmExportParams {
  recordType: CrmExportRecordType;
  title: string;
  recordNumber?: string;
  statusLabel?: string;
  ownerName?: string;
  createdAt: string;
  updatedAt: string;
  coreFields: Record<string, unknown>;
  customFields: Record<string, unknown>;
  lookups?: CrmLookups;
  showCustomerBalances?: boolean;
}

const RECORD_TYPE_LABEL: Record<CrmExportRecordType, string> = {
  lead: "Lead",
  prospect: "Prospect",
  customer: "Customer",
};

export function resolveLookupLabel(
  lookups: CrmLookups | undefined,
  field: CrmCoreField,
  value: unknown,
): string {
  if (!lookups || !field.lookupKey || value === null || value === undefined || value === "")
    return "";
  const items = lookups[field.lookupKey] as LookupItem[];
  const match = items?.find((item) => String(item.id) === String(value));
  return match?.name ?? "";
}

export function isFieldVisible(coreFields: Record<string, unknown>, field: CrmCoreField): boolean {
  if (field.showIfFieldTrue) return Boolean(coreFields[field.showIfFieldTrue]);
  if (field.showIfFieldFalse) return !coreFields[field.showIfFieldFalse];
  return true;
}

export function fieldDisplayValue(
  coreFields: Record<string, unknown>,
  lookups: CrmLookups | undefined,
  field: CrmCoreField,
): string {
  const raw = coreFields[field.key];
  if (field.type === "lookup-select") return resolveLookupLabel(lookups, field, raw) || "—";
  if (field.type === "checkbox") return raw === true || raw === "true" ? "Yes" : "No";
  return raw !== null && raw !== undefined && raw !== "" ? String(raw) : "—";
}

export function buildExportFilename(
  recordType: CrmExportRecordType,
  recordNumber: string | undefined,
  title: string,
): string {
  const safeName = (recordNumber || title || recordType).replace(/[^a-z0-9-_]+/gi, "-");
  return `${recordType}-${safeName}.pdf`;
}

/** Builds a branded PDF summary of a CRM Lead/Prospect/Customer record. */
export async function buildCrmRecordPdf(params: CrmExportParams): Promise<DocWithAutoTable> {
  const {
    recordType,
    title,
    recordNumber,
    statusLabel,
    ownerName,
    createdAt,
    updatedAt,
    coreFields,
    customFields,
    lookups,
    showCustomerBalances,
  } = params;

  const doc = new jsPDF({ unit: "pt", format: "a4" }) as DocWithAutoTable;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  await drawMasthead(doc, pageWidth);

  let cursorY = HEADER_BAND_HEIGHT + HEADER_ACCENT_HEIGHT + 34;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...BRAND_DARK_ACCENT);
  doc.text("CRM RECORD SUMMARY", MARGIN_X, cursorY, { charSpace: 1.4 });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...STONE_400);
  doc.text(`Generated ${new Date().toLocaleString()}`, pageWidth - MARGIN_X, cursorY, {
    align: "right",
  });

  cursorY += 24;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(...INK);
  doc.text(title || "(unnamed)", MARGIN_X, cursorY);

  cursorY += 18;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...STONE_600);
  const subtitleParts = [RECORD_TYPE_LABEL[recordType], recordNumber].filter(Boolean);
  doc.text(subtitleParts.join("  ·  "), MARGIN_X, cursorY);

  cursorY += 16;
  doc.setDrawColor(...STONE_200);
  doc.setLineWidth(0.75);
  doc.line(MARGIN_X, cursorY, pageWidth - MARGIN_X, cursorY);
  cursorY += 20;

  autoTable(doc, {
    startY: cursorY,
    margin: { left: MARGIN_X, right: MARGIN_X },
    theme: "plain",
    styles: { fontSize: 9, textColor: STONE_600, cellPadding: 2 },
    body: [
      ["Status", statusLabel || "—", "Account Owner", ownerName || "—"],
      ["Created", fmtDate(createdAt), "Updated", fmtDate(updatedAt)],
    ],
    columnStyles: {
      0: { fontStyle: "bold", textColor: INK, cellWidth: 90 },
      2: { fontStyle: "bold", textColor: INK, cellWidth: 90 },
    },
  });

  cursorY = doc.lastAutoTable.finalY + 20;

  function renderSectionTable(sectionTitle: string, fields: CrmCoreField[]) {
    const rows = fields
      .filter((field) => isFieldVisible(coreFields, field))
      .map((field) => [field.label, fieldDisplayValue(coreFields, lookups, field)]);
    if (rows.length === 0) return;

    if (cursorY > pageHeight - PAGE_BOTTOM_SAFE) {
      doc.addPage();
      cursorY = 44;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...INK);
    doc.text(sectionTitle, MARGIN_X, cursorY);
    cursorY += 8;

    autoTable(doc, {
      startY: cursorY + 4,
      margin: { left: MARGIN_X, right: MARGIN_X },
      theme: "grid",
      styles: { fontSize: 9, cellPadding: 5, textColor: STONE_600 },
      headStyles: { fillColor: BRAND_LIME, textColor: INK },
      head: [["Field", "Value"]],
      body: rows,
      columnStyles: { 0: { cellWidth: 170, fontStyle: "bold" } },
    });

    cursorY = doc.lastAutoTable.finalY + 20;
  }

  for (const section of CRM_CORE_SECTIONS) renderSectionTable(section.title, section.fields);

  if (showCustomerBalances) {
    renderSectionTable(CRM_CUSTOMER_BALANCE_SECTION.title, CRM_CUSTOMER_BALANCE_SECTION.fields);
  }

  const customEntries = Object.entries(customFields).filter(
    ([, value]) => value !== null && value !== undefined && value !== "",
  );
  if (customEntries.length > 0) {
    if (cursorY > pageHeight - PAGE_BOTTOM_SAFE) {
      doc.addPage();
      cursorY = 44;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...INK);
    doc.text("Custom Fields", MARGIN_X, cursorY);
    cursorY += 8;
    autoTable(doc, {
      startY: cursorY + 4,
      margin: { left: MARGIN_X, right: MARGIN_X },
      theme: "grid",
      styles: { fontSize: 9, cellPadding: 5, textColor: STONE_600 },
      headStyles: { fillColor: BRAND_LIME, textColor: INK },
      head: [["Field", "Value"]],
      body: customEntries.map(([key, value]) => [key, String(value)]),
      columnStyles: { 0: { cellWidth: 170, fontStyle: "bold" } },
    });
  }

  drawFooterOnAllPages(doc, pageHeight, `StoneSuite CRM — ${RECORD_TYPE_LABEL[recordType]} Record`);

  return doc;
}

/** Builds and downloads a branded PDF summary of a CRM Lead/Prospect/Customer record. */
export async function exportCrmRecordToPdf(params: CrmExportParams): Promise<void> {
  const doc = await buildCrmRecordPdf(params);
  doc.save(buildExportFilename(params.recordType, params.recordNumber, params.title));
}
