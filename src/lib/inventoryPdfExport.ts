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

// Inventory-domain PDF exporter — a sibling of purchasesPdfExport.ts/
// salesPdfExport.ts (same masthead/section/table/footer shape via
// pdfBranding.ts), scoped to Inventory: Item/Unit/Bundle are profile-shaped
// (no line items), Adjustment/Transfer/Count are document-shaped (header +
// lines) per the module's PDF Export Convention.

export type InventoryRecordType =
  | "inventory_item" | "inventory_unit" | "bundle"
  | "adjustment" | "transfer" | "count";

export interface InventoryPdfSection {
  title: string;
  rows: Array<[string, string]>;
}

export interface InventoryPdfTable {
  title?: string;
  head: string[];
  rows: string[][];
  numericFrom?: number;
}

const RECORD_TYPE_LABEL: Record<InventoryRecordType, string> = {
  inventory_item: "Inventory Item",
  inventory_unit: "Inventory Unit",
  bundle: "Bundle",
  adjustment: "Adjustment",
  transfer: "Transfer",
  count: "Cycle Count",
};

export interface InventoryExportParams {
  recordType: InventoryRecordType;
  title: string;
  recordNumber?: string;
  statusLabel?: string;
  createdAt?: string;
  updatedAt?: string;
  sections: InventoryPdfSection[];
  linesTable?: InventoryPdfTable;
}

export function buildExportFilename(
  recordType: InventoryRecordType,
  recordNumber: string | undefined,
  title: string,
): string {
  const safeName = (recordNumber || title || recordType).replace(/[^a-z0-9-_]+/gi, "-");
  return `${recordType}-${safeName}.pdf`;
}

export async function buildInventoryRecordPdf(params: InventoryExportParams): Promise<DocWithAutoTable> {
  const { recordType, title, recordNumber, statusLabel, createdAt, updatedAt, sections, linesTable } = params;

  const doc = new jsPDF({ unit: "pt", format: "a4" }) as DocWithAutoTable;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  await drawMasthead(doc, pageWidth);

  let cursorY = HEADER_BAND_HEIGHT + HEADER_ACCENT_HEIGHT + 34;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...BRAND_DARK_ACCENT);
  doc.text("INVENTORY DOCUMENT SUMMARY", MARGIN_X, cursorY, { charSpace: 1.4 });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...STONE_400);
  doc.text(`Generated ${new Date().toLocaleString()}`, pageWidth - MARGIN_X, cursorY, { align: "right" });

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
      ["Status", statusLabel || "—", "Created", fmtDate(createdAt || "")],
      ["Updated", fmtDate(updatedAt || ""), "", ""],
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

  if (linesTable && linesTable.rows.length > 0) {
    ensureSpace();

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...INK);
    doc.text(linesTable.title || "Lines", MARGIN_X, cursorY);
    cursorY += 8;

    const numericFrom = linesTable.numericFrom ?? linesTable.head.length;
    autoTable(doc, {
      startY: cursorY + 4,
      margin: { left: MARGIN_X, right: MARGIN_X },
      theme: "grid",
      styles: { fontSize: 8, cellPadding: 4, textColor: STONE_600 },
      headStyles: { fillColor: BRAND_LIME, textColor: INK },
      head: [linesTable.head],
      body: linesTable.rows,
      columnStyles: Object.fromEntries(
        linesTable.head.map((_, i) => [i, i >= numericFrom ? { halign: "right" as const } : {}]),
      ),
    });

    cursorY = doc.lastAutoTable.finalY + 20;
  }

  drawFooterOnAllPages(doc, pageHeight, `StoneSuite Inventory — ${RECORD_TYPE_LABEL[recordType]}`);

  return doc;
}

export async function exportInventoryRecordToPdf(params: InventoryExportParams): Promise<void> {
  const doc = await buildInventoryRecordPdf(params);
  doc.save(buildExportFilename(params.recordType, params.recordNumber, params.title));
}
