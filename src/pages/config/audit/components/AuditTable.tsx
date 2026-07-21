import { Fragment, useState } from 'react';
import { ChevronDown, ChevronRight, Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';
import { actorLabel, isRawActorId, formatAuditTime, formatDetails, humanizeToken } from '@/lib/auditLog';
import type { AuditEntry } from '@/types/audit';

const COLUMN_COUNT = 6;

interface Props {
  entries: AuditEntry[];
  names: Record<string, string>;
  isLoading: boolean;
}

// Renders one page of audit entries in the order the server returned them
// (newest-first, per GET /api/tenant/audit) — never re-sorted client-side.
export function AuditTable({ entries, names, isLoading }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
      <div className="overflow-x-auto modal-scrollbar">
        <table className="w-full min-w-[720px] text-left text-xs">
          <thead className="border-b border-stone-200 bg-table-header">
            <tr>
              <th className="w-8 px-4 py-3" />
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-stone-500">Time</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-stone-500">Resource</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-stone-500">Action</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-stone-500">Actor</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-stone-500">Record</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {isLoading ? (
              Array.from({ length: 6 }, (_, i) => <SkeletonRow key={i} />)
            ) : entries.length > 0 ? (
              entries.map((entry) => (
                <AuditRow
                  key={entry.id}
                  entry={entry}
                  names={names}
                  expanded={expandedId === entry.id}
                  onToggle={() => setExpandedId((id) => (id === entry.id ? null : entry.id))}
                />
              ))
            ) : (
              <tr>
                <td colSpan={COLUMN_COUNT} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="rounded-2xl bg-stone-100 p-4">
                      <Inbox className="size-6 text-stone-400" />
                    </div>
                    <p className="text-sm font-semibold text-stone-700">No audit entries match.</p>
                    <p className="text-xs text-stone-400">Try adjusting the filters above.</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AuditRow({
  entry,
  names,
  expanded,
  onToggle,
}: {
  entry: AuditEntry;
  names: Record<string, string>;
  expanded: boolean;
  onToggle: () => void;
}) {
  const rawActor = isRawActorId(entry, names);
  const details = formatDetails(entry.details);

  return (
    <Fragment>
      <tr className="hover:bg-stone-50/60 transition-colors duration-150">
        <td className="px-4 py-3 text-stone-400">
          <button
            type="button"
            aria-label={
              expanded
                ? `Collapse details for ${entry.action} on ${entry.resource}`
                : `Expand details for ${entry.action} on ${entry.resource}`
            }
            aria-expanded={expanded}
            onClick={onToggle}
            className="flex items-center justify-center rounded p-0.5 hover:bg-stone-100"
          >
            {expanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
          </button>
        </td>
        <td className="px-4 py-3 text-stone-500 tabular-nums whitespace-nowrap">
          {formatAuditTime(entry.createdAt)}
        </td>
        <td className="px-4 py-3 text-stone-700 font-medium whitespace-nowrap">
          {humanizeToken(entry.resource)}
        </td>
        <td className="px-4 py-3 text-stone-500 whitespace-nowrap">{humanizeToken(entry.action)}</td>
        <td
          className={cn(
            'px-4 py-3 whitespace-nowrap',
            rawActor ? 'font-mono text-2xs text-stone-400' : 'text-stone-700',
          )}
        >
          {actorLabel(entry, names)}
        </td>
        <td className="px-4 py-3 font-mono text-2xs text-stone-400 truncate max-w-[160px]">
          {entry.resourceId || '—'}
        </td>
      </tr>
      {expanded && (
        <tr className="bg-stone-50/60">
          <td colSpan={COLUMN_COUNT} className="px-4 py-3">
            {details ? (
              <pre className="max-h-64 overflow-auto rounded-lg bg-stone-900 px-3 py-2 text-2xs text-stone-100 whitespace-pre-wrap">
                {details}
              </pre>
            ) : (
              <p className="text-2xs text-stone-400">No additional details.</p>
            )}
          </td>
        </tr>
      )}
    </Fragment>
  );
}

function SkeletonRow() {
  return (
    <tr>
      <td className="px-4 py-3" />
      <td className="px-4 py-3">
        <div className="animate-pulse h-3 w-28 rounded bg-stone-100" />
      </td>
      <td className="px-4 py-3">
        <div className="animate-pulse h-3 w-20 rounded bg-stone-100" />
      </td>
      <td className="px-4 py-3">
        <div className="animate-pulse h-3 w-16 rounded bg-stone-100" />
      </td>
      <td className="px-4 py-3">
        <div className="animate-pulse h-3 w-24 rounded bg-stone-100" />
      </td>
      <td className="px-4 py-3">
        <div className="animate-pulse h-3 w-20 rounded bg-stone-100" />
      </td>
    </tr>
  );
}
