import { describe, it, expect } from "vitest";
import type { StatusInfo, WorkflowRecord } from "@/types/tenant";
import { buildCrmCsvFilename, buildCrmRecordsCsv, csvEscapeValue, fmtCsvDate } from "./crmCsvExport";

function makeRecord(overrides: Partial<WorkflowRecord> = {}): WorkflowRecord {
  return {
    id: "rec-1",
    workflowId: "wf-1",
    currentStateId: "state-new",
    coreFields: { customer_name: "Acme Corp", customer_contact_email: "buyer@acme.com" },
    customFields: {},
    recordNumber: "LD-0001",
    createdAt: "2026-01-15T00:00:00Z",
    updatedAt: "2026-01-20T00:00:00Z",
    ...overrides,
  };
}

const statusMap = new Map<string, StatusInfo>([
  [
    "state-new",
    {
      stateId: "state-new",
      stateKey: "new",
      statusLabel: "New",
      workflowKey: "lead",
      workflowName: "Lead",
      isInitial: true,
      isTerminal: false,
      sortOrder: 0,
      color: "#000000",
    },
  ],
]);

describe("csvEscapeValue", () => {
  it("returns plain values unquoted", () => {
    expect(csvEscapeValue("Acme Corp")).toBe("Acme Corp");
  });

  it.each([null, undefined])("returns an empty string for %p", (value) => {
    expect(csvEscapeValue(value)).toBe("");
  });

  it("quotes and doubles embedded quotes", () => {
    expect(csvEscapeValue('Say "hi"')).toBe('"Say ""hi"""');
  });

  it("quotes values containing a comma", () => {
    expect(csvEscapeValue("Acme, Inc.")).toBe('"Acme, Inc."');
  });

  it("quotes values containing a newline", () => {
    expect(csvEscapeValue("line1\nline2")).toBe('"line1\nline2"');
  });
});

describe("fmtCsvDate", () => {
  it("formats a valid ISO date", () => {
    expect(fmtCsvDate("2026-01-15T00:00:00Z")).toMatch(/2026/);
  });

  it.each(["", "not-a-date"])("returns an empty string for %p", (value) => {
    expect(fmtCsvDate(value)).toBe("");
  });
});

describe("buildCrmRecordsCsv", () => {
  it("includes an email column when showEmail is true", () => {
    const csv = buildCrmRecordsCsv([makeRecord()], statusMap, true);
    const [header, row] = csv.split("\r\n");
    expect(header).toBe("Record Number,Company,Status,Email,Created,Updated");
    expect(row).toContain("buyer@acme.com");
    expect(row).toContain("New");
  });

  it("omits the email column when showEmail is false", () => {
    const csv = buildCrmRecordsCsv([makeRecord()], statusMap, false);
    const [header] = csv.split("\r\n");
    expect(header).toBe("Record Number,Company,Status,Created,Updated");
  });

  it("falls back to an empty status cell when the state has no status mapping", () => {
    const csv = buildCrmRecordsCsv([makeRecord({ currentStateId: "unknown" })], statusMap, false);
    const [, row] = csv.split("\r\n");
    expect(row?.split(",")[2]).toBe("");
  });

  it("produces only the header row for an empty record list", () => {
    const csv = buildCrmRecordsCsv([], statusMap, true);
    expect(csv).toBe("Record Number,Company,Status,Email,Created,Updated");
  });

  it("quotes company names containing commas", () => {
    const csv = buildCrmRecordsCsv(
      [makeRecord({ coreFields: { customer_name: "Acme, Inc." } })],
      statusMap,
      false,
    );
    const [, row] = csv.split("\r\n");
    expect(row).toContain('"Acme, Inc."');
  });
});

describe("buildCrmCsvFilename", () => {
  it("lowercases and pluralizes the label with today's date", () => {
    const today = new Date().toISOString().slice(0, 10);
    expect(buildCrmCsvFilename("Lead")).toBe(`leads-${today}.csv`);
  });

  it("sanitizes non-alphanumeric characters in the label", () => {
    const today = new Date().toISOString().slice(0, 10);
    expect(buildCrmCsvFilename("Sales Order")).toBe(`sales-orders-${today}.csv`);
  });
});
