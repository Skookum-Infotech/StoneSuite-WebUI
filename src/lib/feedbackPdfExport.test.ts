import { describe, it, expect } from "vitest"
import type * as JsPdfModule from "jspdf"
import { vi } from "vitest"

// jsPDF falls back to writing a real file via Node's fs when no browser download
// mechanism is available (as under jsdom) — stub `save` so tests don't litter the
// working directory with .pdf files.
vi.mock("jspdf", async (importOriginal) => {
  const actual = await importOriginal<typeof JsPdfModule>()
  class TestJsPDF extends actual.jsPDF {
    constructor(...args: ConstructorParameters<typeof actual.jsPDF>) {
      super(...args)
      this.save = (() => this) as unknown as typeof this.save
    }
  }
  return { ...actual, default: TestJsPDF, jsPDF: TestJsPDF }
})

const { buildFeedbackExportFilename } = await import("./feedbackPdfExport")

describe("buildFeedbackExportFilename", () => {
  it("uses the ticket number", () => {
    expect(buildFeedbackExportFilename("FB-000123")).toBe("feedback-FB-000123.pdf")
  })

  it("sanitizes characters that are unsafe in a filename", () => {
    expect(buildFeedbackExportFilename("FB/000123?x")).toBe("feedback-FB-000123-x.pdf")
  })

  it("falls back to 'ticket' when the ticket number is empty", () => {
    expect(buildFeedbackExportFilename("")).toBe("feedback-ticket.pdf")
  })
})
