import type jsPDF from "jspdf";

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

// Fixed crop window (in the source SVG's native 3000x3000 canvas) isolating the
// Elevation Stone wordmark — the rest of the canvas is empty padding.
const ELEVATION_STONE_LOGO_CROP = { x: 299.69, y: 1229.63, width: 2399.84, height: 536.51 };

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

/** Fetches an SVG, crops it to a fixed region, and rasterizes it to a PNG data URL —
 *  jsPDF's addImage() only accepts raster formats, not SVG markup. */
async function rasterizeSvgToDataUrl(
  url: string,
  crop: { x: number; y: number; width: number; height: number },
  targetHeightPx = 480,
): Promise<LoadedLogo | null> {
  let objectUrl: string | undefined;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const rawSvg = await res.text();
    const croppedSvg = rawSvg.replace(
      /<svg[^>]*>/,
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${crop.x} ${crop.y} ${crop.width} ${crop.height}">`,
    );

    objectUrl = URL.createObjectURL(new Blob([croppedSvg], { type: "image/svg+xml" }));
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Failed to rasterize SVG logo"));
      el.src = objectUrl as string;
    });

    const height = targetHeightPx;
    const width = Math.round(height * (crop.width / crop.height));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, width, height);
    return { dataUrl: canvas.toDataURL("image/png"), width, height };
  } catch {
    return null;
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}

/** Draws the dark masthead band (StoneSuite mark + client logo plate) at the
 *  top of the current page. */
export async function drawMasthead(doc: DocWithAutoTable, pageWidth: number): Promise<void> {
  const [stoneSuiteLogo, clientLogo] = await Promise.all([
    loadPngDataUrl("/logo-white.png"),
    rasterizeSvgToDataUrl("/elevation-stone-logo.svg", ELEVATION_STONE_LOGO_CROP),
  ]);

  doc.setFillColor(...INK);
  doc.rect(0, 0, pageWidth, HEADER_BAND_HEIGHT, "F");
  doc.setFillColor(...BRAND_LIME);
  doc.rect(0, HEADER_BAND_HEIGHT, pageWidth, HEADER_ACCENT_HEIGHT, "F");

  if (stoneSuiteLogo) {
    const logoH = 36;
    const logoW = (stoneSuiteLogo.width / stoneSuiteLogo.height) * logoH;
    doc.addImage(
      stoneSuiteLogo.dataUrl,
      "PNG",
      MARGIN_X,
      (HEADER_BAND_HEIGHT - logoH) / 2,
      logoW,
      logoH,
    );
  }

  if (clientLogo) {
    const plateH = 46;
    const plateY = (HEADER_BAND_HEIGHT - plateH) / 2;
    const logoH = 24;
    const logoW = (clientLogo.width / clientLogo.height) * logoH;
    const platePadX = 14;
    const plateW = logoW + platePadX * 2;
    const plateX = pageWidth - MARGIN_X - plateW;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(...BRAND_LIME);
    doc.text("PREPARED FOR", plateX + plateW, plateY - 5, { align: "right", charSpace: 1.2 });

    doc.setFillColor(255, 255, 255);
    doc.roundedRect(plateX, plateY, plateW, plateH, 5, 5, "F");
    doc.addImage(
      clientLogo.dataUrl,
      "PNG",
      plateX + platePadX,
      plateY + (plateH - logoH) / 2,
      logoW,
      logoH,
    );
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
