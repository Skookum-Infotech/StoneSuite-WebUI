import { describe, it, expect } from "vitest";
import { formatMoney } from "@/lib/formatMoney";
import { tooltipMoney, tooltipNumber } from "./reportChartTheme";

describe("chart tooltips", () => {
  it("formats a money value as currency", () => {
    expect(tooltipMoney(1500.5)).toBe(formatMoney(1500.5));
  });

  it("formats a count or quantity as a plain number, never as currency", () => {
    expect(tooltipNumber(1234)).toBe((1234).toLocaleString());
    expect(tooltipNumber(1234.5678)).toBe((1234.5678).toLocaleString(undefined, { maximumFractionDigits: 4 }));
    expect(tooltipNumber("7")).toBe("7");
  });
});
