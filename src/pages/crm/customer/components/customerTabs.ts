import { useCallback } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';

export const CUSTOMER_TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'transactions', label: 'Transactions' },
  { key: 'files', label: 'Files' },
  { key: 'portal', label: 'Portal Access' },
  { key: 'audit', label: 'Audit' },
  { key: 'activity', label: 'Activity' },
] as const;

export type CustomerTab = (typeof CUSTOMER_TABS)[number]['key'];

const DEFAULT_TAB: CustomerTab = 'overview';
const TAB_PARAM = 'tab';

function isCustomerTab(value: unknown): value is CustomerTab {
  return CUSTOMER_TABS.some((t) => t.key === value);
}

/**
 * The active customer tab, driven by `?tab=` (so it is linkable), falling back
 * to `location.state.initialTab` and then Overview. Changing it keeps the other
 * query params and replaces the history entry.
 */
export function useCustomerTab(): [CustomerTab, (tab: CustomerTab) => void] {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const fromUrl = searchParams.get(TAB_PARAM);
  const fromState = (location.state as { initialTab?: unknown } | null)?.initialTab;
  const active = isCustomerTab(fromUrl) ? fromUrl : isCustomerTab(fromState) ? fromState : DEFAULT_TAB;

  const setTab = useCallback(
    (tab: CustomerTab) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set(TAB_PARAM, tab);
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );
  return [active, setTab];
}

