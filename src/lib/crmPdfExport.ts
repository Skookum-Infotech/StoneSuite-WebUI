import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  CRM_CORE_SECTIONS,
  CRM_CUSTOMER_BALANCE_SECTION,
  type CrmCoreField,
} from "@/lib/crmFields";
import type { CrmLookups, LookupItem } from "@/services/lookupService";

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

interface DocWithAutoTable extends jsPDF {
  lastAutoTable: { finalY: number };
}

const RECORD_TYPE_LABEL: Record<CrmExportRecordType, string> = {
  lead: "Lead",
  prospect: "Prospect",
  customer: "Customer",
};

const MARGIN_X = 40;
const PAGE_BOTTOM_SAFE = 80;
const BRAND_LIME: [number, number, number] = [194, 245, 137];
const BRAND_DARK_ACCENT: [number, number, number] = [113, 156, 59];
const INK: [number, number, number] = [28, 25, 23];
const STONE_200: [number, number, number] = [231, 229, 228];
const STONE_400: [number, number, number] = [168, 162, 158];
const STONE_600: [number, number, number] = [87, 83, 78];

const HEADER_BAND_HEIGHT = 78;
const HEADER_ACCENT_HEIGHT = 3;

// Fixed crop window (in the source SVG's native 3000x3000 canvas) isolating the
// Elevation Stone wordmark — the rest of the canvas is empty padding.
const ELEVATION_STONE_LOGO_CROP = { x: 299.69, y: 1229.63, width: 2399.84, height: 536.51 };

type LoadedLogo = { dataUrl: string; width: number; height: number };

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

export function fmtDate(iso: string): string {
  if (!iso) return "—";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function buildExportFilename(
  recordType: CrmExportRecordType,
  recordNumber: string | undefined,
  title: string,
): string {
  const safeName = (recordNumber || title || recordType).replace(/[^a-z0-9-_]+/gi, "-");
  return `${recordType}-${safeName}.pdf`;
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

  const [stoneSuiteLogo, clientLogo] = await Promise.all([
    loadPngDataUrl("/logo-white.png"),
    rasterizeSvgToDataUrl("/elevation-stone-logo.svg", ELEVATION_STONE_LOGO_CROP),
  ]);

  // ── Masthead: dark band with the StoneSuite mark (bigger, high-contrast) on
  // the left and the client's logo on a white plate on the right ──
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

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...STONE_400);
    doc.text(`StoneSuite CRM — ${RECORD_TYPE_LABEL[recordType]} Record`, MARGIN_X, pageHeight - 20);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - MARGIN_X, pageHeight - 20, { align: "right" });
  }

  return doc;
}

/** Builds and downloads a branded PDF summary of a CRM Lead/Prospect/Customer record. */
export async function exportCrmRecordToPdf(params: CrmExportParams): Promise<void> {
  const doc = await buildCrmRecordPdf(params);
  doc.save(buildExportFilename(params.recordType, params.recordNumber, params.title));
}
