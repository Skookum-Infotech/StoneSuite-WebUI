import {
  ONBOARDING_FILTERS,
  type OnboardingFilterCounts,
  type OnboardingFilterKey,
} from '@/lib/onboardingStatusFilter';

interface OnboardingStatusCardsProps {
  counts: OnboardingFilterCounts;
  active: OnboardingFilterKey | null;
  onSelect: (key: OnboardingFilterKey | null) => void;
}

export function OnboardingStatusCards({ counts, active, onSelect }: OnboardingStatusCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4" role="group" aria-label="Filter customers by status">
      {ONBOARDING_FILTERS.map((f) => {
        const selected = active === f.key;
        return (
          <button
            key={f.key}
            type="button"
            aria-pressed={selected}
            aria-label={`${f.label}: ${counts[f.key]} customers`}
            onClick={() => onSelect(selected ? null : f.key)}
            className={`rounded-xl border p-3 text-left shadow-sm transition hover:bg-stone-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
              selected ? 'border-brand bg-brand/10' : 'border-stone-200 bg-white'
            }`}
          >
            <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-stone-500">
              <span className={`size-2 rounded-full ${f.dotClass}`} aria-hidden="true" />
              {f.label}
            </span>
            <span className="mt-1 block text-2xl font-bold text-stone-900">{counts[f.key]}</span>
          </button>
        );
      })}
    </div>
  );
}
