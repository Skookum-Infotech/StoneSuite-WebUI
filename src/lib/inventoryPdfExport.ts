import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
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
import { drawRecordTitle, drawDateAmountHeader, CARD_FILL } from "@/lib/pdfDocumentBlocks";
import { makeItemDescriptionHooks } from "@/lib/pdfTextBlocks";

// Inventory-domain PDF exporter — a sibling of purchasesPdfExport.ts/
// salesPdfExport.ts (same masthead/header/section/table/footer shape via
// pdfBranding.ts + pdfDocumentBlocks.ts + pdfTextBlocks.ts), scoped to
// Inventory: Item/Unit/Bundle are profile-shaped (no line items, no
// counterparty, no money) — Adjustment/Transfer/Count are document-shaped
// (header + lines) per the module's PDF Export Convention, though no calling
// page exists for them yet; `linesTable` stays ready for when one does.

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
  /** Row-aligned with `rows` — an optional line rendered under the item name
   *  (column index 1) instead of its own column. */
  descriptions?: Array<string | undefined>;
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

  await drawMasthead(doc, pageWidth, RECORD_TYPE_LABEL[recordType], recordNumber, statusLabel);

  const headerStartY = HEADER_BAND_HEIGHT + HEADER_ACCENT_HEIGHT + 30;
  const titleBottom = drawRecordTitle(doc, headerStartY, title || "(unnamed)");
  const dateBottom = drawDateAmountHeader(doc, pageWidth, headerStartY, {
    issueDate: createdAt ? fmtDate(createdAt) : undefined,
    issueDateLabel: "Created",
    dueDate: updatedAt ? fmtDate(updatedAt) : undefined,
    dueDateLabel: "Updated",
  });
  let cursorY = Math.max(titleBottom, dateBottom) + 20;

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
    const descriptionHooks = linesTable.descriptions ? makeItemDescriptionHooks(doc, linesTable.descriptions) : {};
    autoTable(doc, {
      startY: cursorY + 4,
      margin: { left: MARGIN_X, right: MARGIN_X },
      theme: "grid",
      styles: { fontSize: 8, cellPadding: 4, textColor: STONE_600 },
      headStyles: { fillColor: INK, textColor: [255, 255, 255] },
      alternateRowStyles: { fillColor: CARD_FILL },
      head: [linesTable.head],
      body: linesTable.rows,
      columnStyles: Object.fromEntries(
        linesTable.head.map((_, i) => [i, i >= numericFrom ? { halign: "right" as const } : {}]),
      ),
      ...descriptionHooks,
    });

    cursorY = doc.lastAutoTable.finalY + 20;
  }

  drawFooterOnAllPages(doc, pageHeight, `StoneSuite Inventory — ${RECORD_TYPE_LABEL[recordType]}`);

  return doc;
}

export async function exportInventoryRecordToPdf(params: InventoryExportParams): Promise<void> {
  const doc = await buildInventoryRecordPdf(params);
  doc.save(buildExportFilename(params.recordType, params.recordNumber, params.title));
  toast.success("Downloaded successfully!");
}
