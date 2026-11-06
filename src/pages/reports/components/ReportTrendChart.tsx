import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  AXIS_COLOR,
  AXIS_FONT_SIZE,
  BAR_RADIUS,
  CHART_HEIGHT,
  GRID_COLOR,
  MARGIN_COLOR,
  REVENUE_COLOR,
  compactMoney,
  tooltipMoney,
  type ChartDatum,
} from "./reportChartTheme";

interface ReportTrendChartProps {
  data: ChartDatum[];
  label: string;
}

const LINE_WIDTH = 2;

/** Revenue columns with a margin line, oldest period first (server order). */
export function ReportTrendChart({ data, label }: ReportTrendChartProps) {
  if (data.length === 0) return null;
  return (
    <section aria-label={label} className="rounded-xl border border-stone-200 bg-white p-4">
      <h2 className="mb-2 text-sm font-semibold text-stone-900">{label}</h2>
      <div role="img" aria-label={`${label}: ${data.length} periods from ${data[0].label} to ${data[data.length - 1].label}`}>
        <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
          <ComposedChart data={data} margin={{ left: 4, right: 16 }}>
            <CartesianGrid vertical={false} stroke={GRID_COLOR} />
            <XAxis dataKey="label" tick={{ fontSize: AXIS_FONT_SIZE, fill: AXIS_COLOR }} />
            <YAxis tickFormatter={compactMoney} tick={{ fontSize: AXIS_FONT_SIZE, fill: AXIS_COLOR }} />
            <Tooltip formatter={tooltipMoney} />
            <Legend wrapperStyle={{ fontSize: AXIS_FONT_SIZE }} />
            <Bar dataKey="revenue" name="Revenue" fill={REVENUE_COLOR} radius={[BAR_RADIUS, BAR_RADIUS, 0, 0]} />
            <Line dataKey="margin" name="Margin" stroke={MARGIN_COLOR} strokeWidth={LINE_WIDTH} dot />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
