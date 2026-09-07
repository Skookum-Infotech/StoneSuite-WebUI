import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Ban, CheckCircle2, Loader2, RotateCcw } from 'lucide-react';
import { importService } from '@/services/importService';
import { apiErrorMessage } from '@/api/tenantClient';
import { ErrorNote, Spinner, EmptyState, Badge } from '@/components/tenant/ui';
import { CORE_PREFIX, CF_PREFIX, applyColumnMapping, collectRawColumns } from '@/lib/importMapping';
import { CRM_CORE_SECTIONS } from '@/lib/crmFields';
import type { FieldDefinition } from '@/types/tenant';
import type { ImportColumnMapping, ImportRow, ImportSummary } from '@/types/import';
import { cn } from '@/lib/utils';

interface Props {
  jobId: string;
  workflowKey: string;
  fieldDefs: FieldDefinition[];
  onCommitted: (summary: ImportSummary) => void;
}

const CORE_FIELD_SUGGESTIONS = new Map(
  CRM_CORE_SECTIONS.flatMap((section) => section.fields.map((f) => [f.key, f.label])),
);

// A raw column's chosen mapping target, kept as plain "core:<key>" |
// "cf:<key>" | "" — the same shape importer.ApplyColumnMapping expects —
// except while the user is actively typing a core-field key, tracked
// separately below (see ColumnMappingRow) so a half-typed key never briefly
// resolves to a wrong target.

function ColumnMappingRow({
  column,
  target,
  fieldDefs,
  onChange,
}: {
  column: string;
  target: string;
  fieldDefs: FieldDefinition[];
  onChange: (target: string) => void;
}) {
  const mode = target.startsWith(CF_PREFIX) ? 'cf' : target.startsWith(CORE_PREFIX) ? 'core' : '';
  const coreKey = mode === 'core' ? target.slice(CORE_PREFIX.length) : '';

  return (
    <div className="flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 dark:border-stone-700 dark:bg-stone-900">
      <span className="min-w-0 flex-1 truncate text-xs font-semibold text-stone-700 dark:text-stone-200" title={column}>
        {column}
      </span>
      <select
        value={mode === 'cf' ? target : mode}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === 'core' ? `${CORE_PREFIX}` : v);
        }}
        className="rounded-lg border border-stone-200 bg-white px-2 py-1 text-xs text-stone-700 outline-none focus:border-brand dark:border-stone-700 dark:bg-stone-900 dark:text-stone-200"
      >
        <option value="">Ignore</option>
        <option value="core">Core field…</option>
        {fieldDefs.length > 0 && (
          <optgroup label="Custom fields">
            {fieldDefs.map((f) => (
              <option key={f.key} value={`${CF_PREFIX}${f.key}`}>
                {f.label}
              </option>
            ))}
          </optgroup>
        )}
      </select>
      {mode === 'core' && (
        <input
          type="text"
          list="import-core-field-suggestions"
          value={coreKey}
          onChange={(e) => onChange(`${CORE_PREFIX}${e.target.value}`)}
          placeholder="field key, e.g. customer_name"
          className="w-48 rounded-lg border border-stone-200 bg-white px-2 py-1 text-xs text-stone-700 outline-none focus:border-brand dark:border-stone-700 dark:bg-stone-900 dark:text-stone-200"
        />
      )}
    </div>
  );
}

function RowStatusBadge({ status }: { status: ImportRow['status'] }) {
  if (status === 'committed') return <Badge size="sm" color="#16a34a">Committed</Badge>;
  if (status === 'failed') return <Badge size="sm" color="#dc2626">Failed</Badge>;
  if (status === 'skipped') return <Badge size="sm">Skipped</Badge>;
  return <Badge size="sm" color="#a8a29e">Pending</Badge>;
}

