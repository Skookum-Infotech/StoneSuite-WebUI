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

const { buildExportFilename, exportInventoryRecordToPdf } = await import("./inventoryPdfExport");

describe("buildExportFilename", () => {
  it("prefers the record number when present", () => {
    expect(buildExportFilename("inventory_item", "ITM-000001", "Absolute Black Granite")).toBe(
      "inventory_item-ITM-000001.pdf",
    );
  });

  it("falls back to a sanitized title when there is no record number", () => {
    expect(buildExportFilename("inventory_unit", undefined, "Acme & Sons / Co.")).toBe(
      "inventory_unit-Acme-Sons-Co-.pdf",
    );
  });

  it("falls back to the record type when title and record number are both empty", () => {
    expect(buildExportFilename("bundle", undefined, "")).toBe("bundle-bundle.pdf");
  });
});

describe("exportInventoryRecordToPdf", () => {
  beforeEach(() => {
    // No real network in jsdom — drawMasthead's logo fetches reject and are caught internally.
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("no network in tests")));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("builds and saves an Inventory Item PDF with sections only (no lines table)", async () => {
    await expect(
      exportInventoryRecordToPdf({
        recordType: "inventory_item",
        title: "Absolute Black Granite Slab",
        recordNumber: "ITM-000001",
        statusLabel: "Active",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-02T00:00:00Z",
        sections: [
          {
            title: "Primary Information",
            rows: [["SKU", "ITM-000001"], ["Unit Price", "$200.00"]],
          },
          {
            title: "Stone Attributes",
            rows: [["Material", "Granite"], ["Color", ""]],
          },
        ],
      }),
    ).resolves.toBeUndefined();
  });

  it("builds and saves an Inventory Unit PDF with no record number", async () => {
    await expect(
      exportInventoryRecordToPdf({
        recordType: "inventory_unit",
        title: "SN-000042",
        statusLabel: "in stock",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-02T00:00:00Z",
        sections: [
          { title: "Unit Information", rows: [["Item", "Absolute Black Granite Slab"], ["Grade", "A"]] },
        ],
      }),
    ).resolves.toBeUndefined();
  });

  it("builds and saves a document-shaped record PDF with a lines table and description sublines", async () => {
    await expect(
      exportInventoryRecordToPdf({
        recordType: "transfer",
        title: "TRF-000001",
        recordNumber: "TRF-000001",
        statusLabel: "In Transit",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-02T00:00:00Z",
        sections: [{ title: "Primary Information", rows: [["From Warehouse", "Main"], ["To Warehouse", "Annex"]] }],
        linesTable: {
          head: ["#", "Item", "Qty"],
          rows: [["1", "Granite Slab", "2"]],
          descriptions: ["3cm polished, book-matched"],
          numericFrom: 2,
        },
      }),
    ).resolves.toBeUndefined();
  });
});
