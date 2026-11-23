import { toast } from "sonner";
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
  INK,
  STONE_600,
  HEADER_BAND_HEIGHT,
  HEADER_ACCENT_HEIGHT,
  drawMasthead,
  drawFooterOnAllPages,
  fmtDate,
  type DocWithAutoTable,
} from "@/lib/pdfBranding";
import {
  drawRecordTitle,
  drawDateAmountHeader,
  drawAddressRow,
  drawTotalsCard,
  drawEmphasisBar,
  type PdfAddressBlock,
  type PdfKeyAmount,
} from "@/lib/pdfDocumentBlocks";
import { drawTextCard } from "@/lib/pdfTextBlocks";

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

// Rendered as address cards instead of a generic Field/Value grid — see
// billingAddressBlock/shippingAddressBlock below.
const ADDRESS_SECTION_TITLES = new Set(["Billing Address", "Shipping Address"]);
// Rendered as a Notes card instead of a generic grid row.
const NOTES_FIELD_KEY = "customer_internal_notes";
// Rendered as the key-amount badge (Customer only) instead of a grid row.
const BALANCE_HEADLINE_KEY = "customer_total_balance";
const FOOTER_COLUMN_GAP = 24;

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

// customer_bill_addr_*/customer_ship_addr_* -> a PdfAddressBlock, resolving
// the state/country lookup IDs to display names. Returns undefined when the
// address hasn't been filled in at all, so the caller can skip the card.
function addressBlockFromCoreFields(
  coreFields: Record<string, unknown>,
  lookups: CrmLookups | undefined,
  prefix: "customer_bill_addr_" | "customer_ship_addr_",
): PdfAddressBlock | undefined {
  const line1 = String(coreFields[`${prefix}line1`] ?? "");
  if (!line1) return undefined;

  const stateField: CrmCoreField = { key: `${prefix}state`, label: "", type: "lookup-select", lookupKey: "states" };
  const countryField: CrmCoreField = { key: `${prefix}country`, label: "", type: "lookup-select", lookupKey: "countries" };
  const city = String(coreFields[`${prefix}city`] ?? "");
  const state = resolveLookupLabel(lookups, stateField, coreFields[`${prefix}state`]);

  return {
    addrLine1: line1,
    addrLine2: String(coreFields[`${prefix}line2`] ?? "") || undefined,
    suiteUnit: String(coreFields[`${prefix}suitenum`] ?? "") || undefined,
    city: [city, state].filter(Boolean).join(", ") || undefined,
    zip: String(coreFields[`${prefix}zip`] ?? "") || undefined,
    country: resolveLookupLabel(lookups, countryField, coreFields[`${prefix}country`]) || undefined,
  };
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

  await drawMasthead(doc, pageWidth, RECORD_TYPE_LABEL[recordType], recordNumber, statusLabel);

  const headerStartY = HEADER_BAND_HEIGHT + HEADER_ACCENT_HEIGHT + 30;
  const balanceField = CRM_CUSTOMER_BALANCE_SECTION.fields.find((f) => f.key === BALANCE_HEADLINE_KEY);
  const keyAmount: PdfKeyAmount | undefined =
    showCustomerBalances && balanceField
      ? { label: "Balance", value: fieldDisplayValue(coreFields, lookups, balanceField) }
      : undefined;

  const titleBottom = drawRecordTitle(doc, headerStartY, title || "(unnamed)");
  const dateAmountBottom = drawDateAmountHeader(doc, pageWidth, headerStartY, {
    issueDate: fmtDate(createdAt),
    issueDateLabel: "Created",
    dueDate: fmtDate(updatedAt),
    dueDateLabel: "Updated",
    keyAmount,
  });
  let cursorY = Math.max(titleBottom, dateAmountBottom) + 20;

  if (ownerName) {
    cursorY = drawAddressRow(doc, pageWidth, cursorY, { label: "Account Owner", addr: { customerName: ownerName } });
  }

  const billTo = addressBlockFromCoreFields(coreFields, lookups, "customer_bill_addr_");
  const shipTo = addressBlockFromCoreFields(coreFields, lookups, "customer_ship_addr_");
  if (billTo || shipTo) {
    cursorY = drawAddressRow(
      doc,
      pageWidth,
      cursorY,
      billTo && { label: "Billing Address", addr: billTo },
      shipTo && { label: "Shipping Address", addr: shipTo },
    );
  }

  function ensureSpace(minHeight = 0) {
    if (cursorY + minHeight > pageHeight - PAGE_BOTTOM_SAFE) {
      doc.addPage();
      cursorY = 44;
    }
  }

  function renderSectionTable(sectionTitle: string, fields: CrmCoreField[]) {
    const rows = fields
      .filter((field) => isFieldVisible(coreFields, field))
      .map((field) => [field.label, fieldDisplayValue(coreFields, lookups, field)]);
    if (rows.length === 0) return;

    ensureSpace();

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

  for (const section of CRM_CORE_SECTIONS) {
    if (ADDRESS_SECTION_TITLES.has(section.title)) continue;
    const fields = section.fields.filter((field) => field.key !== NOTES_FIELD_KEY);
    renderSectionTable(section.title, fields);
  }

  const notesRaw = coreFields[NOTES_FIELD_KEY];
  const notesText = notesRaw !== null && notesRaw !== undefined && notesRaw !== "" ? String(notesRaw) : undefined;

  const balanceTotals = showCustomerBalances
    ? CRM_CUSTOMER_BALANCE_SECTION.fields
        .filter((field) => field.key !== BALANCE_HEADLINE_KEY && isFieldVisible(coreFields, field))
        .map((field) => ({ label: field.label, value: fieldDisplayValue(coreFields, lookups, field) }))
        .filter((row) => row.value !== "—")
    : [];

  if (notesText || balanceTotals.length > 0 || keyAmount) {
    ensureSpace(80);
    const colWidth = (pageWidth - MARGIN_X * 2 - FOOTER_COLUMN_GAP) / 2;
    const rightX = MARGIN_X + colWidth + FOOTER_COLUMN_GAP;

    let leftY = cursorY;
    if (notesText) leftY = drawTextCard(doc, MARGIN_X, colWidth, leftY, "Notes", notesText);

    let rightY = cursorY;
    if (balanceTotals.length > 0) rightY = drawTotalsCard(doc, rightX, colWidth, rightY, balanceTotals) + 10;
    if (keyAmount) rightY = drawEmphasisBar(doc, rightX, colWidth, rightY, keyAmount);

    cursorY = Math.max(leftY, rightY) + 20;
  }

  const customEntries = Object.entries(customFields).filter(
    ([, value]) => value !== null && value !== undefined && value !== "",
  );
  if (customEntries.length > 0) {
    ensureSpace();
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
  toast.success("Downloaded successfully!");
}
