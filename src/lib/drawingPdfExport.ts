import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { AttachedProfileType, Drawing, EdgeType } from "@/types/drawing";
import type { DrawingSlabUnit } from "@/types/drawingSlab";
import { formatLength } from "@/lib/drawing/units";
import {
  MARGIN_X,
  PAGE_BOTTOM_SAFE,
  INK,
  STONE_600,
  HEADER_BAND_HEIGHT,
  HEADER_ACCENT_HEIGHT,
  drawMasthead,
  drawFooterOnAllPages,
  fmtDate,
  type DocWithAutoTable,
} from "@/lib/pdfBranding";
import { CARD_FILL, drawCompanyBlock, drawDateAmountHeader } from "@/lib/pdfDocumentBlocks";
import {
  PIECE_TABLE_HEAD,
  areaTotals,
  buildAreaScene,
  edgeLegend,
  hexToRgb,
  pieceTableRows,
  slabLayouts,
  type LegendEntry,
} from "@/lib/drawingPdfModel";
import { drawAreaScene, drawSlabLayout, type Box } from "@/lib/drawingPdfSketch";

/** Everything the PDF is built from: the saved drawing and the shop's own lists
 *  that name its edges, profiles and slabs. */
export interface DrawingPdfParams {
  drawing: Drawing;
  orderNumber: string;
  edgeTypes: EdgeType[];
  profileTypes: AttachedProfileType[];
  /** The slabs on the drawing, for the slab layout pages; none = no layout pages. */
  slabs?: DrawingSlabUnit[];
}

export const EMPTY_DRAWING_MESSAGE = "This drawing has no pieces yet — draw something before exporting.";

const WHITE: [number, number, number] = [255, 255, 255];
const NEXT_PAGE_TOP = 44;
const HEADING_GAP = 18;
const SKETCH_MIN_HEIGHT = 170;
/** Kept under the sketch for the legend and the first rows of the pieces table. */
const BELOW_SKETCH_RESERVE = 120;
const LEGEND_SWATCH = 9;
const LEGEND_GAP = 16;
const LEGEND_ROW_HEIGHT = 14;
const SLAB_BOX_BOTTOM_GAP = 20;
const SQ_FT_DECIMALS = 2;

export function drawingPdfFileName(orderNumber: string): string {
  const safe = orderNumber.replace(/[^a-z0-9-_]+/gi, "-").replace(/^-+|-+$/g, "") || "order";
  return `drawing-${safe}.pdf`;
}

/** Heading on the left, a figure line on the right ("3 pieces · 24.50 sq ft"). */
function drawHeading(doc: DocWithAutoTable, pageWidth: number, y: number, title: string, figures: string): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...INK);
  doc.text(title, MARGIN_X, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...STONE_600);
  doc.text(figures, pageWidth - MARGIN_X, y, { align: "right" });
  return y + HEADING_GAP;
}

/** The edge types in use, each as a swatch in its own colour with its total length,
 *  wrapping to a new row when the line is full; then the key to the dashed seams. */
function drawLegend(doc: DocWithAutoTable, pageWidth: number, y: number, entries: LegendEntry[], drawing: Drawing): number {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  const right = pageWidth - MARGIN_X;
  let x = MARGIN_X;
  let rowY = y;
  const place = (width: number): void => {
    if (x + width > right && x > MARGIN_X) {
      x = MARGIN_X;
      rowY += LEGEND_ROW_HEIGHT;
    }
  };

  for (const entry of entries) {
    const length = formatLength(entry.lengthMm, drawing.displayUnit, drawing.fractionDenominator);
    const text = `${entry.name}${entry.alias ? ` (${entry.alias})` : ""} — ${length}`;
    place(LEGEND_SWATCH + 4 + doc.getTextWidth(text));
    doc.setFillColor(...hexToRgb(entry.color));
    doc.rect(x, rowY - LEGEND_SWATCH + 2, LEGEND_SWATCH, LEGEND_SWATCH, "F");
    doc.setTextColor(...STONE_600);
    doc.text(text, x + LEGEND_SWATCH + 4, rowY);
    x += LEGEND_SWATCH + 4 + doc.getTextWidth(text) + LEGEND_GAP;
  }

  place(40);
  doc.setDrawColor(...INK);
  doc.setLineWidth(0.8);
  doc.setLineDashPattern([4, 3], 0);
  doc.line(x, rowY - 3, x + 18, rowY - 3);
  doc.setLineDashPattern([], 0);
  doc.setTextColor(...STONE_600);
  doc.text("Seam", x + 22, rowY);
  return rowY + LEGEND_ROW_HEIGHT;
}

