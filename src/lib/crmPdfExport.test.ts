import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type * as JsPdfModule from "jspdf";
import type { CrmCoreField } from "@/lib/crmFields";
import type { CrmLookups } from "@/services/lookupService";

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

const {
  buildExportFilename,
  exportCrmRecordToPdf,
  fieldDisplayValue,
  fmtDate,
  isFieldVisible,
  resolveLookupLabel,
} = await import("./crmPdfExport");

const lookupField: CrmCoreField = {
  key: "customer_type",
  label: "Customer Type",
  type: "lookup-select",
  lookupKey: "customerTypes",
};
const checkboxField: CrmCoreField = { key: "customer_is_child", label: "Is Child", type: "checkbox" };
const textField: CrmCoreField = { key: "customer_name", label: "Customer Name", type: "text" };

const lookups = {
  customerTypes: [{ id: 1, code: "vip", name: "VIP" }],
} as unknown as CrmLookups;

describe("resolveLookupLabel", () => {
  it("returns the matching option's name", () => {
    expect(resolveLookupLabel(lookups, lookupField, 1)).toBe("VIP");
  });

  it("returns empty string when no option matches", () => {
    expect(resolveLookupLabel(lookups, lookupField, 999)).toBe("");
  });

  it.each([undefined, null, ""])("returns empty string for %p value", (value) => {
    expect(resolveLookupLabel(lookups, lookupField, value)).toBe("");
  });

  it("returns empty string when lookups are not loaded yet", () => {
    expect(resolveLookupLabel(undefined, lookupField, 1)).toBe("");
  });
});

describe("isFieldVisible", () => {
  it("is visible with no show-if condition", () => {
    expect(isFieldVisible({}, textField)).toBe(true);
  });

  it("respects showIfFieldTrue", () => {
    const field: CrmCoreField = { ...textField, showIfFieldTrue: "flag" };
    expect(isFieldVisible({ flag: true }, field)).toBe(true);
    expect(isFieldVisible({ flag: false }, field)).toBe(false);
  });

  it("respects showIfFieldFalse", () => {
    const field: CrmCoreField = { ...textField, showIfFieldFalse: "flag" };
    expect(isFieldVisible({ flag: true }, field)).toBe(false);
    expect(isFieldVisible({ flag: false }, field)).toBe(true);
  });
});

describe("fieldDisplayValue", () => {
  it("renders checkbox fields as Yes/No", () => {
    expect(fieldDisplayValue({ customer_is_child: true }, undefined, checkboxField)).toBe("Yes");
    expect(fieldDisplayValue({ customer_is_child: false }, undefined, checkboxField)).toBe("No");
  });

  it("resolves lookup-select fields via lookups", () => {
    expect(fieldDisplayValue({ customer_type: 1 }, lookups, lookupField)).toBe("VIP");
  });

  it("falls back to an em dash for an unresolved lookup value", () => {
    expect(fieldDisplayValue({ customer_type: 999 }, lookups, lookupField)).toBe("—");
  });

  it.each([undefined, null, ""])("falls back to an em dash for %p plain values", (value) => {
    expect(fieldDisplayValue({ customer_name: value }, undefined, textField)).toBe("—");
  });

  it("stringifies present plain values", () => {
    expect(fieldDisplayValue({ customer_name: "Acme Corp" }, undefined, textField)).toBe("Acme Corp");
  });
});

describe("fmtDate", () => {
  it("formats a valid ISO date", () => {
    expect(fmtDate("2026-01-15T00:00:00Z")).toMatch(/2026/);
  });

  it.each(["", "not-a-date"])("falls back to an em dash for %p", (value) => {
    expect(fmtDate(value)).toBe("—");
  });
});

describe("buildExportFilename", () => {
  it("prefers the record number when present", () => {
    expect(buildExportFilename("lead", "LD-0001", "Acme Corp")).toBe("lead-LD-0001.pdf");
  });

  it("falls back to a sanitized title when there is no record number", () => {
    expect(buildExportFilename("customer", undefined, "Acme & Sons / Co.")).toBe(
      "customer-Acme-Sons-Co-.pdf",
    );
  });

  it("falls back to the record type when title and record number are both empty", () => {
    expect(buildExportFilename("prospect", undefined, "")).toBe("prospect-prospect.pdf");
  });
});

describe("exportCrmRecordToPdf", () => {
  beforeEach(() => {
    // No real network in jsdom — loadLogoDataUrl's fetch rejects and is caught internally.
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("no network in tests")));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("builds and saves a PDF without throwing for a minimal record", async () => {
    await expect(
      exportCrmRecordToPdf({
        recordType: "lead",
        title: "Acme Corp",
        recordNumber: "LD-0001",
        statusLabel: "New",
        ownerName: "Jane Smith",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-02T00:00:00Z",
        coreFields: { customer_name: "Acme Corp" },
        customFields: { Priority: "High", Empty: "" },
      }),
    ).resolves.toBeUndefined();
  });
});
