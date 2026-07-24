import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
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

// Purchases-domain PDF exporter — a sibling of salesPdfExport.ts/crmPdfExport.ts
// (same masthead/section/table/footer shape via pdfBranding.ts), scoped to the
// Purchases module: Purchase Order and Item Receipt are document-shaped
// (header + line items, PO also carries totals); Vendor is profile-shaped (no
// line items or totals — it reuses the same "counterparty" meta slot to show
// Vendor Type instead of a counterparty name, since the vendor IS the party).

export type PurchasesRecordType = "purchase_order" | "item_receipt" | "vendor";

export interface PurchasesPdfSection {
  title: string;
  /** [label, value] pairs. Rows with an empty value are dropped. */
  rows: Array<[string, string]>;
}

export interface PurchasesPdfTable {
  title?: string;
  head: string[];
  rows: string[][];
  /** Column index (0-based) from which cells are right-aligned, e.g. numeric columns. */
  numericFrom?: number;
}

export interface PurchasesPdfTotal {
  label: string;
  value: string;
  bold?: boolean;
}

export interface PurchasesExportParams {
  recordType: PurchasesRecordType;
  title: string;
  recordNumber?: string;
  statusLabel?: string;
  /** Second meta-row pair, alongside Status. Purchase Order/Item Receipt use
   *  this for the vendor the document is against; Vendor's own export
   *  repurposes it for "Vendor Type" since there is no external counterparty. */
  counterpartyLabel?: string;
  counterpartyName?: string;
  createdAt?: string;
  updatedAt?: string;
  sections: PurchasesPdfSection[];
  itemsTable?: PurchasesPdfTable;
  totals?: PurchasesPdfTotal[];
}

const RECORD_TYPE_LABEL: Record<PurchasesRecordType, string> = {
  purchase_order: "Purchase Order",
  item_receipt: "Item Receipt",
  vendor: "Vendor",
};

export function buildExportFilename(
  recordType: PurchasesRecordType,
  recordNumber: string | undefined,
  title: string,
): string {
  const safeName = (recordNumber || title || recordType).replace(/[^a-z0-9-_]+/gi, "-");
  return `${recordType}-${safeName}.pdf`;
}

/** Builds a branded PDF summary of a Purchases record (Purchase Order, Item
 *  Receipt, or Vendor). */
export async function buildPurchasesRecordPdf(params: PurchasesExportParams): Promise<DocWithAutoTable> {
  const {
    recordType, title, recordNumber, statusLabel, counterpartyLabel, counterpartyName,
    createdAt, updatedAt, sections, itemsTable, totals,
  } = params;

  const doc = new jsPDF({ unit: "pt", format: "a4" }) as DocWithAutoTable;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  await drawMasthead(doc, pageWidth);

  let cursorY = HEADER_BAND_HEIGHT + HEADER_ACCENT_HEIGHT + 34;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...BRAND_DARK_ACCENT);
  doc.text("PURCHASES DOCUMENT SUMMARY", MARGIN_X, cursorY, { charSpace: 1.4 });

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
      ["Status", statusLabel || "—", counterpartyLabel || "Vendor", counterpartyName || "—"],
      ["Created", fmtDate(createdAt || ""), "Updated", fmtDate(updatedAt || "")],
    ],
    columnStyles: {
      0: { fontStyle: "bold", textColor: INK, cellWidth: 90 },
      2: { fontStyle: "bold", textColor: INK, cellWidth: 90 },
    },
  });

  cursorY = doc.lastAutoTable.finalY + 20;

  function ensureSpace() {
    if (cursorY > pageHeight - PAGE_BOTTOM_SAFE) {
      doc.addPage();
      cursorY = 44;
    }
  }

  for (const section of sections) {
    const rows = section.rows.filter(([, value]) => value !== "");
    if (rows.length === 0) continue;

    ensureSpace();

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...INK);
    doc.text(section.title, MARGIN_X, cursorY);
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

  if (totals && totals.length > 0) {
    ensureSpace();

    autoTable(doc, {
      startY: cursorY,
      margin: { left: MARGIN_X, right: MARGIN_X },
      theme: "plain",
      tableWidth: "wrap",
      styles: { fontSize: 7, cellPadding: 4 },
      head: [totals.map((t) => t.label.toUpperCase())],
      headStyles: { textColor: STONE_400, fontStyle: "normal" },
      body: [totals.map((t) => t.value)],
      bodyStyles: { textColor: INK, fontSize: 10 },
      columnStyles: Object.fromEntries(
        totals.map((t, i) => [i, t.bold ? { fontStyle: "bold" as const } : {}]),
      ),
    });

    cursorY = doc.lastAutoTable.finalY + 20;
  }

  if (itemsTable && itemsTable.rows.length > 0) {
    ensureSpace();

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...INK);
    doc.text(itemsTable.title || "Line Items", MARGIN_X, cursorY);
    cursorY += 8;

    const numericFrom = itemsTable.numericFrom ?? itemsTable.head.length;
    autoTable(doc, {
      startY: cursorY + 4,
      margin: { left: MARGIN_X, right: MARGIN_X },
      theme: "grid",
      styles: { fontSize: 8, cellPadding: 4, textColor: STONE_600 },
      headStyles: { fillColor: BRAND_LIME, textColor: INK },
      head: [itemsTable.head],
      body: itemsTable.rows,
      columnStyles: Object.fromEntries(
        itemsTable.head.map((_, i) => [i, i >= numericFrom ? { halign: "right" as const } : {}]),
      ),
    });

    cursorY = doc.lastAutoTable.finalY + 20;
  }

  drawFooterOnAllPages(doc, pageHeight, `StoneSuite Purchases — ${RECORD_TYPE_LABEL[recordType]}`);

  return doc;
}

/** Builds and downloads a branded PDF summary of a Purchases record. */
export async function exportPurchasesRecordToPdf(params: PurchasesExportParams): Promise<void> {
  const doc = await buildPurchasesRecordPdf(params);
  doc.save(buildExportFilename(params.recordType, params.recordNumber, params.title));
}