/** Builds the drawing PDF: one landscape page per area (to-scale sketch, edge legend,
 *  pieces table), then one page per slab that has pieces laid on it. Prices are left
 *  out on purpose — this is the shop and sign-off drawing, not a money document. */
export async function buildDrawingPdf(params: DrawingPdfParams): Promise<DocWithAutoTable> {
  const { drawing, orderNumber, edgeTypes, profileTypes, slabs = [] } = params;
  const areas = drawing.areas.filter((a) => a.pieces.length > 0);
  if (areas.length === 0) throw new Error(EMPTY_DRAWING_MESSAGE);

  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "landscape" }) as DocWithAutoTable;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  await drawMasthead(doc, pageWidth, "Drawing", orderNumber);
  const headerStartY = HEADER_BAND_HEIGHT + HEADER_ACCENT_HEIGHT + 30;
  const companyBottom = await drawCompanyBlock(doc, headerStartY);
  const dateBottom = drawDateAmountHeader(doc, pageWidth, headerStartY, {
    issueDate: drawing.updatedAt ? fmtDate(drawing.updatedAt) : undefined,
    issueDateLabel: "Last Updated",
  });
  let cursorY = Math.max(companyBottom, dateBottom) + 14;

  areas.forEach((area, index) => {
    if (index > 0) {
      doc.addPage();
      cursorY = NEXT_PAGE_TOP;
    }
    const totals = areaTotals(area);
    const noun = totals.pieces === 1 ? "piece" : "pieces";
    cursorY = drawHeading(doc, pageWidth, cursorY, area.name, `${totals.pieces} ${noun} · ${totals.sqFt.toFixed(SQ_FT_DECIMALS)} sq ft`);

    const box: Box = {
      x: MARGIN_X,
      y: cursorY,
      w: pageWidth - MARGIN_X * 2,
      h: Math.max(pageHeight - PAGE_BOTTOM_SAFE - cursorY - BELOW_SKETCH_RESERVE, SKETCH_MIN_HEIGHT),
    };
    drawAreaScene(doc, buildAreaScene(area, drawing, edgeTypes, profileTypes), box);
    cursorY = drawLegend(doc, pageWidth, box.y + box.h + 16, edgeLegend(area, edgeTypes), drawing) + 6;

    autoTable(doc, {
      startY: cursorY,
      margin: { left: MARGIN_X, right: MARGIN_X, top: NEXT_PAGE_TOP },
      theme: "grid",
      styles: { fontSize: 8, cellPadding: 4, textColor: STONE_600 },
      headStyles: { fillColor: INK, textColor: WHITE },
      alternateRowStyles: { fillColor: CARD_FILL },
      head: [PIECE_TABLE_HEAD],
      body: pieceTableRows(area, drawing, edgeTypes, profileTypes),
      columnStyles: { 0: { fontStyle: "bold", cellWidth: 56 }, 2: { halign: "right", cellWidth: 50 } },
    });
  });

  for (const layout of slabLayouts(drawing, profileTypes, slabs)) {
    doc.addPage();
    const y = drawHeading(doc, pageWidth, NEXT_PAGE_TOP, `Slab layout — ${layout.title}`, layout.size);
    drawSlabLayout(doc, layout, {
      x: MARGIN_X,
      y,
      w: pageWidth - MARGIN_X * 2,
      h: pageHeight - PAGE_BOTTOM_SAFE - y - SLAB_BOX_BOTTOM_GAP,
    });
  }

  drawFooterOnAllPages(doc, pageHeight, "StoneSuite Sales — Drawing");
  return doc;
}

/** Builds the drawing PDF and downloads it. */
export async function exportDrawingToPdf(params: DrawingPdfParams): Promise<void> {
  const doc = await buildDrawingPdf(params);
  doc.save(drawingPdfFileName(params.orderNumber));
  toast.success("Downloaded successfully!");
}
