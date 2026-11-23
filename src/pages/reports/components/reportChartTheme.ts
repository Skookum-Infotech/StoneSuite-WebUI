import { formatMoney } from "@/lib/formatMoney";

// Recharts takes colours as props (not classNames), so they live here as named
// constants. Revenue uses the brand green, margin the neutral ink, which stays
// legible in both series when one is much smaller than the other.
export const REVENUE_COLOR = "#719c3b";
export const MARGIN_COLOR = "#44403c";
export const GRID_COLOR = "#e7e5e4";
export const AXIS_COLOR = "#78716c";
export const CHART_HEIGHT = 280;
export const AXIS_FONT_SIZE = 11;
export const TOP_N = 10;
export const LABEL_AXIS_WIDTH = 130;
export const BAR_RADIUS = 3;
export const MAX_LABEL_CHARS = 18;

export interface ChartDatum {
  label: string;
  revenue: number;
  margin: number;
}

/** Truncates a long axis label so it never pushes the plot area around. */
export function shortLabel(label: string): string {
  return label.length > MAX_LABEL_CHARS ? `${label.slice(0, MAX_LABEL_CHARS - 1)}…` : label;
}

/** Compact axis ticks: 1.2k, 3.4M — full amounts stay in the tooltip. */
export function compactMoney(value: number): string {
  return new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

export function tooltipMoney(value: unknown): string {
  return formatMoney(typeof value === "number" ? value : Number(value));
}

const MAX_TOOLTIP_DECIMALS = 4;

/** A count or quantity: grouped digits, never a currency symbol. */
export function tooltipNumber(value: unknown): string {
  return (typeof value === "number" ? value : Number(value)).toLocaleString(undefined, {
    maximumFractionDigits: MAX_TOOLTIP_DECIMALS,
  });
}
