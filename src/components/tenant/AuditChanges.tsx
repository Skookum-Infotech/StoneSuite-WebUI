import { ArrowRight } from 'lucide-react';
import { diffSnapshots } from '@/lib/auditDiff';

interface Props {
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
}

/** Shows only the fields that changed, as "Field  old → new". */
export function AuditChanges({ oldValue, newValue }: Props) {
  const changes = diffSnapshots(oldValue, newValue);
  if (changes.length === 0) {
    let message = 'No field changes recorded.';
    if (!oldValue && newValue) message = 'Record created.';
    else if (oldValue && !newValue) message = 'Record deleted.';
    return <p className="text-2xs italic text-stone-400">{message}</p>;
  }
  return (
    <ul className="space-y-1" aria-label="Changed fields">
      {changes.map((c) => (
        <li key={c.field} className="flex flex-wrap items-baseline gap-x-2 text-2xs">
          <span className="min-w-[120px] font-medium text-stone-500">{c.label}</span>
          <span className="break-all text-stone-400 line-through decoration-stone-300">{c.from}</span>
          <ArrowRight className="size-3 shrink-0 self-center text-stone-300" aria-hidden="true" />
          <span className="break-all font-medium text-stone-800">{c.to}</span>
        </li>
      ))}
    </ul>
  );
}
