import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { isAxiosError } from 'axios';
import { ChevronLeft, ChevronRight, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { approvalInboxService } from '@/services/approvalInboxService';
import { apiErrorMessage } from '@/api/tenantClient';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { APPROVALS_INBOX_KEY } from '@/hooks/useApprovalInboxSummary';
import { INBOX_PAGE_SIZE } from '@/lib/approvalInbox';
import type { ApprovalInboxScope } from '@/types/approvalInbox';
import { ApprovalInboxTable } from './components/ApprovalInboxTable';
import { ApprovalModuleChips } from './components/ApprovalModuleChips';
import { ApprovalScopeToggle } from './components/ApprovalScopeToggle';
import { CrmApprovalsSection } from './components/CrmApprovalsSection';

const HTTP_FORBIDDEN = 403;
const SKELETON_ROWS = [0, 1, 2];
const NAV_BTN =
  'flex items-center gap-1.5 h-8 px-3 rounded-lg border border-stone-200 bg-white text-xs font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors';

export default function ApprovalsInboxPage() {
  const { isSuperAdmin, isLoading: permissionsLoading } = useUserPermissions();
  const [searchParams, setSearchParams] = useSearchParams();

  // Only a super admin may ask for scope=all; for anyone else the param is ignored.
  const scope: ApprovalInboxScope = isSuperAdmin && searchParams.get('scope') === 'all' ? 'all' : 'mine';
  const module = searchParams.get('module') ?? '';

  // Cursor-stack paging: cursors are stored and replayed, never built or decoded.
  const [cursor, setCursor] = useState('');
  const [prevCursors, setPrevCursors] = useState<string[]>([]);

  function updateParams(next: { scope?: ApprovalInboxScope; module?: string }) {
    const params = new URLSearchParams(searchParams);
    if (next.scope !== undefined) {
      if (next.scope === 'all') params.set('scope', 'all');
      else params.delete('scope');
    }
    if (next.module !== undefined) {
      if (next.module) params.set('module', next.module);
      else params.delete('module');
    }
    setCursor('');
    setPrevCursors([]);
    setSearchParams(params, { replace: true });
  }

  const inboxQ = useQuery({
    queryKey: [APPROVALS_INBOX_KEY, 'list', scope, module, cursor],
    queryFn: () =>
      approvalInboxService
        .list({
          scope,
          limit: INBOX_PAGE_SIZE,
          ...(module ? { module } : {}),
          ...(cursor ? { cursor } : {}),
        })
        .catch((err: unknown) => {
          // A 403 on scope=all: the caller is not (or no longer) a super admin.
          // Fall back to their own queue instead of showing an error.
          if (scope === 'all' && isAxiosError(err) && err.response?.status === HTTP_FORBIDDEN) {
            toast.error('You can only see approvals assigned to you.');
            updateParams({ scope: 'mine' });
          }
          throw err;
        }),
    enabled: !permissionsLoading,
    placeholderData: (prev) => prev,
    refetchOnWindowFocus: true,
    retry: false,
  });

  const data = inboxQ.data;
  const nextCursor = data?.nextCursor ?? '';
  const isEmpty = !inboxQ.isLoading && !inboxQ.isError && (data?.items.length ?? 0) === 0;
  const notApprover = isEmpty && scope === 'mine' && !module && data?.total === 0 && !data.isApprover;

  function goNext() {
    if (!nextCursor) return;
    setPrevCursors((p) => [...p, cursor]);
    setCursor(nextCursor);
  }

  function goPrev() {
    setCursor(prevCursors[prevCursors.length - 1] ?? '');
    setPrevCursors((p) => p.slice(0, -1));
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col p-4 sm:p-6 3xl:p-10 4xl:p-14">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent ring-1 ring-accent-foreground/10">
          <ShieldCheck className="size-5 text-accent-foreground" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold tracking-tight text-stone-900">Approvals</h1>
          <p className="text-sm text-stone-500">Records waiting for your sign-off, oldest first.</p>
        </div>
        {isSuperAdmin && <ApprovalScopeToggle scope={scope} onChange={(s) => updateParams({ scope: s })} />}
      </div>

      <div className="mt-5 flex flex-col gap-3 border-t border-stone-100 pt-4">
        {data && (
          <ApprovalModuleChips
            modules={data.modules}
            total={data.total}
            selected={module}
            onSelect={(m) => updateParams({ module: m })}
          />
        )}

        {inboxQ.isLoading && (
          <div role="status" aria-label="Loading approvals" className="flex flex-col gap-2">
            <span className="sr-only">Loading approvals…</span>
            {SKELETON_ROWS.map((i) => (
              <div key={i} aria-hidden="true" className="h-14 animate-pulse rounded-xl bg-stone-100" />
            ))}
          </div>
        )}

        {inboxQ.isError && (
          <div role="alert" className="flex items-center gap-3 text-sm text-red-600">
            <span>{apiErrorMessage(inboxQ.error, 'Failed to load approvals.')}</span>
            <button type="button" onClick={() => void inboxQ.refetch()} className={NAV_BTN}>
              Retry
            </button>
          </div>
        )}

        {isEmpty && (
          <p className="rounded-xl border border-dashed border-stone-200 px-4 py-10 text-center text-sm text-stone-500">
            {notApprover
              ? 'You are not an approver on any workflow. An admin can add you in Configure > Workflows.'
              : 'Nothing is waiting for you.'}
          </p>
        )}

        {data && data.items.length > 0 && (
          <ApprovalInboxTable items={data.items} caption="Records awaiting approval, oldest first" />
        )}

        {(prevCursors.length > 0 || nextCursor) && (
          <div className="flex items-center justify-between px-1">
            <p className="text-xs text-stone-500 tabular-nums">
              Page {prevCursors.length + 1}
              {nextCursor ? '' : ' · last page'}
            </p>
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={goPrev} disabled={prevCursors.length === 0} aria-label="Previous page" className={NAV_BTN}>
                <ChevronLeft className="size-3.5" aria-hidden="true" />
                Previous
              </button>
              <button type="button" onClick={goNext} disabled={!nextCursor} aria-label="Next page" className={NAV_BTN}>
                Next
                <ChevronRight className="size-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>
        )}
      </div>

      <CrmApprovalsSection />
    </div>
  );
}
