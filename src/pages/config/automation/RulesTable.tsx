import type { UseQueryResult } from '@tanstack/react-query';
import { apiErrorMessage } from '@/api/tenantClient';
import { EmptyState, ErrorNote } from '@/components/tenant/ui';
import type { AutomationRule } from '@/types/automationRule';
import { RuleRow } from './RuleRow';

const SKELETON_ROWS = 4;

interface Props {
  query: UseQueryResult<AutomationRule[]>;
  canConfigure: boolean;
  notSending: boolean;
  onPreview: (rule: AutomationRule) => void;
}

const HEADERS = ['Rule', 'Schedule', 'Status', 'Actions'];

function SkeletonRows() {
  return (
    <ul aria-busy="true" aria-label="Loading automation rules">
      {Array.from({ length: SKELETON_ROWS }, (_, i) => (
        <li key={i} className="flex flex-col gap-2 border-b border-stone-100 p-4 last:border-b-0 dark:border-stone-800">
          <div className="h-3 w-40 animate-pulse rounded bg-stone-100 dark:bg-stone-800" />
          <div className="h-3 w-64 max-w-full animate-pulse rounded bg-stone-100 dark:bg-stone-800" />
        </li>
      ))}
    </ul>
  );
}

/** The rule list: skeleton, error with Retry, empty state, or the rows. */
export function RulesTable({ query, canConfigure, notSending, onPreview }: Props) {
  const { data: rules, isLoading: loading } = query;
  if (query.isError) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <ErrorNote>{apiErrorMessage(query.error, 'Could not load automation rules.')}</ErrorNote>
        <button
          type="button"
          onClick={() => query.refetch()}
          aria-label="Retry loading automation rules"
          className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50"
        >
          Retry
        </button>
      </div>
    );
  }
  if (!loading && (rules ?? []).length === 0) {
    return <EmptyState>No automation rules are set up for this workspace.</EmptyState>;
  }
  return (
    <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900">
      <div
        aria-hidden="true"
        className="hidden grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1.4fr)] gap-4 border-b border-stone-200 bg-stone-50 px-4 py-2 text-xs font-semibold text-stone-500 md:grid dark:border-stone-800 dark:bg-stone-900"
      >
        {HEADERS.map((h) => (
          <span key={h}>{h}</span>
        ))}
      </div>
      {loading ? (
        <SkeletonRows />
      ) : (
        <ul aria-label="Automation rules">
          {(rules ?? []).map((rule) => (
            <RuleRow
              key={rule.ruleKey}
              rule={rule}
              canConfigure={canConfigure}
              notSending={rule.enabled && notSending}
              onPreview={onPreview}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