export function ImportReviewStep({ jobId, workflowKey, fieldDefs, onCommitted }: Props) {
  const queryClient = useQueryClient();
  const [mapping, setMapping] = useState<ImportColumnMapping>({});
  const [applyError, setApplyError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [commitError, setCommitError] = useState<string | null>(null);

  const rowsQuery = useQuery({
    queryKey: ['import-rows', jobId],
    queryFn: () => importService.listRows(jobId),
  });
  const rows = useMemo(() => rowsQuery.data ?? [], [rowsQuery.data]);
  const rawColumns = useMemo(() => collectRawColumns(rows), [rows]);

  const skipMutation = useMutation({
    mutationFn: (rowId: string) => importService.skipRow(jobId, rowId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['import-rows', jobId] }),
  });

  const commitMutation = useMutation({
    mutationFn: () => importService.commit(jobId),
    onSuccess: onCommitted,
    onError: (err) => setCommitError(apiErrorMessage(err, 'Failed to commit the import.')),
  });

  const pendingRows = rows.filter((r) => r.status === 'pending');
  const mappedTargetCount = Object.values(mapping).filter(Boolean).length;

  const applyMapping = async () => {
    setApplying(true);
    setApplyError(null);
    try {
      // Small batches so a large file doesn't fire hundreds of concurrent
      // PATCH requests at once — there's no bulk-mapping endpoint, so this is
      // one request per row (see importService.updateRowMapped).
      const batchSize = 8;
      for (let i = 0; i < pendingRows.length; i += batchSize) {
        const batch = pendingRows.slice(i, i + batchSize);
        await Promise.all(
          batch.map((row) =>
            importService.updateRowMapped(jobId, row.id, applyColumnMapping(row.raw, mapping, fieldDefs)),
          ),
        );
      }
      await queryClient.invalidateQueries({ queryKey: ['import-rows', jobId] });
    } catch (err) {
      setApplyError(apiErrorMessage(err, 'Failed to apply the mapping to every row.'));
    } finally {
      setApplying(false);
    }
  };

  if (rowsQuery.isLoading) return <Spinner label="Loading staged rows…" />;
  if (rowsQuery.isError) return <ErrorNote>{apiErrorMessage(rowsQuery.error, 'Failed to load staged rows.')}</ErrorNote>;
  if (rows.length === 0) return <EmptyState>No rows were staged from this file.</EmptyState>;

  const committedCount = rows.filter((r) => r.status === 'committed').length;
  const skippedCount = rows.filter((r) => r.status === 'skipped').length;
  const failedCount = rows.filter((r) => r.status === 'failed').length;

  return (
    <div className="space-y-5">
      <datalist id="import-core-field-suggestions">
        {[...CORE_FIELD_SUGGESTIONS.entries()].map(([key, label]) => (
          <option key={key} value={key}>{label}</option>
        ))}
      </datalist>

      <div>
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-stone-500">
          Map columns ({rawColumns.length})
        </h3>
        <div className="space-y-1.5">
          {rawColumns.map((col) => (
            <ColumnMappingRow
              key={col}
              column={col}
              target={mapping[col] ?? ''}
              fieldDefs={fieldDefs}
              onChange={(target) => setMapping((prev) => ({ ...prev, [col]: target }))}
            />
          ))}
        </div>
        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            onClick={() => void applyMapping()}
            disabled={applying || mappedTargetCount === 0 || pendingRows.length === 0}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-3 py-1.5 text-xs font-semibold text-stone-950 transition-colors hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-40"
          >
            {applying ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCcw className="size-3.5" />}
            Apply mapping to {pendingRows.length} pending row{pendingRows.length === 1 ? '' : 's'}
          </button>
          {applyError && <span className="text-xs text-destructive">{applyError}</span>}
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wide text-stone-500">
            Staged rows for {workflowKey}
          </h3>
          <div className="flex items-center gap-2 text-2xs text-stone-500">
            <span>{pendingRows.length} pending</span>
            <span>{committedCount} committed</span>
            <span>{skippedCount} skipped</span>
            <span>{failedCount} failed</span>
          </div>
        </div>
        <div className="max-h-[28rem] overflow-auto rounded-xl border border-stone-200 dark:border-stone-700">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-stone-50 dark:bg-stone-800">
              <tr>
                <th className="px-3 py-2 font-semibold text-stone-500">#</th>
                <th className="px-3 py-2 font-semibold text-stone-500">Mapped core</th>
                <th className="px-3 py-2 font-semibold text-stone-500">Mapped custom</th>
                <th className="px-3 py-2 font-semibold text-stone-500">Issues</th>
                <th className="px-3 py-2 font-semibold text-stone-500">Status</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-stone-100 dark:border-stone-800">
                  <td className="px-3 py-2 text-stone-400">{row.rowIndex + 1}</td>
                  <td className="max-w-[16rem] truncate px-3 py-2 text-stone-600 dark:text-stone-300" title={JSON.stringify(row.mapped.core)}>
                    {Object.keys(row.mapped.core ?? {}).length === 0 ? '—' : JSON.stringify(row.mapped.core)}
                  </td>
                  <td className="max-w-[16rem] truncate px-3 py-2 text-stone-600 dark:text-stone-300" title={JSON.stringify(row.mapped.custom)}>
                    {Object.keys(row.mapped.custom ?? {}).length === 0 ? '—' : JSON.stringify(row.mapped.custom)}
                  </td>
                  <td className="max-w-[14rem] px-3 py-2">
                    {row.errors.length > 0 ? (
                      <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                        <AlertTriangle className="size-3 shrink-0" />
                        <span className="truncate" title={row.errors.join('; ')}>{row.errors.join('; ')}</span>
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-3 py-2"><RowStatusBadge status={row.status} /></td>
                  <td className="px-3 py-2 text-right">
                    {row.status === 'pending' && (
                      <button
                        type="button"
                        onClick={() => skipMutation.mutate(row.id)}
                        disabled={skipMutation.isPending}
                        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-2xs font-semibold text-stone-500 hover:bg-stone-100 dark:hover:bg-white/10"
                      >
                        <Ban className="size-3" /> Skip
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center gap-3 border-t border-stone-200 pt-4 dark:border-stone-700">
        <button
          type="button"
          onClick={() => commitMutation.mutate()}
          disabled={commitMutation.isPending || pendingRows.length === 0}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold text-white transition-colors',
            'bg-emerald-600 hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40',
          )}
        >
          {commitMutation.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
          Commit {pendingRows.length} row{pendingRows.length === 1 ? '' : 's'}
        </button>
        {commitError && <span className="text-xs text-destructive">{commitError}</span>}
      </div>
    </div>
  );
}
