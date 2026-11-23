import type { CellHookData } from "jspdf-autotable";
import { type DocWithAutoTable, BRAND_DARK_ACCENT, STONE_400, STONE_600 } from "@/lib/pdfBranding";
import { CARD_FILL } from "@/lib/pdfDocumentBlocks";

/** Text-paragraph cards (Notes, and placeholders for sections not wired up to
 *  data yet) and the item-table description-subline hooks — split out of
 *  pdfDocumentBlocks.ts to keep both files under the project's 300-line cap. */

const CARD_RADIUS = 6;
const LABEL_UNDERLINE_WIDTH = 22;
const ROW_GAP = 13;

function drawLabelWithUnderline(doc: DocWithAutoTable, x: number, y: number, label: string): void {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...STONE_400);
  doc.text(label.toUpperCase(), x, y, { charSpace: 1 });
  doc.setDrawColor(...BRAND_DARK_ACCENT);
  doc.setLineWidth(1.5);
  doc.line(x, y + 4, x + LABEL_UNDERLINE_WIDTH, y + 4);
}

/** Light card with a labeled paragraph — used both for real content (Notes)
 *  and, with `placeholder: true`, for sections not wired up to data yet
 *  (Terms & Conditions, Payment Details) so every exported PDF keeps the same
 *  professional shape while those are pending. */
export function drawTextCard(
  doc: DocWithAutoTable,
  x: number,
  width: number,
  cursorY: number,
  label: string,
  body: string,
  opts: { placeholder?: boolean } = {},
): number {
  const bodyStyle = opts.placeholder ? "italic" : "normal";
  doc.setFont("helvetica", bodyStyle);
  doc.setFontSize(9);
  const lines = doc.splitTextToSize(body, width - 32) as string[];
  const height = 36 + lines.length * ROW_GAP + 6;

  doc.setFillColor(...CARD_FILL);
  doc.roundedRect(x, cursorY, width, height, CARD_RADIUS, CARD_RADIUS, "F");

  drawLabelWithUnderline(doc, x + 16, cursorY + 18, label);

  doc.setFont("helvetica", bodyStyle);
  doc.setFontSize(9);
  doc.setTextColor(...(opts.placeholder ? STONE_400 : STONE_600));
  let y = cursorY + 36;
  for (const line of lines) {
    doc.text(line, x + 16, y);
    y += ROW_GAP;
  }
  return cursorY + height;
}

// Every itemsTable caller puts the row number first and the item name second —
// the column the per-row description subline attaches under.
export const ITEM_NAME_COLUMN_INDEX = 1;
const ITEM_DESCRIPTION_FONT_SIZE = 7.5;
const ITEM_DESCRIPTION_GAP = 3;

/** autoTable `didParseCell`/`didDrawCell` hooks that render each row's optional
 *  description as a small gray line under the item name, instead of its own
 *  column — keeps the table scannable the way a real invoice's line items read. */
export function makeItemDescriptionHooks(
  doc: DocWithAutoTable,
  descriptions: Array<string | undefined>,
): { didParseCell: (data: CellHookData) => void; didDrawCell: (data: CellHookData) => void } {
  return {
    didParseCell(data: CellHookData) {
      if (data.section !== "body" || data.column.index !== ITEM_NAME_COLUMN_INDEX) return;
      const description = descriptions[data.row.index];
      if (!description) return;
      data.cell.styles.valign = "top";
      const nameFontSize = data.cell.styles.fontSize;
      data.cell.styles.minCellHeight =
        data.cell.padding("vertical") + nameFontSize * 1.15 + ITEM_DESCRIPTION_GAP + ITEM_DESCRIPTION_FONT_SIZE * 1.15;
    },
    didDrawCell(data: CellHookData) {
      if (data.section !== "body" || data.column.index !== ITEM_NAME_COLUMN_INDEX) return;
      const description = descriptions[data.row.index];
      if (!description) return;
      const nameFontSize = data.cell.styles.fontSize;
      const x = data.cell.x + data.cell.padding("left");
      const y = data.cell.y + data.cell.padding("top") + nameFontSize * 1.15 + ITEM_DESCRIPTION_GAP;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(ITEM_DESCRIPTION_FONT_SIZE);
      doc.setTextColor(...STONE_400);
      doc.text(description, x, y);
    },
  };
}
