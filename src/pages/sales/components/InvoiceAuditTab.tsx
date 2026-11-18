import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { Spinner } from '@/components/tenant/ui';
import { invoiceService } from '@/services/invoiceService';
import { AuditChanges } from '@/components/tenant/AuditChanges';
import type { AuditEntry } from '@/services/crmService';

// Mirrors SalesOrderAuditTab, but reads from invoiceService.getAudit
// (/api/tenant/invoices/{uuid}/audit) rather than the generic CRM audit
// endpoint or the Sales Order one.
export function InvoiceAuditTab({ invoiceId }: { invoiceId?: string }) {
  const { data: entries = [], isLoading, error } = useQuery({
    queryKey: ['invoice-audit', invoiceId],
    queryFn: () => invoiceService.getAudit(invoiceId!),
    enabled: Boolean(invoiceId),
  });

  if (!invoiceId) {
    return <p className="py-12 text-center text-sm text-ink-muted">Audit trail will be available after saving the invoice.</p>;
  }
  if (isLoading) return <div className="py-6 flex justify-center"><Spinner label="Loading audit trail…" /></div>;
  if (error) return <p className="py-6 text-center type-error italic">Failed to load audit trail.</p>;
  if (entries.length === 0) return <p className="py-6 text-center italic type-helper">No audit events recorded yet.</p>;

  return (
    <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white">
      <table className="w-full type-cell border-collapse">
        <thead>
          <tr className="border-b border-stone-100">
            {['Action', 'Actor', 'IP Address', 'Version', 'Date'].map((h) => (
              <th key={h} className="py-2 px-3 text-left whitespace-nowrap type-th">
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
      <tr
        className={cn('border-b border-stone-50 transition-colors', hasChanges && 'cursor-pointer hover:bg-stone-50')}
        onClick={() => hasChanges && setExpanded((v) => !v)}
      >
        <td className="py-2.5 px-3"><ActionBadge action={entry.action} /></td>
        <td className="py-2.5 px-3 type-cell">{entry.actorName || <span className="text-ink-muted italic">system</span>}</td>
        <td className="py-2.5 px-3 type-record-id">{entry.ipAddress || '—'}</td>
        <td className="py-2.5 px-3 type-cell">{entry.appVersion || '—'}</td>
        <td className="py-2.5 px-3 whitespace-nowrap type-cell">
          {new Date(entry.at).toLocaleString()}
          {hasChanges && <span className="ml-1.5 text-ink-muted">{expanded ? '▲' : '▼'}</span>}
        </td>
      </tr>
      {expanded && hasChanges && (
        <tr className="bg-stone-50">
          <td colSpan={5} className="px-3 pb-3 pt-1">
            <AuditChanges oldValue={entry.oldValue} newValue={entry.newValue} />
          </td>
        </tr>
      )}
    </>
  );
}

function ActionBadge({ action }: { action: string }) {
  const color =
    action === 'create' ? 'bg-accent-lime text-accent-foreground' :
    action === 'delete' ? 'bg-destructive/10 text-danger-ink' :
    action === 'update' ? 'bg-workflow-prospect-bg text-workflow-prospect-text' :
    'bg-stone-100 text-ink';
  return (
    <span className={cn('inline-flex items-center rounded px-1.5 py-0.5 capitalize type-pill', color)}>
      {action}
    </span>
  );
}

