const FALLBACK_STATUS_COLOR = '#a8a29e';

// Non-interactive twin of StatusSelect's 'pill' trigger — same dot, tint and
// sizing, minus the button and chevron. A List row shows this instead of the
// status dropdown to anyone who may not change status from the list, so the
// column keeps its look without offering a control.
export function ReadOnlyStatusPill({ label, color }: { label: string; color?: string }) {
  const tint = color ?? FALLBACK_STATUS_COLOR;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold text-stone-600 whitespace-nowrap"
      style={{ backgroundColor: `${tint}18` }}
    >
      <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: tint }} aria-hidden="true" />
      {label}
    </span>
  );
}
