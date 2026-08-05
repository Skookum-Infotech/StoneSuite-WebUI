const WIDTH = 78;
const HEIGHT = 26;

export function KpiSparkline({ points, color }: { points: number[]; color: string }) {
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;

  const coords = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * WIDTH;
      const y = HEIGHT - ((p - min) / range) * HEIGHT;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg
      className="h-[26px] w-[78px] shrink-0"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <polyline points={coords} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
