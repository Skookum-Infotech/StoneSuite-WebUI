import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { Spinner } from '@/components/tenant/ui';
import { refundService } from '@/services/refundService';
import type { AuditEntry } from '@/services/crmService';

// Mirrors PaymentAuditTab, but reads from refundService.getAudit
// (/api/tenant/refunds/{uuid}/audit).
export function RefundAuditTab({ refundId }: { refundId?: string }) {
  const { data: entries = [], isLoading, error } = useQuery({
    queryKey: ['refund-audit', refundId],
    queryFn: () => refundService.getAudit(refundId!),
    enabled: Boolean(refundId),
  });

  if (!refundId) {
    return <p className="py-12 text-center text-sm text-stone-400">Audit trail will be available after saving the refund.</p>;
  }
  if (isLoading) return <div className="py-6 flex justify-center"><Spinner label="Loading audit trail…" /></div>;
  if (error) return <p className="py-6 text-center text-xs text-destructive/70 italic">Failed to load audit trail.</p>;
  if (entries.length === 0) return <p className="py-6 text-center text-xs text-stone-400 italic">No audit events recorded yet.</p>;

  return (
    <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b border-stone-100">
            {['Action', 'Actor', 'IP Address', 'Version', 'Date'].map((h) => (
              <th key={h} className="py-2 px-3 text-left font-semibold uppercase tracking-wide text-stone-400 text-2xs whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, i) => <AuditRow key={i} entry={entry} />)}
        </tbody>
      </table>
    </div>
  );
}

function AuditRow({ entry }: { entry: AuditEntry }) {
  const [expanded, setExpanded] = useState(false);
  const hasChanges = Boolean(entry.oldValue || entry.newValue);

  return (
    <>
      {/* A row with a before/after diff is expandable, so the control is a
          real <button> in the last cell rather than an onClick on the <tr>:
          a click handler on a row is unreachable by keyboard, which would
          make the diff mouse-only. The row stays clickable as a convenience;
          the button is what carries the semantics and the tab stop. */}
      <tr
        className={cn('border-b border-stone-50 transition-colors', hasChanges && 'cursor-pointer hover:bg-stone-50')}
        onClick={() => hasChanges && setExpanded((v) => !v)}
      >
        <td className="py-2.5 px-3"><ActionBadge action={entry.action} /></td>
        <td className="py-2.5 px-3 text-stone-900 text-xs">{entry.actorName || <span className="text-stone-300 italic">system</span>}</td>
        <td className="py-2.5 px-3 text-stone-400 font-mono text-2xs">{entry.ipAddress || '—'}</td>
        <td className="py-2.5 px-3 text-stone-400 text-2xs">{entry.appVersion || '—'}</td>
        <td className="py-2.5 px-3 text-stone-400 text-2xs whitespace-nowrap">
          {hasChanges ? (
            <button
              type="button"
              aria-expanded={expanded}
              aria-label={`${expanded ? 'Hide' : 'Show'} changes for the ${entry.action} on ${new Date(entry.at).toLocaleString()}`}
              onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}
              className="inline-flex items-center gap-1.5 rounded text-stone-400 hover:text-stone-600 transition-colors"
            >
              {new Date(entry.at).toLocaleString()}
              <span className="text-stone-300" aria-hidden="true">{expanded ? '▲' : '▼'}</span>
            </button>
          ) : (
            new Date(entry.at).toLocaleString()
          )}
        </td>
      </tr>
      {expanded && hasChanges && (
        <tr className="bg-stone-50">
          <td colSpan={5} className="px-3 pb-3 pt-1">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {entry.oldValue && <ChangesBlock label="Before" data={entry.oldValue} />}
              {entry.newValue && <ChangesBlock label="After" data={entry.newValue} />}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// `apply`/`unapply` are Refund's own audit actions alongside the shared
// create/update/delete/transition set (controllers/refund_transition.go's
// auditRefund calls) — they get their own tint so a money movement doesn't
// read as a generic event.
function ActionBadge({ action }: { action: string }) {
  const color =
    action === 'create' ? 'bg-accent-lime text-accent-foreground' :
    action === 'delete' ? 'bg-destructive/10 text-destructive' :
    action === 'update' ? 'bg-workflow-prospect-bg text-workflow-prospect-text' :
    action === 'apply' || action === 'unapply' ? 'bg-emerald-50 text-emerald-700' :
    'bg-stone-100 text-stone-600';
  return (
    <span className={cn('inline-flex items-center rounded px-1.5 py-0.5 text-2xs font-semibold capitalize', color)}>
      {action}
    </span>
  );
}

function ChangesBlock({ label, data }: { label: string; data: Record<string, unknown> }) {
  return (
    <div>
      <p className="text-2xs font-semibold uppercase tracking-wide text-stone-400 mb-1.5">{label}</p>
      <div className="space-y-0.5">
        {Object.entries(data).map(([key, val]) => (
          <div key={key} className="flex gap-2 text-2xs">
            <span className="text-stone-400 shrink-0 min-w-[80px] font-medium">{key}</span>
            <span className="text-stone-600 break-all">{val === null || val === undefined ? '—' : String(val)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
