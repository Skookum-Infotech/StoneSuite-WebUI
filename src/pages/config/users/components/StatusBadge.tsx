export function StatusBadge({ status }: { status: string }) {
  if (status === "active")
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-success-ink type-pill">
        <span className="size-1.5 rounded-full bg-emerald-500" />
        Active
      </span>
    );
  if (status === "suspended")
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-warning-ink type-pill">
        <span className="size-1.5 rounded-full bg-amber-500" />
        Suspended
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-stone-200 bg-stone-100 px-2 py-0.5 text-ink-muted type-pill">
      <span className="size-1.5 rounded-full bg-stone-400" />
      Disabled
    </span>
  );
}
