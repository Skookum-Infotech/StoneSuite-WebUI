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
  shortLabel,
} from "./reportChartTheme";

export interface CountDatum {
  label: string;
  primary: number;
  secondary?: number;
}

interface ReportCountBarChartProps {
  data: CountDatum[];
  /** Accessible title, e.g. "Leads by stage". */
  label: string;
  primaryName: string;
  /** Name of the second series; omit for a single-series chart. */
  secondaryName?: string;
}

const MIN_ROW_HEIGHT = 34;

/** Horizontal count bars (funnel stages, lead sources). Counts are whole
 *  numbers, so the axis never shows fractions. */
export function ReportCountBarChart({ data, label, primaryName, secondaryName }: ReportCountBarChartProps) {
  const rows = data.slice(0, TOP_N);
  if (rows.length === 0) return null;
  return (
    <section aria-label={label} className="rounded-xl border border-stone-200 bg-white p-4">
      <h2 className="mb-2 text-sm font-semibold text-stone-900">{label}</h2>
      <div role="img" aria-label={`${label}: ${rows.map((d) => `${d.label} ${d.primary}`).join(", ")}`}>
        <ResponsiveContainer width="100%" height={Math.max(CHART_HEIGHT, rows.length * MIN_ROW_HEIGHT)}>
          <BarChart data={rows} layout="vertical" margin={{ left: 4, right: 16 }}>
            <CartesianGrid horizontal={false} stroke={GRID_COLOR} />
            <XAxis type="number" allowDecimals={false} tick={{ fontSize: AXIS_FONT_SIZE, fill: AXIS_COLOR }} />
            <YAxis
              type="category"
              dataKey="label"
              width={LABEL_AXIS_WIDTH}
              tickFormatter={shortLabel}
              tick={{ fontSize: AXIS_FONT_SIZE, fill: AXIS_COLOR }}
            />
            <Tooltip />
            {secondaryName && <Legend wrapperStyle={{ fontSize: AXIS_FONT_SIZE }} />}
            <Bar dataKey="primary" name={primaryName} fill={REVENUE_COLOR} radius={[0, BAR_RADIUS, BAR_RADIUS, 0]} />
            {secondaryName && (
              <Bar dataKey="secondary" name={secondaryName} fill={MARGIN_COLOR} radius={[0, BAR_RADIUS, BAR_RADIUS, 0]} />
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
