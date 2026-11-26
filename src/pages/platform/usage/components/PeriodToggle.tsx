import { useRef, type KeyboardEvent } from 'react';
import { TAB_LIST_CLASS, tabClass } from '@/components/ui/tabStyles';
import { USAGE_PERIODS, type UsagePeriod } from '@/types/platformUsage';

// Starts with the visible text, so voice control ("click 7d") still matches.
const PERIOD_LABEL: Record<UsagePeriod, string> = {
  '7d': '7d (last 7 days)',
  '30d': '30d (last 30 days)',
  '90d': '90d (last 90 days)',
};

/** 7d / 30d / 90d switch. A radio group: arrow keys move the choice. */
export function PeriodToggle({ value, onChange }: { value: UsagePeriod; onChange: (p: UsagePeriod) => void }) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (step === 0) return;
    e.preventDefault();
    const next = (index + step + USAGE_PERIODS.length) % USAGE_PERIODS.length;
    onChange(USAGE_PERIODS[next]);
    refs.current[next]?.focus();
  };

  return (
    <div role="radiogroup" aria-label="Period" className={TAB_LIST_CLASS}>
      {USAGE_PERIODS.map((p, i) => (
        <button
          key={p}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="button"
          role="radio"
          aria-checked={value === p}
          aria-label={PERIOD_LABEL[p]}
          tabIndex={value === p ? 0 : -1}
          onClick={() => onChange(p)}
          onKeyDown={(e) => onKeyDown(e, i)}
          className={tabClass(value === p)}
        >
          {p}
        </button>
      ))}
    </div>
  );
}
