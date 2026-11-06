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
  type ChartDatum,
} from "./reportChartTheme";

interface ReportTopBarChartProps {
  data: ChartDatum[];
  /** Accessible summary, e.g. "Top customers by revenue". */
  label: string;
}

/** Horizontal revenue + margin bars for the first TOP_N rows (the server
 *  already ranks them by revenue). */
export function ReportTopBarChart({ data, label }: ReportTopBarChartProps) {
  const top = data.slice(0, TOP_N);
  if (top.length === 0) return null;
  return (
    <section aria-label={label} className="rounded-xl border border-stone-200 bg-white p-4">
      <h2 className="mb-2 text-sm font-semibold text-stone-900">{label}</h2>
      <div role="img" aria-label={`${label}: ${top.map((d) => d.label).join(", ")}`}>
        <ResponsiveContainer width="100%" height={Math.max(CHART_HEIGHT, top.length * 34)}>
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
            <Tooltip formatter={tooltipMoney} />
            <Legend wrapperStyle={{ fontSize: AXIS_FONT_SIZE }} />
            <Bar dataKey="revenue" name="Revenue" fill={REVENUE_COLOR} radius={[0, BAR_RADIUS, BAR_RADIUS, 0]} />
            <Bar dataKey="margin" name="Margin" fill={MARGIN_COLOR} radius={[0, BAR_RADIUS, BAR_RADIUS, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
