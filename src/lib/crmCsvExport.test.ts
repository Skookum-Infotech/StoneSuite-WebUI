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

describe("csvEscapeValue formula-injection guard", () => {
  it.each([
    ["=cmd|' /C calc'!A0", "'=cmd|' /C calc'!A0"],
    ["+1+1", "'+1+1"],
    ["-2+3", "'-2+3"],
    ["@SUM(A1)", "'@SUM(A1)"],
    ["	Tabbed", "'	Tabbed"],
  ])("prefixes %j with an apostrophe", (input, expected) => {
    expect(csvEscapeValue(input)).toBe(expected);
  });

  it("prefixes before quoting", () => {
    expect(csvEscapeValue("=A1,B1")).toBe(`"'=A1,B1"`);
  });

  it.each(["-12.50", "+7", "42", "Acme -1", "a=b"])("leaves %j untouched", (input) => {
    expect(csvEscapeValue(input)).toBe(input);
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
    expect(header).toBe("Record Number,Company,Status,Owner,Approval,Email,Created,Updated");
    expect(row).toContain("buyer@acme.com");
    expect(row).toContain("New");
  });

  describe("Owner column", () => {
    const owners = new Map([["user-1", "Dana Reyes"]]);
    const ownerOf = (csv: string) => csv.split("\r\n")[1]?.split(",")[3];

    it.each([
      { name: "shows the owner's display name", record: { ownerUserId: "user-1" }, want: "Dana Reyes" },
      { name: "is empty for a record with no owner", record: {}, want: "" },
      { name: "is empty when the owner id is not in the map", record: { ownerUserId: "gone" }, want: "" },
      { name: "is empty when the owner id is blank", record: { ownerUserId: "" }, want: "" },
    ])("$name", ({ record, want }) => {
      expect(ownerOf(buildCrmRecordsCsv([makeRecord(record)], statusMap, true, owners))).toBe(want);
    });

    it("is empty for every record when no owner names are given", () => {
      expect(ownerOf(buildCrmRecordsCsv([makeRecord({ ownerUserId: "user-1" })], statusMap, true))).toBe("");
    });

    it("sits right after Status, where the table shows it, with and without Email", () => {
      for (const showEmail of [true, false]) {
        const header = buildCrmRecordsCsv([], statusMap, showEmail, owners).split(",");
        expect(header.slice(1, 4)).toEqual(["Company", "Status", "Owner"]);
      }
    });

    it("quotes an owner name containing a comma", () => {
      const named = new Map([["user-1", "Reyes, Dana"]]);
      const csv = buildCrmRecordsCsv([makeRecord({ ownerUserId: "user-1" })], statusMap, false, named);
      expect(csv).toContain('"Reyes, Dana"');
    });
  });

  it("omits the email column when showEmail is false", () => {
    const csv = buildCrmRecordsCsv([makeRecord()], statusMap, false);
    const [header] = csv.split("\r\n");
    expect(header).toBe("Record Number,Company,Status,Owner,Approval,Created,Updated");
  });

  it("falls back to an empty status cell when the state has no status mapping", () => {
    const csv = buildCrmRecordsCsv([makeRecord({ currentStateId: "unknown" })], statusMap, false);
    const [, row] = csv.split("\r\n");
    expect(row?.split(",")[2]).toBe("");
  });

  it("produces only the header row for an empty record list", () => {
    const csv = buildCrmRecordsCsv([], statusMap, true);
    expect(csv).toBe("Record Number,Company,Status,Owner,Approval,Email,Created,Updated");
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

  it.each([
    ["pending", "Pending"],
    ["approved", "Approved"],
    ["rejected", "Rejected"],
  ] as const)("labels approval_status %p as %p", (status, label) => {
    const csv = buildCrmRecordsCsv(
      [makeRecord({ coreFields: { customer_name: "Acme Corp", approval_status: status } })],
      statusMap,
      false,
    );
    const [, row] = csv.split("\r\n");
    expect(row?.split(",")[4]).toBe(label);
  });

  it("leaves the approval cell empty when approval is not required", () => {
    const csv = buildCrmRecordsCsv([makeRecord()], statusMap, false);
    const [, row] = csv.split("\r\n");
    expect(row?.split(",")[4]).toBe("");
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
