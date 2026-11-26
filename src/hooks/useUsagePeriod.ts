import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { USAGE_PERIODS, type UsagePeriod } from '@/types/platformUsage';

const PERIOD_PARAM = 'period';
export const DEFAULT_USAGE_PERIOD: UsagePeriod = '30d';

export function toUsagePeriod(raw: string | null): UsagePeriod {
  return USAGE_PERIODS.find((p) => p === raw) ?? DEFAULT_USAGE_PERIOD;
}

/** The Tenant Usage period, kept in ?period= so a view can be linked.
 *  The default (30d) is left out of the URL. */
export function useUsagePeriod(): [UsagePeriod, (next: UsagePeriod) => void] {
  const [params, setParams] = useSearchParams();
  const period = toUsagePeriod(params.get(PERIOD_PARAM));
  const setPeriod = useCallback(
    (next: UsagePeriod) => {
      setParams(
        (prev) => {
          const out = new URLSearchParams(prev);
          if (next === DEFAULT_USAGE_PERIOD) out.delete(PERIOD_PARAM);
          else out.set(PERIOD_PARAM, next);
          return out;
        },
        { replace: true },
      );
    },
    [setParams],
  );
  return [period, setPeriod];
}
