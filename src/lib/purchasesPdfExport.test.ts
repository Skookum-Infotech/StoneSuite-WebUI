import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import type * as JsPdfModule from "jspdf"

// jsPDF falls back to writing a real file via Node's fs when no browser download
// mechanism is available (as under jsdom) — stub `save` so tests don't litter the
// working directory with .pdf files.
vi.mock("jspdf", async (importOriginal) => {
  const actual = await importOriginal<typeof JsPdfModule>()
  class TestJsPDF extends actual.jsPDF {
    constructor(...args: ConstructorParameters<typeof actual.jsPDF>) {
      super(...args)
      // jsPDF assigns `save` as an own instance property in its constructor,
      // so it must be overridden here — a prototype method would be shadowed.
      this.save = (() => this) as unknown as typeof this.save
    }
  }
  return { ...actual, default: TestJsPDF, jsPDF: TestJsPDF }
})

const { buildExportFilename, exportPurchasesRecordToPdf } = await import("./purchasesPdfExport")

describe("buildExportFilename", () => {
  it("prefers the record number when present", () => {
    expect(buildExportFilename("purchase_order", "PORD-000001", "Acme Corp")).toBe(
      "purchase_order-PORD-000001.pdf",
    )
  })

  it("falls back to a sanitized title when there is no record number", () => {
    expect(buildExportFilename("vendor", undefined, "Acme & Sons / Co.")).toBe(
      "vendor-Acme-Sons-Co-.pdf",
    )
  })

  it("falls back to the record type when title and record number are both empty", () => {
    expect(buildExportFilename("item_receipt", undefined, "")).toBe("item_receipt-item_receipt.pdf")
  })
})

describe("exportPurchasesRecordToPdf", () => {
  beforeEach(() => {
    // No real network in jsdom — drawMasthead's logo fetches reject and are caught internally.
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("no network in tests")))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("builds and saves a Purchase Order PDF with sections, an items table, and totals", async () => {
    await expect(
      exportPurchasesRecordToPdf({
        recordType: "purchase_order",
        title: "PORD-000001",
        recordNumber: "PORD-000001",
        statusLabel: "Sent",
        counterpartyName: "Acme Supply Co",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-02T00:00:00Z",
        sections: [
          { title: "Primary Information", rows: [["Order Date", "Jan 1, 2026"], ["Reference #", ""]] },
          { title: "Ship To", rows: [["Address", "123 Main St"]] },
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
    ).resolves.toBeUndefined()
  })

  it("builds and saves an Item Receipt PDF with an items table and no totals", async () => {
    await expect(
      exportPurchasesRecordToPdf({
        recordType: "item_receipt",
        title: "IRCT-000001",
        recordNumber: "IRCT-000001",
        statusLabel: "Received",
        counterpartyName: "Acme Supply Co",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-02T00:00:00Z",
        sections: [
          { title: "Source Purchase Order", rows: [["Purchase Order #", "PORD-000001"]] },
          { title: "Receipt Information", rows: [["Receipt Date", "Jan 2, 2026"]] },
        ],
        itemsTable: {
          head: ["#", "Item", "Ordered", "Received"],
          rows: [["1", "Granite Slab", "10", "10"]],
          numericFrom: 2,
        },
      }),
    ).resolves.toBeUndefined()
  })

  it("builds and saves a Vendor profile PDF with sections only (no items table, no totals)", async () => {
    await expect(
      exportPurchasesRecordToPdf({
        recordType: "vendor",
        title: "Acme Supply Co",
        recordNumber: "VEND-000001",
        statusLabel: "Active",
        counterpartyLabel: "Vendor Type",
        counterpartyName: "Organization",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-02T00:00:00Z",
        sections: [
          { title: "Company Details", rows: [["Legal Business Name", "Acme Supply Co LLC"]] },
          { title: "Contact & Location", rows: [["Email Address", "hello@acme.test"]] },
        ],
      }),
    ).resolves.toBeUndefined()
  })
})
