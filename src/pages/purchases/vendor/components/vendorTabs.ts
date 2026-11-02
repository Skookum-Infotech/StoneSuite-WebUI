import { useCallback } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';

export const VENDOR_TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'transactions', label: 'Transactions' },
  { key: 'files', label: 'Files' },
  { key: 'audit', label: 'Audit' },
] as const;

export type VendorTab = (typeof VENDOR_TABS)[number]['key'];

const DEFAULT_TAB: VendorTab = 'overview';
const TAB_PARAM = 'tab';

function isVendorTab(value: unknown): value is VendorTab {
  return VENDOR_TABS.some((t) => t.key === value);
}

/**
 * The active vendor tab, driven by `?tab=` (so it is linkable and survives a
 * refresh), falling back to `location.state.initialTab` and then Overview.
 * Changing it drops the previous tab's own params (the Transactions filters)
 * and replaces the history entry.
 */
export function useVendorTab(): [VendorTab, (tab: VendorTab) => void] {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const fromUrl = searchParams.get(TAB_PARAM);
  const fromState = (location.state as { initialTab?: unknown } | null)?.initialTab;
  const active = isVendorTab(fromUrl) ? fromUrl : isVendorTab(fromState) ? fromState : DEFAULT_TAB;

  const setTab = useCallback(
    (tab: VendorTab) => {
      setSearchParams(new URLSearchParams({ [TAB_PARAM]: tab }), { replace: true });
    },
    [setSearchParams],
  );
  return [active, setTab];
}
