import { FlaskConical } from 'lucide-react';

/** Shown while the build serves sample usage data (VITE_PLATFORM_USAGE_MOCK=true). */
export function SampleDataNote() {
  return (
    <p role="note" className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
      <FlaskConical className="size-3.5 shrink-0" aria-hidden="true" />
      Sample data. The usage service isn't connected in this build, so these numbers are examples.
    </p>
  );
}
