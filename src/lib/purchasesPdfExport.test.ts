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

  it("builds and saves a Purchase Order PDF with a vendor/ship-to address row, an items table, and totals", async () => {
    await expect(
      exportPurchasesRecordToPdf({
        recordType: "purchase_order",
        title: "PORD-000001",
        recordNumber: "PORD-000001",
        statusLabel: "Sent",
        issueDate: "Jan 1, 2026",
        dueDate: "Jan 10, 2026",
        dueDateLabel: "Expected Date",
        counterpartyName: "Acme Supply Co",
        shipTo: { customerName: "Main Warehouse", addrLine1: "123 Main St", city: "Austin", zip: "78701" },
        termsText: "Net 30 from delivery.",
        sections: [{ title: "Primary Information", rows: [["Reference #", ""]] }],
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
    ).resolves.toBeUndefined()
  })

  it("builds and saves an Item Receipt PDF with an items table and no totals", async () => {
    await expect(
      exportPurchasesRecordToPdf({
        recordType: "item_receipt",
        title: "IRCT-000001",
        recordNumber: "IRCT-000001",
        statusLabel: "Received",
        issueDate: "Jan 2, 2026",
        issueDateLabel: "Receipt Date",
        counterpartyName: "Acme Supply Co",
        sections: [
          { title: "Source Purchase Order", rows: [["Purchase Order #", "PORD-000001"]] },
          { title: "Receipt Information", rows: [["Warehouse", "Main"]] },
        ],
        itemsTable: {
          head: ["#", "Item", "Ordered", "Received"],
          rows: [["1", "Granite Slab", "10", "10"]],
          numericFrom: 2,
        },
      }),
    ).resolves.toBeUndefined()
  })

  it("builds and saves a Vendor profile PDF with sections only (no items/totals/footer cards)", async () => {
    await expect(
      exportPurchasesRecordToPdf({
        recordType: "vendor",
        title: "Acme Supply Co",
        recordNumber: "VEND-000001",
        statusLabel: "Active",
        issueDate: "Jan 1, 2026",
        issueDateLabel: "Created",
        dueDate: "Jan 2, 2026",
        dueDateLabel: "Updated",
        sections: [
          { title: "Company Details", rows: [["Vendor Type", "Organization"], ["Legal Business Name", "Acme Supply Co LLC"]] },
          { title: "Contact & Location", rows: [["Email Address", "hello@acme.test"]] },
        ],
      }),
    ).resolves.toBeUndefined()
  })

  it("builds and saves a Vendor Credit PDF with an applications table, totals, and a key amount", async () => {
    await expect(
      exportPurchasesRecordToPdf({
        recordType: "vendor_credit",
        title: "VCR-000001",
        recordNumber: "VCR-000001",
        statusLabel: "Approved",
        issueDate: "Jan 2, 2026",
        issueDateLabel: "Credit Date",
        keyAmount: { label: "Unapplied", value: "$650.00" },
        counterpartyName: "Acme Supply Co",
        notesText: "Restocking fee waived.",
        sections: [
          { title: "Primary Information", rows: [["Reference #", "RMA-4471"], ["Reason", "Returned defective slab"]] },
        ],
        itemsTable: {
          title: "Applications",
          head: ["Vendor Bill #", "Amount", "Applied On"],
          rows: [["VBIL-000001", "$200.00", "Jan 2, 2026"]],
          numericFrom: 1,
        },
        totals: [
          { label: "Amount", value: "$850.00", bold: true },
          { label: "Applied", value: "$200.00" },
        ],
      }),
    ).resolves.toBeUndefined()
  })
})
