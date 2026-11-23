import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  MARGIN_X,
  BRAND_LIME,
  INK,
  STONE_600,
  HEADER_BAND_HEIGHT,
  HEADER_ACCENT_HEIGHT,
  drawMasthead,
  drawFooterOnAllPages,
  type DocWithAutoTable,
} from "@/lib/pdfBranding";
import type { ReportTable } from "@/lib/reportExport";

// A cell reads as a number/amount/date-count when it starts like one; those
// columns are right-aligned so figures line up.
const NUMERIC_CELL = /^[-($€£]?\s?\d/;
const NO_VALUE_CELL = "—";
const SUBTITLE_GAP = 30;
const TABLE_GAP = 14;
const TITLE_FONT_SIZE = 14;
const SUBTITLE_FONT_SIZE = 9;
const TABLE_FONT_SIZE = 8;
const CELL_PADDING = 4;
const CARD_FILL: [number, number, number] = [250, 250, 249];

/** Column indexes whose every filled cell looks numeric (the first column is
 *  always a label, so it is never right-aligned). */
export function numericColumns(table: ReportTable): number[] {
  const all = table.totalsRow ? [...table.rows, table.totalsRow] : table.rows;
  return table.headers
    .map((_, col) => col)
    .filter((col) => {
      if (col === 0) return false;
      const filled = all.map((r) => r[col] ?? "").filter((c) => c !== "" && c !== NO_VALUE_CELL);
      return filled.length > 0 && filled.every((c) => NUMERIC_CELL.test(c));
    });
}

/** Renders a report as a landscape A4 PDF (reports are wide tables) with the
 *  shared masthead + footer, and returns the document without saving it. */
export async function buildReportPdf(table: ReportTable): Promise<DocWithAutoTable> {
  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "landscape" }) as DocWithAutoTable;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  await drawMasthead(doc, pageWidth, "Report", table.title);

  let cursorY = HEADER_BAND_HEIGHT + HEADER_ACCENT_HEIGHT + SUBTITLE_GAP;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(TITLE_FONT_SIZE);
  doc.setTextColor(...INK);
  doc.text(table.title, MARGIN_X, cursorY);
  cursorY += TABLE_GAP;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(SUBTITLE_FONT_SIZE);
  doc.setTextColor(...STONE_600);
  doc.text(table.subtitle, MARGIN_X, cursorY);

  const numeric = new Set(numericColumns(table));
  const body = table.totalsRow ? [...table.rows, table.totalsRow] : table.rows;
  const lastRow = body.length - 1;
  autoTable(doc, {
    startY: cursorY + TABLE_GAP,
    margin: { left: MARGIN_X, right: MARGIN_X },
    theme: "grid",
    styles: { fontSize: TABLE_FONT_SIZE, cellPadding: CELL_PADDING, textColor: STONE_600 },
    headStyles: { fillColor: BRAND_LIME, textColor: INK },
    alternateRowStyles: { fillColor: CARD_FILL },
    head: [table.headers],
    body,
    columnStyles: Object.fromEntries(table.headers.map((_, i) => [i, numeric.has(i) ? { halign: "right" as const } : {}])),
    didParseCell: (data) => {
      if (table.totalsRow && data.section === "body" && data.row.index === lastRow) {
        data.cell.styles.fontStyle = "bold";
      }
    },
  });

  drawFooterOnAllPages(doc, pageHeight, `StoneSuite Reports — ${table.title}`);
  return doc;
}

export async function exportReportTablePdf(table: ReportTable, filename: string): Promise<void> {
  const doc = await buildReportPdf(table);
  doc.save(`${filename}.pdf`);
  toast.success("Downloaded successfully!");
}
