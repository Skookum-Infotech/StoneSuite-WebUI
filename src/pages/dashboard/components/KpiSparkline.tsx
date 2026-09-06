import { useEffect, useId, useState } from 'react';
import { cn } from '@/lib/utils';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { sparklineGeometry } from '@/lib/sparkline';

const WIDTH = 78;
const HEIGHT = 26;
const DOT_RADIUS = 1.7;

export function KpiSparkline({ points, color }: { points: number[]; color: string }) {
  const gradientId = useId();
  const reduced = useReducedMotion();
  const [drawn, setDrawn] = useState(reduced);

  useEffect(() => {
    if (reduced) return;
    const raf = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(raf);
  }, [reduced]);

  const geo = sparklineGeometry(points, { width: WIDTH, height: HEIGHT });

  return (
    <svg
      className="h-[26px] w-[78px] shrink-0 overflow-visible"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.22} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>

      {geo.area && (
        <path
          d={geo.area}
          fill={`url(#${gradientId})`}
          className={cn('transition-opacity duration-500 ease-out', drawn ? 'opacity-100' : 'opacity-0')}
        />
      )}

      {geo.line && (
        <polyline
          points={geo.line}
          fill="none"
          stroke={color}
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={drawn ? 0 : 1}
          className="transition-[stroke-dashoffset] duration-700 ease-out"
        />
      )}

      {geo.last && (
        <circle
          cx={geo.last.x}
          cy={geo.last.y}
          r={DOT_RADIUS}
          fill={color}
          className={cn('transition-opacity duration-300 ease-out', drawn ? 'opacity-100 delay-500' : 'opacity-0')}
        />
      )}
    </svg>
  );
}
