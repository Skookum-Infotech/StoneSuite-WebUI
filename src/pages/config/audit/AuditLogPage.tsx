import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ScrollText } from 'lucide-react';
import { auditService } from '@/services/auditService';
import { userService } from '@/services/tenantServices';
import { apiErrorMessage } from '@/api/tenantClient';
import { buildAuditParams } from '@/lib/auditLog';
import { EMPTY_AUDIT_FILTERS, type AuditFilters } from '@/types/audit';
import { AuditFiltersBar } from './components/AuditFiltersBar';
import { AuditTable } from './components/AuditTable';
import { AuditPagination } from './components/AuditPagination';

export default function AuditLogPage() {
  const [filters, setFilters] = useState<AuditFilters>(EMPTY_AUDIT_FILTERS);

  // Cursor-stack pagination (mirrors CrmRecordTable): `cursor` is what's sent
  // with the current request ('' = first page), `prevCursors` is the LIFO
  // stack needed to walk back with Prev. Cursors are only ever stored and
  // replayed, never constructed or decoded client-side.
  const [cursor, setCursor] = useState('');
  const [prevCursors, setPrevCursors] = useState<string[]>([]);

  function resetPaging() {
    setCursor('');
    setPrevCursors([]);
  }

  function updateFilters(patch: Partial<AuditFilters>) {
    setFilters((f) => ({ ...f, ...patch }));
    resetPaging();
  }

  function clearFilters() {
    setFilters(EMPTY_AUDIT_FILTERS);
    resetPaging();
  }

  const params = useMemo(() => buildAuditParams(filters, cursor), [filters, cursor]);

  const auditQ = useQuery({
    queryKey: ['audit', params],
    queryFn: () => auditService.list(params),
    placeholderData: (prev) => prev,
  });

  // Best-effort actor-name resolution for the table and the actor filter's
  // suggestions. audit:read does not imply user:read, so this list can fail
  // for some callers — that's fine, actorLabel() falls back to the raw actor
  // id (or the employee id carried in details) when a name isn't available.
  const usersQ = useQuery({
    queryKey: ['users'],
    queryFn: userService.listUsers,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const names = useMemo(() => {
    const map: Record<string, string> = {};
    for (const u of usersQ.data ?? []) map[u.id] = u.fullName || u.email;
    return map;
  }, [usersQ.data]);

  const actorOptions = useMemo(
    () => (usersQ.data ?? []).map((u) => ({ id: u.id, label: u.fullName || u.email })),
    [usersQ.data],
  );

  const entries = auditQ.data?.entries ?? [];
  const hasNext = Boolean(auditQ.data?.nextCursor);
  const hasPrev = prevCursors.length > 0;
  const pageNum = prevCursors.length + 1;

  function goNext() {
    if (!auditQ.data?.nextCursor) return;
    setPrevCursors((p) => [...p, cursor]);
    setCursor(auditQ.data.nextCursor);
  }

  function goPrev() {
    const prev = prevCursors[prevCursors.length - 1] ?? '';
    setPrevCursors((p) => p.slice(0, -1));
    setCursor(prev);
  }

  return (
    <div className="p-4 sm:p-6 3xl:p-10 4xl:p-14 flex-1 flex flex-col min-h-0">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent ring-1 ring-accent-foreground/10 shrink-0">
          <ScrollText className="size-5 text-accent-foreground" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-stone-900">Audit Log</h1>
          <p className="text-sm text-stone-500">
            Who did what across the workspace, newest first.
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-1 flex-col gap-3 min-h-0 border-t border-stone-100 pt-4">
        <AuditFiltersBar
          filters={filters}
          actorOptions={actorOptions}
          onChange={updateFilters}
          onClear={clearFilters}
        />

        {auditQ.isError && (
          <p role="alert" className="text-xs text-red-500">
            {apiErrorMessage(auditQ.error, 'Failed to load the audit log.')}
          </p>
        )}

        <AuditTable entries={entries} names={names} isLoading={auditQ.isLoading} />

        {entries.length > 0 && (
          <AuditPagination
            pageNum={pageNum}
            hasNext={hasNext}
            hasPrev={hasPrev}
            onNext={goNext}
            onPrev={goPrev}
          />
        )}
      </div>
    </div>
  );
}
