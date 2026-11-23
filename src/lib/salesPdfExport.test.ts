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

  it("builds and saves a PDF with a hero amount, bill/ship addresses, an items table, and totals", async () => {
    await expect(
      exportSalesDocToPdf({
        docType: "invoice",
        title: "INV-0001",
        recordNumber: "INV-0001",
        statusLabel: "Sent",
        customerName: "Acme Corp",
        issueDate: "Jan 1, 2026",
        dueDate: "Jan 31, 2026",
        keyAmount: { label: "Amount Due", value: "$400.00" },
        billTo: { customerName: "Acme Corp", addrLine1: "123 Main St", city: "Austin", zip: "78701" },
        shipTo: { customerName: "Acme Warehouse", addrLine1: "456 Oak Ave" },
        notesText: "Thank you for your business.",
        sections: [{ title: "Primary Information", rows: [["PO Number", "PO-9"], ["Reference #", ""]] }],
        itemsTable: {
          head: ["#", "Item", "Qty", "Total"],
          rows: [["1", "Granite Slab", "2", "$400.00"]],
          descriptions: ["3cm polished, book-matched"],
          numericFrom: 2,
        },
        totals: [
          { label: "Subtotal", value: "$400.00" },
          { label: "Grand Total", value: "$400.00", bold: true },
        ],
      }),
    ).resolves.toBeUndefined();
  });

  it("builds and saves a PDF for a scalar doc type with no address data (customer fallback line)", async () => {
    await expect(
      exportSalesDocToPdf({
        docType: "payment",
        title: "PMT-0001",
        recordNumber: "PMT-0001",
        statusLabel: "Applied",
        customerName: "Acme Corp",
        issueDate: "Jan 1, 2026",
        keyAmount: { label: "Unapplied", value: "$0.00" },
        sections: [{ title: "Primary Information", rows: [["Payment Method", "Check"]] }],
        totals: [{ label: "Amount", value: "$100.00", bold: true }],
      }),
    ).resolves.toBeUndefined();
  });

  it("builds and saves a PDF with sections only (no items table, no totals, no key amount)", async () => {
    await expect(
      exportSalesDocToPdf({
        docType: "fabrication_job",
        title: "FJ-0001",
        recordNumber: "FJ-0001",
        statusLabel: "In Progress",
        customerName: "Acme Corp",
        sections: [{ title: "Job Site", rows: [["Address", "456 Oak Ave"]] }],
      }),
    ).resolves.toBeUndefined();
  });
});
