import type jsPDF from "jspdf";
import type { ImageCompression } from "jspdf";
import { companyProfileService } from "@/services/companyProfileService";

/** Shared StoneSuite masthead/footer branding for exported PDFs (CRM records,
 *  Sales documents). One source of truth so every exported PDF looks the same. */

export interface DocWithAutoTable extends jsPDF {
  lastAutoTable: { finalY: number };
}

export const MARGIN_X = 40;
export const PAGE_BOTTOM_SAFE = 80;
export const BRAND_LIME: [number, number, number] = [194, 245, 137];
export const BRAND_DARK_ACCENT: [number, number, number] = [113, 156, 59];
export const INK: [number, number, number] = [28, 25, 23];
export const STONE_200: [number, number, number] = [231, 229, 228];
export const STONE_400: [number, number, number] = [168, 162, 158];
export const STONE_600: [number, number, number] = [87, 83, 78];

export const HEADER_BAND_HEIGHT = 78;
export const HEADER_ACCENT_HEIGHT = 3;

// jsPDF's addImage() defaults to no compression, embedding raster images as raw
// bitmaps — "SLOW" makes it DEFLATE-compress them (still fully lossless) before
// embedding, which is the difference between a ~260KB and a ~14KB logo in the PDF.
const IMAGE_COMPRESSION: ImageCompression = "SLOW";

type LoadedLogo = { dataUrl: string; width: number; height: number };

export function fmtDate(iso: string): string {
  if (!iso) return "—";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

async function loadPngDataUrl(url: string): Promise<LoadedLogo | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
    const dims = await new Promise<{ width: number; height: number }>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => reject(new Error("Failed to read logo dimensions"));
      img.src = dataUrl;
    });
    return { dataUrl, ...dims };
  } catch {
    return null;
  }
}

/** Loads the tenant's own uploaded logo (Configuration -> Company Info) for the
 *  masthead — same self-fetch precedent as drawCompanyBlock in
 *  pdfDocumentBlocks.ts. The backend already crops it to content and re-encodes
 *  it as PNG on upload, so no client-side cropping is needed here. Returns null
 *  (masthead just omits the client logo) when the tenant has none set, the
 *  request fails, or the image can't be loaded — a missing logo must never
 *  break PDF export. */
async function loadTenantLogo(): Promise<LoadedLogo | null> {
  try {
    const { logoUrl } = await companyProfileService.get();
    if (!logoUrl) return null;
    return await loadPngDataUrl(logoUrl);
  } catch {
    return null;
  }
}

/** Draws the dark masthead band (StoneSuite mark + client logo, both left-aligned)
 *  at the top of the current page. `docTypeLabel`/`recordNumber`/`statusLabel` are
 *  optional — passing them right-aligns a document title block (e.g. "INVOICE" /
 *  "INV-000142" / "Draft") the way a professional invoice names itself up front;
 *  domains that don't pass them keep the plain branding-only masthead. */
export async function drawMasthead(
  doc: DocWithAutoTable,
  pageWidth: number,
  docTypeLabel?: string,
  recordNumber?: string,
  statusLabel?: string,
): Promise<void> {
  const [stoneSuiteLogo, clientLogo] = await Promise.all([
    loadPngDataUrl("/logo-white.png"),
    loadTenantLogo(),
  ]);

  doc.setFillColor(...INK);
  doc.rect(0, 0, pageWidth, HEADER_BAND_HEIGHT, "F");
  doc.setFillColor(...BRAND_LIME);
  doc.rect(0, HEADER_BAND_HEIGHT, pageWidth, HEADER_ACCENT_HEIGHT, "F");

  const logoH = 30;
  let logoX = MARGIN_X;
  if (stoneSuiteLogo) {
    const logoW = (stoneSuiteLogo.width / stoneSuiteLogo.height) * logoH;
    doc.addImage(
      stoneSuiteLogo.dataUrl,
      "PNG",
      logoX,
      (HEADER_BAND_HEIGHT - logoH) / 2,
      logoW,
      logoH,
      undefined,
      IMAGE_COMPRESSION,
    );
    logoX += logoW + 18;
  }

  if (clientLogo) {
    const logoW = (clientLogo.width / clientLogo.height) * logoH;
    doc.addImage(
      clientLogo.dataUrl,
      "PNG",
      logoX,
      (HEADER_BAND_HEIGHT - logoH) / 2,
      logoW,
      logoH,
      undefined,
      IMAGE_COMPRESSION,
    );
  }

  if (docTypeLabel) {
    const rightX = pageWidth - MARGIN_X;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(255, 255, 255);
    doc.text(docTypeLabel.toUpperCase(), rightX, HEADER_BAND_HEIGHT / 2 - 2, { align: "right" });

    let metaY = HEADER_BAND_HEIGHT / 2 + 17;
    if (recordNumber) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(...BRAND_LIME);
      doc.text(recordNumber, rightX, metaY, { align: "right" });
      metaY += 13;
    }
    if (statusLabel) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(...STONE_200);
      doc.text(statusLabel, rightX, metaY, { align: "right" });
    }
  }
}

/** Draws the "<footerLabel> — Page X of Y" footer on every page of the document. */
export function drawFooterOnAllPages(doc: DocWithAutoTable, pageHeight: number, footerLabel: string): void {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...STONE_400);
    doc.text(footerLabel, MARGIN_X, pageHeight - 20);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - MARGIN_X, pageHeight - 20, { align: "right" });
  }
}
