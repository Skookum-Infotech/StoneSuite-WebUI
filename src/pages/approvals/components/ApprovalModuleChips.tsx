import { cn } from '@/lib/utils';
import type { ApprovalInboxModule } from '@/types/approvalInbox';

const CHIP_BASE =
  'inline-flex h-7 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400';
const CHIP_ON = 'border-stone-900 bg-stone-900 text-white';
const CHIP_OFF = 'border-stone-200 bg-white text-stone-600 hover:bg-stone-50';

/** Module filter: "All 7", "Invoice 3", ... An empty `selected` means All. */
export function ApprovalModuleChips({ modules, total, selected, onSelect }: {
  modules: ApprovalInboxModule[];
  total: number;
  selected: string;
  onSelect: (module: string) => void;
}) {
  return (
    <div role="group" aria-label="Filter by module" className="flex flex-wrap gap-1">
      <button
        type="button"
        aria-pressed={selected === ''}
        onClick={() => onSelect('')}
        className={cn(CHIP_BASE, selected === '' ? CHIP_ON : CHIP_OFF)}
      >
        All {total}
      </button>
      {modules.map((m) => (
        <button
          key={m.module}
          type="button"
          aria-pressed={selected === m.module}
          onClick={() => onSelect(m.module)}
          className={cn(CHIP_BASE, selected === m.module ? CHIP_ON : CHIP_OFF)}
        >
          {m.label} {m.count}
        </button>
      ))}
    </div>
  );
}
