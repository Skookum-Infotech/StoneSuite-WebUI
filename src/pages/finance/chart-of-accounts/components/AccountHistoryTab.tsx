import { useQuery } from '@tanstack/react-query';
import { chartOfAccountsService } from '@/services/chartOfAccountsService';
import { lookupService } from '@/services/lookupService';
import { Spinner } from '@/components/tenant/ui';
import { apiErrorMessage } from '@/api/tenantClient';
import { cn } from '@/lib/utils';
import type { AccountHistoryEntry } from '@/types/chartOfAccounts';

// Matches chartofaccounts.redactedValue (store_history.go) — the store writes
// this literal string for both old/new when the changed field isn't on the
// value-safe allowlist (attributes may hold encrypted bank material). Render
// "changed", never a diff, for those rows (AD-10).
const REDACTED_VALUE = '[redacted]';

const FIELD_LABELS: Record<string, string> = {
  code: 'Code',
  name: 'Name',
  description: 'Description',
  type: 'Type',
  is_postable: 'Postable',
  is_active: 'Active',
  is_visible: 'Visible',
  attributes: 'Attributes',
  coa_account_id: 'Default account',
};

const ACTION_COLORS: Record<string, string> = {
  create: 'bg-accent-lime text-accent-foreground',
  delete: 'bg-destructive/10 text-destructive',
  update: 'bg-workflow-prospect-bg text-workflow-prospect-text',
  activate: 'bg-emerald-100 text-emerald-700',
  deactivate: 'bg-stone-100 text-stone-600',
  show: 'bg-sky-100 text-sky-700',
  hide: 'bg-amber-100 text-amber-700',
  repoint_slot: 'bg-violet-100 text-violet-700',
};

function fmtValue(field: string, v: string): string {
  if (!v) return '—';
  if (field === 'is_active') return v === 'true' ? 'Active' : 'Inactive';
  if (field === 'is_visible') return v === 'true' ? 'Visible' : 'Hidden';
  if (field === 'is_postable') return v === 'true' ? 'Postable' : 'Header';
  return v;
}

// Audit trail for one account — newest first. `by` is an employee id, not a
// name; resolved through the same lookupService employees list every other
// audit tab in this repo uses. Users without a matching employee row still
// record null and render as "system".
export function AccountHistoryTab({ accountId }: { accountId?: string }) {
  const { data: entries = [], isLoading, error } = useQuery({
    queryKey: ['coa-account-history', accountId],
    queryFn: () => chartOfAccountsService.getHistory(accountId!),
    enabled: Boolean(accountId),
  });

  const { data: lookups } = useQuery({
    queryKey: ['crm-lookups'],
    queryFn: lookupService.getCrmLookups,
    staleTime: 10 * 60 * 1000,
  });
  const employeeNames = new Map((lookups?.employees ?? []).map((e) => [String(e.id), e.name]));

  if (!accountId) return null;
  if (isLoading) return <div className="py-6 flex justify-center"><Spinner label="Loading history…" /></div>;
  if (error) {
    return <p className="py-6 text-center text-xs text-destructive/70 italic">{apiErrorMessage(error, 'Failed to load history.')}</p>;
  }
  if (entries.length === 0) return <p className="py-6 text-center text-xs text-stone-400 italic">No history recorded yet.</p>;

  return (
    <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b border-stone-100">
            {['Action', 'Field', 'Change', 'By', 'Date'].map((h) => (
              <th key={h} className="py-2 px-3 text-left font-semibold uppercase tracking-wide text-stone-400 text-2xs whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => <HistoryRow key={e.id} entry={e} employeeNames={employeeNames} />)}
        </tbody>
      </table>
    </div>
  );
}

function HistoryRow({ entry, employeeNames }: { entry: AccountHistoryEntry; employeeNames: Map<string, string> }) {
  const redacted = entry.oldValue === REDACTED_VALUE && entry.newValue === REDACTED_VALUE;
  const byName = entry.by ? employeeNames.get(String(entry.by)) : undefined;

  return (
    <tr className="border-b border-stone-50">
      <td className="py-2.5 px-3">
        <span
          className={cn(
            'inline-flex items-center rounded px-1.5 py-0.5 text-2xs font-semibold capitalize',
            ACTION_COLORS[entry.action] ?? 'bg-stone-100 text-stone-600',
          )}
        >
          {entry.action.replace('_', ' ')}
        </span>
      </td>
      <td className="py-2.5 px-3 text-stone-700">{FIELD_LABELS[entry.field] ?? entry.field}</td>
      <td className="py-2.5 px-3 text-stone-600">
        {redacted ? (
          <span className="italic text-stone-400">changed</span>
        ) : entry.action === 'create' ? (
          <span className="font-medium text-stone-800">{fmtValue(entry.field, entry.newValue)}</span>
        ) : (
          <span>
            <span className="text-stone-400">{fmtValue(entry.field, entry.oldValue)}</span>
            <span className="mx-1.5 text-stone-300">→</span>
            <span className="font-medium text-stone-800">{fmtValue(entry.field, entry.newValue)}</span>
          </span>
        )}
      </td>
      <td className="py-2.5 px-3 text-stone-500">{byName ?? <span className="italic text-stone-300">system</span>}</td>
      <td className="py-2.5 px-3 text-stone-400 text-2xs whitespace-nowrap">{new Date(entry.at).toLocaleString()}</td>
    </tr>
  );
}
