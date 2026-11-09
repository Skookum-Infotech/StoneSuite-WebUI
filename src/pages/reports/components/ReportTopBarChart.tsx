import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  AXIS_COLOR,
  AXIS_FONT_SIZE,
  BAR_RADIUS,
  CHART_HEIGHT,
  GRID_COLOR,
  LABEL_AXIS_WIDTH,
  MARGIN_COLOR,
  REVENUE_COLOR,
  TOP_N,
  compactMoney,
  shortLabel,
  tooltipMoney,
  tooltipNumber,
  type ChartDatum,
} from "./reportChartTheme";

interface SeriesNames {
  /** Name of the `revenue` field's bars. */
  primary: string;
  /** Name of the `margin` field's bars; omit for a single-series chart. */
  secondary?: string;
}

interface ReportTopBarChartProps {
  data: ChartDatum[];
  /** Accessible summary, e.g. "Top customers by revenue". */
  label: string;
  /** Series names; Sales reports use the Revenue / Margin default. */
  names?: SeriesNames;
  /** How the values read in the tooltip; counts and quantities are not money. */
  valueFormat?: "money" | "number";
}

const SALES_NAMES: SeriesNames = { primary: "Revenue", secondary: "Margin" };
const MIN_ROW_HEIGHT = 34;

/** Horizontal money bars for the first TOP_N rows (the server already ranks
 *  them). Used by Sales (revenue + margin), Purchases (PO value + billed,
 *  spend) and AP aging (balance per bucket). */
export function ReportTopBarChart({ data, label, names = SALES_NAMES, valueFormat = "money" }: ReportTopBarChartProps) {
  const top = data.slice(0, TOP_N);
  if (top.length === 0) return null;
  return (
    <section aria-label={label} className="rounded-xl border border-stone-200 bg-white p-4">
      <h2 className="mb-2 text-sm font-semibold text-stone-900">{label}</h2>
      <div role="img" aria-label={`${label}: ${top.map((d) => d.label).join(", ")}`}>
        <ResponsiveContainer width="100%" height={Math.max(CHART_HEIGHT, top.length * MIN_ROW_HEIGHT)}>
          <BarChart data={top} layout="vertical" margin={{ left: 4, right: 16 }}>
            <CartesianGrid horizontal={false} stroke={GRID_COLOR} />
            <XAxis type="number" tickFormatter={compactMoney} tick={{ fontSize: AXIS_FONT_SIZE, fill: AXIS_COLOR }} />
            <YAxis
              type="category"
              dataKey="label"
              width={LABEL_AXIS_WIDTH}
              tickFormatter={shortLabel}
              tick={{ fontSize: AXIS_FONT_SIZE, fill: AXIS_COLOR }}
            />
            <Tooltip formatter={valueFormat === "number" ? tooltipNumber : tooltipMoney} />
            {names.secondary && <Legend wrapperStyle={{ fontSize: AXIS_FONT_SIZE }} />}
            <Bar dataKey="revenue" name={names.primary} fill={REVENUE_COLOR} radius={[0, BAR_RADIUS, BAR_RADIUS, 0]} />
            {names.secondary && (
              <Bar dataKey="margin" name={names.secondary} fill={MARGIN_COLOR} radius={[0, BAR_RADIUS, BAR_RADIUS, 0]} />
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
