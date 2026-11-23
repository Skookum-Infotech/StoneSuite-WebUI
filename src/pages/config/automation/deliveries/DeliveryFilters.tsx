import { DELIVERY_STATUS_LABEL } from '@/lib/automationDeliveries';
import { DELIVERY_STATUSES, type DeliveryStatus } from '@/types/automationDelivery';
import type { AutomationRule } from '@/types/automationRule';

interface Props {
  status: DeliveryStatus | undefined;
  ruleKey: string | undefined;
  rules: AutomationRule[];
  onStatus: (status: DeliveryStatus | undefined) => void;
  onRuleKey: (ruleKey: string | undefined) => void;
}

const SELECT_CLASS =
  'rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs text-stone-700 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-200';

/** Status + rule selects; the page keeps them in sync with the URL query. */
export function DeliveryFilters({ status, ruleKey, rules, onStatus, onRuleKey }: Props) {
  const hasUnlistedRule = ruleKey !== undefined && !rules.some((r) => r.ruleKey === ruleKey);
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <select
        aria-label="Status"
        value={status ?? ''}
        onChange={(e) => onStatus((e.target.value || undefined) as DeliveryStatus | undefined)}
        className={SELECT_CLASS}
      >
        <option value="">All statuses</option>
        {DELIVERY_STATUSES.map((s) => (
          <option key={s} value={s}>
            {DELIVERY_STATUS_LABEL[s]}
          </option>
        ))}
      </select>
      <select
        aria-label="Rule"
        value={ruleKey ?? ''}
        onChange={(e) => onRuleKey(e.target.value || undefined)}
        className={SELECT_CLASS}
      >
        <option value="">All rules</option>
        {hasUnlistedRule && <option value={ruleKey}>{ruleKey}</option>}
        {rules.map((r) => (
          <option key={r.ruleKey} value={r.ruleKey}>
            {r.name}
          </option>
        ))}
      </select>
    </div>
  );
}
