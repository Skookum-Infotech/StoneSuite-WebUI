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

const { buildExportFilename, exportFinanceRecordToPdf } = await import("./financePdfExport")

describe("buildExportFilename", () => {
  it("prefers the record number when present", () => {
    expect(buildExportFilename("1103", "Operating Bank Account")).toBe("chart-of-accounts-1103.pdf")
  })

  it("falls back to a sanitized title when there is no record number", () => {
    expect(buildExportFilename(undefined, "Acme & Sons / Reserve")).toBe(
      "chart-of-accounts-Acme-Sons-Reserve.pdf",
    )
  })

  it("falls back to 'account' when title and record number are both empty", () => {
    expect(buildExportFilename(undefined, "")).toBe("chart-of-accounts-account.pdf")
  })
})

describe("exportFinanceRecordToPdf", () => {
  beforeEach(() => {
    // No real network in jsdom — drawMasthead's logo fetches reject and are caught internally.
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("no network in tests")))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("builds and saves an account PDF with sections only (no items table, no totals)", async () => {
    await expect(
      exportFinanceRecordToPdf({
        title: "Operating Bank Account",
        recordNumber: "1103",
        statusLabel: "Active",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-02T00:00:00Z",
        sections: [
          { title: "Classification", rows: [["Category", "1000 — Assets"], ["Type", "Bank"]] },
          { title: "Attributes", rows: [["Bank Name", "First National"], ["Account Number", ""]] },
        ],
      }),
    ).resolves.toBeUndefined()
  })

  it("drops rows with an empty value and skips a section that ends up empty", async () => {
    await expect(
      exportFinanceRecordToPdf({
        title: "Suspense",
        recordNumber: "9102",
        sections: [
          { title: "Attributes", rows: [["Location", ""]] },
          { title: "Classification", rows: [["Type", "General"]] },
        ],
      }),
    ).resolves.toBeUndefined()
  })
})
