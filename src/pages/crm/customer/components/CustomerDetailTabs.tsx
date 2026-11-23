import { TAB_LIST_CLASS, tabClass } from '@/components/ui/tabStyles';
import { CUSTOMER_TABS, type CustomerTab } from './customerTabs';

interface CustomerDetailTabsProps {
  active: CustomerTab;
  onChange: (tab: CustomerTab) => void;
  /** Whether the viewer may see the Portal Access tab. */
  canViewPortalAccess: boolean;
}

/** Tab bar — scrolls horizontally on small screens rather than overflowing the page. */
export function CustomerDetailTabs({ active, onChange, canViewPortalAccess }: CustomerDetailTabsProps) {
  const tabs = CUSTOMER_TABS.filter((t) => t.key !== 'portal' || canViewPortalAccess);
  return (
    <div className="flex shrink-0 overflow-x-auto modal-scrollbar border-b border-stone-200 bg-white px-3 sm:px-5 3xl:px-12 4xl:px-16 py-2.5">
      <div role="tablist" className={TAB_LIST_CLASS}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            className={tabClass(active === tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}
