import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type * as JsPdfModule from "jspdf";

// jsPDF falls back to writing a real file via Node's fs when no browser download
// mechanism is available (as under jsdom) — stub `save` so tests don't litter the
// working directory with .pdf files.
vi.mock("jspdf", async (importOriginal) => {
  const actual = await importOriginal<typeof JsPdfModule>();
  class TestJsPDF extends actual.jsPDF {
    constructor(...args: ConstructorParameters<typeof actual.jsPDF>) {
      super(...args);
      // jsPDF assigns `save` as an own instance property in its constructor,
      // so it must be overridden here — a prototype method would be shadowed.
      this.save = (() => this) as unknown as typeof this.save;
    }
  }
  return { ...actual, default: TestJsPDF, jsPDF: TestJsPDF };
});

const { buildExportFilename, exportSalesDocToPdf } = await import("./salesPdfExport");

describe("buildExportFilename", () => {
  it("prefers the record number when present", () => {
    expect(buildExportFilename("sales_order", "SO-0001", "Acme Corp")).toBe("sales_order-SO-0001.pdf");
  });

  it("falls back to a sanitized title when there is no record number", () => {
    expect(buildExportFilename("invoice", undefined, "Acme & Sons / Co.")).toBe(
      "invoice-Acme-Sons-Co-.pdf",
    );
  });

  it("falls back to the doc type when title and record number are both empty", () => {
    expect(buildExportFilename("payment", undefined, "")).toBe("payment-payment.pdf");
  });
});

describe("exportSalesDocToPdf", () => {
  beforeEach(() => {
    // No real network in jsdom — drawMasthead's logo fetches reject and are caught internally.
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("no network in tests")));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("builds and saves a PDF with sections, an items table, and totals", async () => {
    await expect(
      exportSalesDocToPdf({
        docType: "sales_order",
        title: "SO-0001",
        recordNumber: "SO-0001",
        statusLabel: "Open",
        customerName: "Acme Corp",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-02T00:00:00Z",
        sections: [
          { title: "Primary Information", rows: [["Order Date", "Jan 1, 2026"], ["PO Number", ""]] },
          { title: "Bill To", rows: [["Address", "123 Main St"]] },
        ],
        itemsTable: {
          head: ["#", "Item", "Qty", "Total"],
          rows: [["1", "Granite Slab", "2", "$400.00"]],
          numericFrom: 2,
        },
        totals: [
          { label: "Subtotal", value: "$400.00" },
          { label: "Grand Total", value: "$400.00", bold: true },
        ],
      }),
    ).resolves.toBeUndefined();
  });

  it("builds and saves a PDF for a scalar doc type with no line items", async () => {
    await expect(
      exportSalesDocToPdf({
        docType: "payment",
        title: "PMT-0001",
        recordNumber: "PMT-0001",
        statusLabel: "Applied",
        customerName: "Acme Corp",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-02T00:00:00Z",
        sections: [{ title: "Primary Information", rows: [["Payment Method", "Check"]] }],
        totals: [
          { label: "Amount", value: "$100.00", bold: true },
          { label: "Applied", value: "$100.00" },
          { label: "Unapplied", value: "$0.00", bold: true },
        ],
      }),
    ).resolves.toBeUndefined();
  });

  it("builds and saves a PDF with sections only (no items table, no totals)", async () => {
    await expect(
      exportSalesDocToPdf({
        docType: "fabrication_job",
        title: "FJ-0001",
        recordNumber: "FJ-0001",
        statusLabel: "In Progress",
        customerName: "Acme Corp",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-02T00:00:00Z",
        sections: [{ title: "Job Site", rows: [["Address", "456 Oak Ave"]] }],
      }),
    ).resolves.toBeUndefined();
  });
});
